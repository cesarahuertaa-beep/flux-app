import { dbGetFresh } from "./supabase";

const KEY = "flux_last_prefetch";
const MIN_INTERVAL = 3 * 60 * 1000;

const safe = async (p) => {
  try { return await dbGetFresh(p); } catch { return null; }
};

/**
 * Precarga (con internet) TODO lo que las pantallas del paciente/atleta consultan,
 * con las mismas rutas que usan, para que quede disponible sin conexión aunque
 * nunca haya abierto esa pestaña. Se guarda en la base local (IndexedDB).
 */
export const prefetchCliente = async (cliente) => {
  if (!cliente?.id) return false;
  const id = cliente.id;
  const nutriId = cliente.nutriologo_id;

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
  if (ns && ns.length) await safe(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`);

  const rs = await safe(`rutinas?cliente_id=eq.${id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`);
  const ids = (rs || []).flatMap((r) => (r.ejercicios || []).map((e) => e.id));
  if (ids.length) await safe(`progreso?cliente_id=eq.${id}&ejercicio_id=in.(${ids.join(",")})&limit=3000`);

  // Pestaña Progreso
  await safe(`rutinas?cliente_id=eq.${id}&select=id,ciclo_id,ejercicios(id,grupo_muscular)`);
  await safe(`progreso?cliente_id=eq.${id}&limit=3000`);

  // Pestaña Citas
  if (nutriId) {
    await safe(`citas?cliente_id=eq.${id}&order=fecha_hora.desc&select=id,fecha_hora,modalidad,estado,motivo_rechazo`);
    await safe(`disponibilidad?nutriologo_id=eq.${nutriId}&order=dia_semana.asc`);
    await safe(`citas_ratings?cliente_id=eq.${id}&select=cita_id,puntuacion`);
  }
  return true;
};

/** Detecta qué perfiles de paciente/atleta tiene esta sesión y los precarga (máx. cada 3 min). */
export const prefetchSession = async (force = false) => {
  try {
    const last = Number(localStorage.getItem(KEY) || 0);
    if (!force && Date.now() - last < MIN_INTERVAL) return;
    const clientes = new Map();
    const snap = JSON.parse(localStorage.getItem("flux_session_snapshot") || "null");
    if (snap && (snap.role === "cliente" || snap.role === "civil") && snap.data?.id) clientes.set(snap.data.id, snap.data);
    const multi = snap?.multiRoles || JSON.parse(localStorage.getItem("flux_multi_roles") || "null") || [];
    multi.forEach((r) => { if (r.role === "cliente" && r.data?.id) clientes.set(r.data.id, r.data); });
    if (!clientes.size) return;
    localStorage.setItem(KEY, String(Date.now()));
    for (const c of clientes.values()) {
      const ok = await prefetchCliente(c);
      if (!ok) { localStorage.setItem(KEY, "0"); break; }
    }
  } catch { /* ignore */ }
};
