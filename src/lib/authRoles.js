import { dbGet, dbPatch, dbPostMinimal } from "./supabase";

/**
 * Consulta en Supabase todos los perfiles asociados a un usuario (Admin/Especialista,
 * Paciente de consultorio y Atleta Independiente) a partir de su auth_id y su email.
 * Si detecta que faltaba vincular el auth_id en clientes, lo actualiza silenciosamente.
 * Garantiza que siempre exista el perfil de Atleta Independiente si no es nutriólogo.
 */
export async function refreshUserRoles(authUserId, userEmail) {
  const cleanEmail = (userEmail || "").trim().toLowerCase();
  if (!cleanEmail && !authUserId) return [];

  let availableRoles = [];

  // 1. Perfiles de administración / especialista (profiles)
  let profiles = [];
  try {
    if (authUserId) {
      profiles = await dbGet(`profiles?id=eq.${authUserId}`).catch(() => []);
    }
    if ((!profiles || profiles.length === 0) && cleanEmail) {
      profiles = await dbGet(`profiles?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => []);
    }
  } catch (e) {
    console.error("Error consultando profiles:", e);
  }

  let adminRole = profiles && profiles.length ? profiles[0].role : null;
  if (adminRole === "administrativo" && profiles[0].nutriologo_id) {
    try {
      const boss = await dbGet(`profiles?id=eq.${profiles[0].nutriologo_id}&select=role`).catch(() => []);
      if (boss.length && boss[0].role === "superadmin") {
        adminRole = "staff";
      }
    } catch {}
  }

  if (adminRole && ["superadmin", "nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(adminRole)) {
    if (["nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(adminRole) && profiles[0].activo === false) {
      // Cuenta suspendida
    } else {
      availableRoles.push({
        role: adminRole,
        data: profiles[0]
      });
    }
  }

  // 2. Registros de cliente (paciente o atleta independiente)
  let clientRows = [];
  try {
    if (cleanEmail) {
      const byEmail = await dbGet(`clientes?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => []);
      if (Array.isArray(byEmail)) clientRows.push(...byEmail);
    }
    if (authUserId) {
      const byAuth = await dbGet(`clientes?auth_id=eq.${authUserId}`).catch(() => []);
      if (Array.isArray(byAuth)) {
        for (const c of byAuth) {
          if (!clientRows.some(x => x.id === c.id)) {
            clientRows.push(c);
          }
        }
      }
    }
  } catch (e) {
    console.error("Error consultando clientes:", e);
  }

  // Si algún registro de cliente no tenía auth_id vinculado, enlazarlo automáticamente
  if (authUserId) {
    for (const c of clientRows) {
      if (!c.auth_id) {
        dbPatch(`clientes?id=eq.${c.id}`, { auth_id: authUserId }).catch(() => {});
        c.auth_id = authUserId;
      }
    }
  }

  // Enriquecer registros de pacientes con la clínica y nombre del especialista
  for (const clientData of clientRows) {
    if (clientData.activo === false) continue;

    if (clientData.nutriologo_id) {
      try {
        const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo,nombre,nombre_marca`).catch(() => []);
        if (nut && nut.length) {
          if (nut[0].activo === false) continue; // Clínica suspendida
          clientData.nombre_clinica = nut[0].nombre_marca || "Consultorio";
          clientData.nutriologo_nombre = nut[0].nombre || "Especialista";
        }
      } catch {}
    }

    availableRoles.push({
      role: "cliente",
      data: clientData
    });
  }

  // 3. Auto-creación / garantía de Atleta Independiente si no es Nutriólogo/Admin
  const isNutriOrSuper = adminRole && ["nutriologo", "nutriologo_estudiante", "superadmin"].includes(adminRole);
  if (!isNutriOrSuper) {
    const hasIndep = clientRows.some(c => c.nutriologo_id === null && c.activo !== false);
    if (!hasIndep && cleanEmail && authUserId) {
      try {
        const nombreMeta = profiles.length ? profiles[0].nombre : cleanEmail.split("@")[0];
        await dbPostMinimal("clientes", {
          nombre: nombreMeta,
          email: cleanEmail,
          auth_id: authUserId,
          activo: true,
          nutriologo_id: null
        });
        const recien = await dbGet(`clientes?auth_id=eq.${authUserId}&nutriologo_id=is.null`).catch(() => []);
        if (recien && recien.length > 0) {
          availableRoles.push({
            role: "cliente",
            data: recien[0]
          });
        }
      } catch (err) {
        console.error("Error auto-creando perfil atleta independiente:", err);
      }
    }
  }

  // 4. Ordenar con prioridad
  const priority = {
    superadmin: 1,
    staff: 2,
    nutriologo: 3,
    nutriologo_estudiante: 4,
    administrativo: 5,
    cliente: 6
  };

  availableRoles.sort((a, b) => {
    if (a.role === "cliente" && b.role === "cliente") {
      if (a.data?.nutriologo_id && !b.data?.nutriologo_id) return -1;
      if (!a.data?.nutriologo_id && b.data?.nutriologo_id) return 1;
      return 0;
    }
    return (priority[a.role] || 99) - (priority[b.role] || 99);
  });

  return availableRoles;
}
