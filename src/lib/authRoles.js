import { dbGet, dbGetFresh, dbPeek, dbPatch, dbPost, dbDel, storageListFolder, storageRemoveMany } from "./supabase";

const _linkedClientIds = new Set();
const PRO_ROLES = ["superadmin", "staff", "nutriologo", "nutriologo_estudiante", "administrativo"];

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

  // Si algún registro de cliente no tenía auth_id vinculado, enlazarlo automáticamente (máximo 1 vez por sesión)
  if (authUserId) {
    for (const c of clientRows) {
      if (!c.auth_id && c.id && !_linkedClientIds.has(c.id)) {
        _linkedClientIds.add(c.id);
        dbPatch(`clientes?id=eq.${c.id}`, { auth_id: authUserId }).catch(() => {});
        c.auth_id = authUserId;
      }
    }
  }

  // Enriquecer registros de pacientes con la clínica y nombre del especialista
  for (const clientData of clientRows) {
    if (clientData.activo === false) continue;
    if (clientData.objetivo === "Mi entrenamiento personal") continue;

    if (clientData.nutriologo_id) {
      try {
        const nut = await dbGetFresh(`profiles?id=eq.${clientData.nutriologo_id}&select=activo,nombre,nombre_marca`).catch(() => []);
        if (!nut || nut.length === 0 || nut[0].activo === false) continue; // Clínica eliminada o suspendida
        clientData.nombre_clinica = nut[0].nombre_marca || "Consultorio";
        clientData.nutriologo_nombre = nut[0].nombre || "Especialista";
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

/**
 * Verifica de forma fresca en la BD si existen perfiles o clientes activos para un correo,
 * limpiando automáticamente cualquier registro huérfano dejado por eliminaciones previas
 * (ej. "clientes sombra" sin especialista o filas en `profiles` con rol "cliente" sin expedientes).
 */
export async function checkAndCleanOrphanedEmail(rawEmail) {
  const cleanEmail = (rawEmail || "").trim().toLowerCase();
  if (!cleanEmail) return { existingProfiles: [], existingClientes: [] };

  let existingProfiles = await dbGetFresh(`profiles?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => []);
  let existingClientes = await dbGetFresh(`clientes?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => []);

  const hasProRole = existingProfiles.some(p => PRO_ROLES.includes(p.role));

  // 1. Limpiar clientes sombra huérfanos ("Mi entrenamiento personal" cuyo especialista ya no existe)
  const validClientes = [];
  for (const c of existingClientes) {
    let isOrphanShadow = false;
    if (c.objetivo === "Mi entrenamiento personal") {
      if (!hasProRole) {
        isOrphanShadow = true;
      } else if (c.nutriologo_id && !existingProfiles.some(p => p.id === c.nutriologo_id)) {
        const ownerProf = await dbGetFresh(`profiles?id=eq.${c.nutriologo_id}&select=id,role`).catch(() => []);
        if (!ownerProf || ownerProf.length === 0 || !PRO_ROLES.includes(ownerProf[0].role)) {
          isOrphanShadow = true;
        }
      }
    }

    if (isOrphanShadow) {
      try {
        await dbPatch(`clientes?id=eq.${c.id}`, { auth_id: null, email: null }).catch(() => {});
        await dbPost("rpc/eliminar_paciente_definitivo", { p_cliente_id: c.id, p_auth_id: null });
      } catch {}
    } else {
      validClientes.push(c);
    }
  }
  existingClientes = validClientes;

  // 2. Si solo quedan perfiles con role === "cliente" pero ya no hay ningún expediente en `clientes`,
  //    es un perfil huérfano de una cuenta eliminada: purgarlo de `profiles` y `auth.users`.
  if (!hasProRole && existingProfiles.length > 0 && existingClientes.length === 0) {
    for (const p of existingProfiles) {
      try {
        await dbPost("rpc/eliminar_nutriologo_definitivo", { p_nutriologo_id: p.id });
      } catch {}
    }
    existingProfiles = [];
  }

  return { existingProfiles, existingClientes };
}

/**
 * Elimina un expediente de paciente/atleta (`clienteId`).
 * - Si el usuario tiene otra cuenta activa en FLUX (ej. Atleta Independiente, paciente en otro consultorio
 *   o perfil profesional), borra ÚNICAMENTE este expediente (`clienteId`) y conserva su acceso (`auth.users`).
 * - Si este era su único rol/expediente en FLUX, borra también su perfil en `profiles` y su cuenta en `auth.users`.
 */
export async function deletePatientAccount({ clienteId, authId = null, email = "" }) {
  if (!clienteId) return;
  const cleanEmail = (email || "").trim().toLowerCase();

  // 1. Limpiar fotos de progreso en Storage
  try {
    const files = await storageListFolder("progress-photos", clienteId);
    if (files && files.length > 0) {
      const paths = files.map(f => `${clienteId}/${f.name}`);
      await storageRemoveMany("progress-photos", paths);
    }
  } catch (storageErr) {
    console.warn("Aviso limpiando fotos del paciente:", storageErr);
  }

  // 2. Consultar todas las filas relacionadas al usuario para saber si conserva otros roles activos
  let allClientes = [];
  let allProfiles = [];

  if (cleanEmail) {
    const [cByEmail, pByEmail] = await Promise.all([
      dbGetFresh(`clientes?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => []),
      dbGetFresh(`profiles?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => [])
    ]);
    if (Array.isArray(cByEmail)) allClientes.push(...cByEmail);
    if (Array.isArray(pByEmail)) allProfiles.push(...pByEmail);
  }

  const targetRow = allClientes.find(c => c.id === clienteId);
  const resolvedAuthId = authId || targetRow?.auth_id || allProfiles[0]?.id || null;

  if (resolvedAuthId) {
    const [cByAuth, pByAuth] = await Promise.all([
      dbGetFresh(`clientes?auth_id=eq.${resolvedAuthId}`).catch(() => []),
      dbGetFresh(`profiles?id=eq.${resolvedAuthId}`).catch(() => [])
    ]);
    for (const c of (cByAuth || [])) {
      if (!allClientes.some(x => x.id === c.id)) allClientes.push(c);
    }
    for (const p of (pByAuth || [])) {
      if (!allProfiles.some(x => x.id === p.id)) allProfiles.push(p);
    }
  }

  const hasProRole = allProfiles.some(p => PRO_ROLES.includes(p.role));
  const otherRealClientes = allClientes.filter(
    c => c.id !== clienteId && c.objetivo !== "Mi entrenamiento personal"
  );
  const orphanShadowClientes = allClientes.filter(
    c => c.id !== clienteId && c.objetivo === "Mi entrenamiento personal" && !hasProRole
  );

  // Limpiar cualquier cliente sombra huérfano adicional si no tiene rol profesional
  for (const orphan of orphanShadowClientes) {
    try {
      await dbPatch(`clientes?id=eq.${orphan.id}`, { auth_id: null, email: null }).catch(() => {});
      await dbPost("rpc/eliminar_paciente_definitivo", { p_cliente_id: orphan.id, p_auth_id: null });
    } catch {}
  }

  if (hasProRole || otherRealClientes.length > 0) {
    // El usuario conserva otra cuenta activa (Independiente, otro consultorio o Especialista):
    // Desvincular auth_id y email de esta fila antes de borrarla para que el RPC NO borre auth.users ni profiles.
    await dbPatch(`clientes?id=eq.${clienteId}`, { auth_id: null, email: null }).catch(() => {});
    await dbPost("rpc/eliminar_paciente_definitivo", { p_cliente_id: clienteId, p_auth_id: null });
  } else {
    // Era su única cuenta en FLUX: borrado definitivo de clientes, profiles, solicitudes y auth.users
    await dbPost("rpc/eliminar_paciente_definitivo", {
      p_cliente_id: clienteId,
      p_auth_id: resolvedAuthId
    });
    // Garantizar que no quede ningún perfil huérfano en `profiles` o `auth.users`
    for (const p of allProfiles) {
      if (p.id && p.id !== resolvedAuthId) {
        await dbPost("rpc/eliminar_nutriologo_definitivo", { p_nutriologo_id: p.id }).catch(() => {});
      }
    }
    if (cleanEmail) {
      await dbDel(`solicitudes_profesionales?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => {});
    }
  }
}

/**
 * Elimina definitivamente a un nutriólogo/especialista y todos los expedientes clínicos de SU consultorio:
 * - Borra el cliente sombra personal del propio nutriólogo.
 * - Borra todos los expedientes de pacientes pertenecientes a ese consultorio (`nutriologo_id = nutriologoId`).
 *   Si algún paciente de ese consultorio tiene además cuenta de Atleta Independiente o cuenta en otro consultorio,
 *   esas otras cuentas y su acceso (`auth.users`) se conservan intactos; si solo era paciente de este consultorio,
 *   se elimina por completo.
 * - Finalmente borra el perfil del nutriólogo y su usuario en `auth.users`.
 */
export async function deleteNutriologoAccount({ nutriologoId, email = "" }) {
  if (!nutriologoId) return;
  let cleanEmail = (email || "").trim().toLowerCase();

  if (!cleanEmail) {
    const prof = await dbGetFresh(`profiles?id=eq.${nutriologoId}&select=email`).catch(() => []);
    if (prof && prof[0]?.email) cleanEmail = prof[0].email.trim().toLowerCase();
  }

  // 1. Reunir todos los registros en `clientes` asociados a este consultorio o al propio nutriólogo (cliente sombra)
  const [byNutri, byAuth, byEmail] = await Promise.all([
    dbGetFresh(`clientes?nutriologo_id=eq.${nutriologoId}`).catch(() => []),
    dbGetFresh(`clientes?auth_id=eq.${nutriologoId}`).catch(() => []),
    cleanEmail ? dbGetFresh(`clientes?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => []) : Promise.resolve([])
  ]);

  const clinicAndShadowClients = [];
  const addUnique = (c) => {
    if (c && c.id && !clinicAndShadowClients.some(x => x.id === c.id)) {
      clinicAndShadowClients.push(c);
    }
  };

  (byNutri || []).forEach(addUnique);
  (byAuth || []).forEach(addUnique);
  (byEmail || []).forEach(c => {
    // Del correo del propio nutriólogo, incluir su cliente sombra o cualquier registro bajo su propio consultorio
    if (c.nutriologo_id === nutriologoId || c.auth_id === nutriologoId || c.objetivo === "Mi entrenamiento personal" || !c.nutriologo_id) {
      addUnique(c);
    }
  });

  // 2. Eliminar cada expediente del consultorio y el cliente sombra del nutriólogo
  for (const c of clinicAndShadowClients) {
    const isNutriOwnClient =
      c.auth_id === nutriologoId ||
      (cleanEmail && (c.email || "").trim().toLowerCase() === cleanEmail);

    if (isNutriOwnClient) {
      try {
        const files = await storageListFolder("progress-photos", c.id);
        if (files && files.length > 0) {
          const paths = files.map(f => `${c.id}/${f.name}`);
          await storageRemoveMany("progress-photos", paths);
        }
      } catch {}
      // Desvincular auth_id primero para que el cierre final en eliminar_nutriologo_definitivo limpie el auth.users del nutriólogo
      await dbPatch(`clientes?id=eq.${c.id}`, { auth_id: null, email: null }).catch(() => {});
      await dbPost("rpc/eliminar_paciente_definitivo", { p_cliente_id: c.id, p_auth_id: null }).catch(() => {});
    } else {
      // Es un paciente del consultorio que desaparece: borrar su expediente de este consultorio
      // (deletePatientAccount conservará automáticamente su cuenta independiente o de otro consultorio si la tiene)
      await deletePatientAccount({
        clienteId: c.id,
        authId: c.auth_id,
        email: c.email
      }).catch(() => {});
    }
  }

  // 3. Ejecutar el borrado definitivo del nutriólogo en BD
  await dbPost("rpc/eliminar_nutriologo_definitivo", { p_nutriologo_id: nutriologoId });
  if (cleanEmail) {
    await dbDel(`solicitudes_profesionales?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => {});
  }
}

/**
 * Elimina a un colaborador (`staff` o `administrativo`).
 * - Si el colaborador tiene una cuenta real de paciente/atleta independiente, conserva esa cuenta y solo revoca el rol de equipo.
 * - Si no tiene otra cuenta activa, elimina su cliente sombra, su perfil en `profiles` y su cuenta en `auth.users`.
 */
export async function deleteCollaboratorAccount({ profileId, email = "" }) {
  if (!profileId) return;
  let cleanEmail = (email || "").trim().toLowerCase();

  if (!cleanEmail) {
    const prof = await dbGetFresh(`profiles?id=eq.${profileId}&select=email`).catch(() => []);
    if (prof && prof[0]?.email) cleanEmail = prof[0].email.trim().toLowerCase();
  }

  const [byAuth, byEmail] = await Promise.all([
    dbGetFresh(`clientes?auth_id=eq.${profileId}`).catch(() => []),
    cleanEmail ? dbGetFresh(`clientes?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => []) : Promise.resolve([])
  ]);

  const allClientes = [];
  for (const c of [...(byAuth || []), ...(byEmail || [])]) {
    if (c && c.id && !allClientes.some(x => x.id === c.id)) allClientes.push(c);
  }

  // 1. Borrar cualquier cliente sombra ("Mi entrenamiento personal") del colaborador
  const shadowClients = allClientes.filter(c => c.objetivo === "Mi entrenamiento personal");
  for (const sc of shadowClients) {
    try {
      await dbPatch(`clientes?id=eq.${sc.id}`, { auth_id: null, email: null }).catch(() => {});
      await dbPost("rpc/eliminar_paciente_definitivo", { p_cliente_id: sc.id, p_auth_id: null });
    } catch {}
  }

  const realClientes = allClientes.filter(c => c.objetivo !== "Mi entrenamiento personal");

  if (realClientes.length > 0) {
    // Conserva su cuenta personal de paciente/atleta independiente
    await dbPatch(`profiles?id=eq.${profileId}`, {
      role: "cliente",
      nutriologo_id: null,
      especialidad: null,
      activo: true
    });
  } else {
    // No tiene cuenta de paciente/atleta: eliminar por completo de profiles y auth.users
    await dbPost("rpc/eliminar_nutriologo_definitivo", { p_nutriologo_id: profileId });
    if (cleanEmail) {
      await dbDel(`solicitudes_profesionales?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => {});
    }
  }
}
