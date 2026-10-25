import { dbGetFresh, syncNativeCredentials } from "./supabase";
import { precacheMediaList } from "./mediaCache";

const KEY = "flux_last_prefetch";
const MIN_INTERVAL = 45 * 1000;

const safe = async (p) => {
  try { return await dbGetFresh(p); } catch { return null; }
};

/**
 * Precarga el plan completo de un cliente (ciclos, nutrición activa y sin ciclo,
 * rutinas activas y sin ciclo, más todas las imágenes/GIFs correspondientes).
 */
export const prefetchPlanCliente = async (clienteId, mediaUrls = []) => {
  if (!clienteId) return;

  // 1. Ciclos del cliente
  const cs = await safe(`ciclos?cliente_id=eq.${clienteId}&order=created_at.desc`);
  const activeCycle = Array.isArray(cs) ? cs.find((x) => x.activo) : null;

  // 2. Si tiene ciclo activo, precargar su nutrición y rutinas
  if (activeCycle) {
    const cycleFilter = `ciclo_id=eq.${activeCycle.id}`;
    const ns = await safe(`nutricion?cliente_id=eq.${clienteId}&${cycleFilter}`);
    if (Array.isArray(ns) && ns[0]) {
      const ds = await safe(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`);
      if (Array.isArray(ds)) {
        ds.forEach((d) => {
          (d.comidas || []).forEach((m) => {
            if (m.foto_url) mediaUrls.push(m.foto_url);
            if (m.imagen_url) mediaUrls.push(m.imagen_url);
          });
        });
      }
    }
    const rs = await safe(`rutinas?cliente_id=eq.${clienteId}&${cycleFilter}&select=*,ejercicios(*)&order=orden.asc`);
    if (Array.isArray(rs)) {
      rs.forEach((r) => {
        (r.ejercicios || []).forEach((e) => {
          if (e.gif_url) mediaUrls.push(e.gif_url);
          if (Array.isArray(e.alternativas)) {
            e.alternativas.forEach((alt) => { if (alt.gif_url) mediaUrls.push(alt.gif_url); });
          }
        });
      });
    }
  }

  // 3. Precargar también planes sin ciclo (ciclo_id=is.null), usado cuando no hay ciclo
  const nullFilter = `ciclo_id=is.null`;
  const nsNull = await safe(`nutricion?cliente_id=eq.${clienteId}&${nullFilter}`);
  if (Array.isArray(nsNull) && nsNull[0]) {
    const ds = await safe(`nutricion_dias?nutricion_id=eq.${nsNull[0].id}&select=*,comidas(*)&order=orden.asc`);
    if (Array.isArray(ds)) {
      ds.forEach((d) => {
        (d.comidas || []).forEach((m) => {
          if (m.foto_url) mediaUrls.push(m.foto_url);
          if (m.imagen_url) mediaUrls.push(m.imagen_url);
        });
      });
    }
  }
  const rsNull = await safe(`rutinas?cliente_id=eq.${clienteId}&${nullFilter}&select=*,ejercicios(*)&order=orden.asc`);
  if (Array.isArray(rsNull)) {
    rsNull.forEach((r) => {
      (r.ejercicios || []).forEach((e) => {
        if (e.gif_url) mediaUrls.push(e.gif_url);
        if (Array.isArray(e.alternativas)) {
          e.alternativas.forEach((alt) => { if (alt.gif_url) mediaUrls.push(alt.gif_url); });
        }
      });
    });
  }

  // 4. Verificaciones de datos rápidos usadas por Admin.jsx y progreso nutricional
  await safe(`nutricion_progreso?cliente_id=eq.${clienteId}&limit=1000`);
  await safe(`ciclos?cliente_id=eq.${clienteId}&select=id&limit=1`);
  await safe(`rutinas?cliente_id=eq.${clienteId}&select=id&limit=1`);
  await safe(`metricas_progreso?cliente_id=eq.${clienteId}&select=id&limit=1`);
};

/**
 * Precarga (con internet) TODO lo que las pantallas del paciente/atleta consultan,
 * con las mismas rutas que usan, para que quede disponible sin conexión aunque
 * nunca haya abierto esa pestaña. Se guarda en la base local (IndexedDB)
 * y además precarga los GIFs de los ejercicios, fotos de platillos y fotos de perfil.
 */
export const prefetchCliente = async (cliente) => {
  if (!cliente?.id) return false;
  const id = cliente.id;
  const nutriId = cliente.nutriologo_id;
  const mediaUrls = [];

  // 1. Avatar propio del cliente
  if (cliente.avatar_url) mediaUrls.push(cliente.avatar_url);

  // 2. Consultas de perfil del cliente por email y por ID (usadas por UserProfile.jsx y App.jsx)
  if (cliente.email) {
    await safe(`clientes?email=ilike.${encodeURIComponent(cliente.email)}`);
  }
  await safe(`clientes?id=eq.${id}`);
  await safe(`clientes?id=eq.${id}&activo=eq.true`);
  await safe(`clientes?id=eq.${id}&select=premium_origen`);
  await safe(`recibos_pago_civil?cliente_id=eq.${id}&order=created_at.desc`);

  // 3. Nutriólogo asignado y marca global: avatar, logo y datos completos
  await safe(`profiles?role=eq.superadmin&select=nombre_marca,color_primario,logo_url&limit=1`);
  if (nutriId) {
    const first = await safe(`profiles?id=eq.${nutriId}&select=bloqueado`);
    if (first === null) return false; // sin conexión: no seguir
    await safe(`profiles?id=eq.${nutriId}&select=nombre_marca,color_primario,logo_url`);
    const profs = await safe(`profiles?id=eq.${nutriId}`);
    if (Array.isArray(profs) && profs[0]) {
      const p = profs[0];
      if (p.avatar_url) mediaUrls.push(p.avatar_url);
      if (p.logo_url) mediaUrls.push(p.logo_url);
      if (p.email) {
        await safe(`profiles?email=ilike.${encodeURIComponent(p.email)}`);
      }
    }
  }

  const cs = await safe(`ciclos?cliente_id=eq.${id}&activo=eq.true&limit=1`);
  if (cs === null) return false;
  const ciclo = cs.length ? cs[0] : null;
  const cicloFilter = ciclo ? `ciclo_id=eq.${ciclo.id}` : `ciclo_id=is.null`;

  await safe(`metricas_progreso?cliente_id=eq.${id}&order=fecha.desc&limit=1`);
  await safe(`metricas_progreso?cliente_id=eq.${id}&order=fecha.desc`);

  const ns = await safe(`nutricion?cliente_id=eq.${id}&${cicloFilter}`);
  if (ns && ns.length) {
    const ds = await safe(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`);
    if (Array.isArray(ds)) {
      ds.forEach((d) => {
        (d.comidas || []).forEach((c) => {
          if (c.foto_url) mediaUrls.push(c.foto_url);
          if (c.imagen_url) mediaUrls.push(c.imagen_url);
        });
      });
    }
  }

  const rs = await safe(`rutinas?cliente_id=eq.${id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`);
  if (Array.isArray(rs)) {
    const ids = rs.flatMap((r) => (r.ejercicios || []).map((e) => e.id));
    if (ids.length) {
      await safe(`progreso?cliente_id=eq.${id}&ejercicio_id=in.(${ids.join(",")})&limit=3000`);
    }
    // Extraer GIFs de los ejercicios de la rutina activa para descargarlos
    rs.forEach((r) => {
      (r.ejercicios || []).forEach((e) => {
        if (e.gif_url) mediaUrls.push(e.gif_url);
        if (Array.isArray(e.alternativas)) {
          e.alternativas.forEach((alt) => {
            if (alt.gif_url) mediaUrls.push(alt.gif_url);
          });
        }
      });
    });
  }

  // También precargar ciclo completo para civiles que usan ProgramarCliente
  await prefetchPlanCliente(id, mediaUrls);

  // Pestaña Progreso
  await safe(`rutinas?cliente_id=eq.${id}&select=id,ciclo_id,ejercicios(id,grupo_muscular)`);
  await safe(`progreso?cliente_id=eq.${id}&limit=3000`);

  // Pestaña Citas
  if (nutriId) {
    await safe(`citas?cliente_id=eq.${id}&order=fecha_hora.desc&select=id,fecha_hora,modalidad,estado,motivo_rechazo`);
    await safe(`disponibilidad?nutriologo_id=eq.${nutriId}&order=dia_semana.asc`);
    await safe(`citas_ratings?cliente_id=eq.${id}&select=cita_id,puntuacion`);
  }

  // Descargar GIFs, fotos de comidas, avatares y logos a la caché local permanente en segundo plano
  if (mediaUrls.length > 0) {
    precacheMediaList(mediaUrls).catch(() => {});
  }

  return true;
};

/**
 * Precarga datos del nutriólogo / coach (clientes activos, sus perfiles y rutinas)
 * para que al entrar sin internet todo esté disponible.
 */
export const prefetchAdmin = async (profileId, role) => {
  if (!profileId) return false;
  const isSuperadmin = role === "superadmin";
  const isStaff = role === "staff" || role === "administrativo";
  const filter = (isSuperadmin || isStaff)
    ? "clientes?order=created_at.asc"
    : `clientes?nutriologo_id=eq.${profileId}&order=created_at.asc`;
  const mediaUrls = [];

  // 1. Perfil del admin (para UserProfile, PerfilNutriologo, BrandContext y Admin.jsx)
  const profs = await safe(`profiles?id=eq.${profileId}`);
  await safe(`profiles?id=eq.${profileId}&select=nombre_marca,color_primario,logo_url`);
  await safe(`profiles?role=eq.superadmin&select=nombre_marca,color_primario,logo_url&limit=1`);
  if (Array.isArray(profs) && profs[0]) {
    const p = profs[0];
    if (p.avatar_url) mediaUrls.push(p.avatar_url);
    if (p.logo_url) mediaUrls.push(p.logo_url);
    if (p.email) {
      await safe(`profiles?email=ilike.${encodeURIComponent(p.email)}`);
    }
  }

  // 2. Consultas que Admin.jsx ejecuta en loadClientes y checkPago
  await safe(`profiles?id=eq.${profileId}&select=id,nombre,email,nombre_marca,telefono,ubicacion_texto,mapa_url`);
  await safe(`profiles?role=in.(nutriologo,nutriologo_estudiante,superadmin)&select=email`);
  await safe(`clientes?nutriologo_id=eq.${profileId}&objetivo=neq.Mi%20entrenamiento%20personal&order=created_at.asc&limit=1`);
  await safe(`recibos_pago?nutriologo_id=eq.${profileId}&order=created_at.desc`);
  await safe(`ciclos?activo=eq.true&select=id,cliente_id,nombre,fecha_inicio,activo`);
  await safe(`progreso?select=cliente_id,updated_at&order=updated_at.desc&limit=3000`);
  await safe(`metricas_progreso?select=cliente_id,fecha,created_at&order=created_at.desc&limit=1000`);
  await safe(`biblioteca_ejercicios?order=nombre.asc`);

  // 3. Si es Superadmin o Staff: precargar directorio completo de nutriólogos y sus logos
  if (isSuperadmin || isStaff) {
    const dirNutris = await safe("profiles?role=in.(nutriologo,nutriologo_estudiante)&order=created_at.desc");
    if (Array.isArray(dirNutris)) {
      dirNutris.forEach((n) => {
        if (n.avatar_url) mediaUrls.push(n.avatar_url);
        if (n.logo_url) mediaUrls.push(n.logo_url);
      });
    }
    await safe("profiles?role=in.(nutriologo,nutriologo_estudiante)&select=id,nombre");
  }

  // 4. Lista de clientes
  const clientes = await safe(filter);
  if (!Array.isArray(clientes) || !clientes.length) {
    if (mediaUrls.length > 0) precacheMediaList(mediaUrls).catch(() => {});
    return false;
  }

  // Guardar avatares de todos los clientes
  clientes.forEach((c) => {
    if (c.avatar_url) mediaUrls.push(c.avatar_url);
  });

  // 5. Precargar planes y rutinas para:
  // - Todos los clientes del coach (o hasta 40 para superadmin)
  // - El expediente propio del coach ("Mi Plan")
  const shadowCandidate = clientes.find((c) =>
    (c.nutriologo_id === profileId && c.objetivo === "Mi entrenamiento personal") ||
    (c.auth_id && c.auth_id === profileId)
  );

  const targets = isSuperadmin ? clientes.slice(0, 40) : clientes;
  const toPrefetch = new Set(targets.map((c) => c.id));
  if (shadowCandidate) toPrefetch.add(shadowCandidate.id);

  for (const clientId of toPrefetch) {
    await prefetchPlanCliente(clientId, mediaUrls);
  }

  // Precargar historiales de rutinas y nutrición para los clientes seleccionados
  const ids = Array.from(toPrefetch).slice(0, 25).join(",");
  if (ids) {
    await safe(`rutinas?cliente_id=in.(${ids})`);
    await safe(`nutricion?cliente_id=in.(${ids})`);
  }

  // 6. Descargar pasivamente todos los medios recolectados
  if (mediaUrls.length > 0) {
    precacheMediaList(mediaUrls).catch(() => {});
  }

  return true;
};

/** Detecta el rol de la sesión y precarga los datos correspondientes (máx. cada 45s). */
export const prefetchSession = async (force = false) => {
  try {
    syncNativeCredentials();
    const last = Number(localStorage.getItem(KEY) || 0);
    if (!force && Date.now() - last < MIN_INTERVAL) return;

    const snap = JSON.parse(localStorage.getItem("flux_session_snapshot") || "null");
    if (!snap) return;

    localStorage.setItem(KEY, String(Date.now()));

    // 1. Guardar en caché logos de sesión y marca activa
    const sessionMedia = [];
    if (snap.data?.avatar_url) sessionMedia.push(snap.data.avatar_url);
    if (snap.data?.logo_url) sessionMedia.push(snap.data.logo_url);
    const cachedLogo = localStorage.getItem("flux_cached_brand_logo");
    if (cachedLogo && cachedLogo.startsWith("http")) sessionMedia.push(cachedLogo);
    if (sessionMedia.length > 0) precacheMediaList(sessionMedia).catch(() => {});

    // 2. Si es paciente o atleta civil: precarga completa de sus rutinas y GIFs
    const clientes = new Map();
    if ((snap.role === "cliente" || snap.role === "civil") && snap.data?.id) {
      clientes.set(snap.data.id, snap.data);
    }
    const multi = snap.multiRoles || JSON.parse(localStorage.getItem("flux_multi_roles") || "null") || [];
    multi.forEach((r) => { if (r.role === "cliente" && r.data?.id) clientes.set(r.data.id, r.data); });

    for (const c of clientes.values()) {
      const ok = await prefetchCliente(c);
      if (!ok) { localStorage.setItem(KEY, "0"); break; }
    }

    // 3. Si es Nutriólogo, Superadmin o Civil (gestor atleta): precarga de clientes y sus programas
    if (["superadmin", "nutriologo", "nutriologo_estudiante", "staff", "civil"].includes(snap.role)) {
      const pId = snap.profileId || snap.data?.id;
      if (pId) {
        await prefetchAdmin(pId, snap.role).catch(() => {});
      }
    }
  } catch { /* ignore */ }
};
