import { dbGetFresh } from "./supabase";
import { precacheMediaList } from "./mediaCache";

const KEY = "flux_last_prefetch";
const MIN_INTERVAL = 3 * 60 * 1000;

const safe = async (p) => {
  try { return await dbGetFresh(p); } catch { return null; }
};

/**
 * Precarga (con internet) TODO lo que las pantallas del paciente/atleta consultan,
 * con las mismas rutas que usan, para que quede disponible sin conexión aunque
 * nunca haya abierto esa pestaña. Se guarda en la base local (IndexedDB)
 * y además precarga los GIFs de los ejercicios de la rutina activa.
 */
export const prefetchCliente = async (cliente) => {
  if (!cliente?.id) return false;
  const id = cliente.id;
  const nutriId = cliente.nutriologo_id;
  const mediaUrls = [];

  if (nutriId) {
    const first = await safe(`profiles?id=eq.${nutriId}&select=bloqueado`);
    if (first === null) return false; // sin conexión: no seguir
    await safe(`profiles?id=eq.${nutriId}`);
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

  // Pestaña Progreso
  await safe(`rutinas?cliente_id=eq.${id}&select=id,ciclo_id,ejercicios(id,grupo_muscular)`);
  await safe(`progreso?cliente_id=eq.${id}&limit=3000`);

  // Pestaña Citas
  if (nutriId) {
    await safe(`citas?cliente_id=eq.${id}&order=fecha_hora.desc&select=id,fecha_hora,modalidad,estado,motivo_rechazo`);
    await safe(`disponibilidad?nutriologo_id=eq.${nutriId}&order=dia_semana.asc`);
    await safe(`citas_ratings?cliente_id=eq.${id}&select=cita_id,puntuacion`);
  }

  // Descargar GIFs y fotos de comidas a la caché local permanente en segundo plano
  if (mediaUrls.length > 0) {
    precacheMediaList(mediaUrls).catch(() => {});
  }

  return true;
};

/**
 * Precarga datos del nutriólogo / coach (clientes activos y sus rutinas)
 * para que al entrar a Programar sin internet, los clientes y rutinas
 * ya estén guardados en el teléfono.
 */
export const prefetchAdmin = async (profileId, role) => {
  if (!profileId) return false;
  const isSuperadmin = role === "superadmin";
  const filter = isSuperadmin ? "clientes?order=created_at.asc" : `clientes?nutriologo_id=eq.${profileId}&order=created_at.asc`;

  const clientes = await safe(filter);
  if (!Array.isArray(clientes) || !clientes.length) return false;

  // Tomar hasta los 12 clientes más recientes/activos
  const topClientes = clientes.slice(0, 12);
  const ids = topClientes.map(c => c.id);

  // Precargar ciclos de estos clientes
  for (const c of topClientes) {
    const cs = await safe(`ciclos?cliente_id=eq.${c.id}&order=created_at.desc`);
    const activeCycle = Array.isArray(cs) ? cs.find(x => x.activo) : null;
    const cicloFilter = activeCycle ? `ciclo_id=eq.${activeCycle.id}` : "ciclo_id=is.null";

    // Precargar nutrición y rutinas del ciclo activo
    const ns = await safe(`nutricion?cliente_id=eq.${c.id}&${cicloFilter}`);
    if (ns && ns.length) {
      await safe(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`);
    }
    await safe(`rutinas?cliente_id=eq.${c.id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`);
  }

  return true;
};

/** Detecta el rol de la sesión y precarga los datos correspondientes (máx. cada 3 min). */
export const prefetchSession = async (force = false) => {
  try {
    const last = Number(localStorage.getItem(KEY) || 0);
    if (!force && Date.now() - last < MIN_INTERVAL) return;

    const snap = JSON.parse(localStorage.getItem("flux_session_snapshot") || "null");
    if (!snap) return;

    localStorage.setItem(KEY, String(Date.now()));

    // 1. Si es paciente o atleta civil: precarga completa de sus rutinas y GIFs
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

    // 2. Si es Nutriólogo o Superadmin: precarga de clientes y sus programas
    if (["superadmin", "nutriologo", "nutriologo_estudiante", "staff"].includes(snap.role)) {
      const pId = snap.profileId || snap.data?.id;
      if (pId) {
        await prefetchAdmin(pId, snap.role).catch(() => {});
      }
    }
  } catch { /* ignore */ }
};
