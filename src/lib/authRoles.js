import { dbGet, dbGetFresh, dbPeek, dbPatch } from "./supabase";

/**
 * Consulta en Supabase todos los perfiles asociados a un usuario (Admin/Especialista,
 * Paciente de consultorio y Atleta Independiente) a partir de su auth_id y su email.
 * Si detecta que faltaba vincular el auth_id en clientes, lo actualiza silenciosamente.
 * Si hay un fallo de red o timeout, propaga el error en lugar de devolver un arreglo vacío,
 * evitando que un micro-corte de red se confunda con una cuenta eliminada.
 */
export async function refreshUserRoles(authUserId, userEmail) {
  const cleanEmail = (userEmail || "").trim().toLowerCase();
  if (!cleanEmail && !authUserId) return [];

  let availableRoles = [];
  let hadNetworkOrQueryError = false;
  let lastError = null;

  // 1. Perfiles de administración / especialista (profiles) - Consulta fresca a la BD
  let profiles = [];
  try {
    if (authUserId) {
      try {
        profiles = await dbGetFresh(`profiles?id=eq.${authUserId}`);
      } catch (err) {
        hadNetworkOrQueryError = true;
        lastError = err;
        const cached = dbPeek(`profiles?id=eq.${authUserId}`) || dbPeek(`profiles?id=eq.${authUserId}&select=id,activo,role`);
        if (Array.isArray(cached) && cached.length > 0) {
          profiles = cached;
        }
      }
    }
    if ((!profiles || profiles.length === 0) && cleanEmail) {
      try {
        profiles = await dbGetFresh(`profiles?email=ilike.${encodeURIComponent(cleanEmail)}`);
      } catch (err) {
        hadNetworkOrQueryError = true;
        lastError = err;
      }
    }
  } catch (e) {
    hadNetworkOrQueryError = true;
    lastError = e;
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
      // Cuenta suspendida explícitamente (activo === false)
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
      try {
        const byEmail = await dbGetFresh(`clientes?email=ilike.${encodeURIComponent(cleanEmail)}`);
        if (Array.isArray(byEmail)) clientRows.push(...byEmail);
      } catch (err) {
        hadNetworkOrQueryError = true;
        lastError = err;
      }
    }
    if (authUserId) {
      try {
        const byAuth = await dbGetFresh(`clientes?auth_id=eq.${authUserId}`);
        if (Array.isArray(byAuth)) {
          for (const c of byAuth) {
            if (!clientRows.some(x => x.id === c.id)) {
              clientRows.push(c);
            }
          }
        }
      } catch (err) {
        hadNetworkOrQueryError = true;
        lastError = err;
      }
    }
  } catch (e) {
    hadNetworkOrQueryError = true;
    lastError = e;
    console.error("Error consultando clientes:", e);
  }

  // Si hubo un fallo de red/timeout y no se pudo recuperar ningún rol, lanzar el error
  // para que el validador de sesión conserve la sesión activa en lugar de desloguear.
  if (availableRoles.length === 0 && clientRows.length === 0 && hadNetworkOrQueryError) {
    throw lastError || new Error("OFFLINE");
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
        const nut = await dbGetFresh(`profiles?id=eq.${clientData.nutriologo_id}&select=activo,nombre,nombre_marca`).catch(() => []);
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

  // 3. Ordenar con prioridad
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
