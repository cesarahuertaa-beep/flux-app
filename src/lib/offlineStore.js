import Dexie from "dexie";

/**
 * Almacén offline persistente (IndexedDB vía Dexie) + Espejo con WorkManager nativo de Android.
 *  - cache:     últimas respuestas GET (sin expiración; Fuente Única de la Verdad Local-First)
 *  - mutations: cola de escrituras hechas sin internet, enviadas en orden FIFO (Push antes de Pull)
 */
const odb = new Dexie("FluxOfflineV2");
odb.version(1).stores({
  cache: "key, timestamp",
  mutations: "++id, table",
});

// Capacidad amplia para que el prefetch masivo de clientes nunca desaloje las consultas principales
const MAX_CACHE_ENTRIES = 5000;

// Tablas troncales que jamás deben ser purgadas por antigüedad
const PROTECTED_TABLES = new Set([
  "profiles",
  "clientes",
  "ciclos",
  "nutricion",
  "nutricion_dias",
  "comidas",
  "rutinas",
  "ejercicios",
  "biblioteca_ejercicios",
]);

const isProtectedKey = (key) => {
  if (!key || typeof key !== "string") return false;
  const table = key.split("?")[0];
  return PROTECTED_TABLES.has(table);
};

// ── Caché ──────────────────────────────────────────────────────────────────
export const loadAllCache = async () => {
  try { return await odb.cache.toArray(); } catch { return []; }
};

let _dirty = new Map();   // key -> entry | null (null = borrar)
let _timer = null;

export const flushCacheNow = async () => {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
  if (_dirty.size === 0) return;
  const batch = _dirty;
  _dirty = new Map();
  const puts = [];
  const dels = [];
  batch.forEach((v, k) => (v ? puts.push({ key: k, ...v }) : dels.push(k)));
  try {
    if (puts.length) await odb.cache.bulkPut(puts);
    if (dels.length) await odb.cache.bulkDelete(dels);
    const total = await odb.cache.count();
    if (total > MAX_CACHE_ENTRIES) {
      const excess = total - MAX_CACHE_ENTRIES;
      const oldest = await odb.cache.orderBy("timestamp").limit(excess * 3).primaryKeys();
      const removable = oldest.filter((k) => !isProtectedKey(k)).slice(0, excess);
      if (removable.length) await odb.cache.bulkDelete(removable);
    }
  } catch (e) {
    console.warn("[FLUX offline] No se pudo persistir caché:", e?.message);
  }
};

/** entry = { data, timestamp, invalidated? } ; entry=null elimina la clave */
export const persistCacheKey = (key, entry) => {
  _dirty.set(key, entry);
  if (!_timer) _timer = setTimeout(flushCacheNow, 80);
};

/** Persiste un lote completo de entradas inmediatamente (ej. desde el WorkManager nativo) */
export const persistCacheBatchNow = async (entriesMap) => {
  if (!entriesMap || entriesMap.size === 0) return;
  entriesMap.forEach((v, k) => _dirty.set(k, v));
  await flushCacheNow();
};

export const clearCacheStore = async () => {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
  _dirty = new Map();
  try { await odb.cache.clear(); } catch { /* ignore */ }
};

// Asegurar volcado inmediato a disco si la app pasa a segundo plano o se cierra
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { flushCacheNow(); });
  window.addEventListener("beforeunload", () => { flushCacheNow(); });
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCacheNow();
  });
}

// ── Sincronización de Cola de Mutaciones con Android WorkManager Nativo ────
const mirrorMutationsToNative = async () => {
  try {
    if (typeof window === "undefined" || !window.FluxNativeSync?.setPendingMutations) return;
    const all = await odb.mutations.orderBy("id").toArray();
    window.FluxNativeSync.setPendingMutations(JSON.stringify(all));
  } catch { /* ignore */ }
};

/** Elimina de IndexedDB las mutaciones que el WorkManager nativo ya subió con la app cerrada */
export const syncNativeFlushedMutations = async () => {
  try {
    if (typeof window === "undefined" || !window.FluxNativeSync?.consumeFlushedMutationIds) return 0;
    const raw = window.FluxNativeSync.consumeFlushedMutationIds();
    if (!raw) return 0;
    const ids = JSON.parse(raw);
    if (Array.isArray(ids) && ids.length > 0) {
      await odb.mutations.bulkDelete(ids);
      await mirrorMutationsToNative();
      return ids.length;
    }
  } catch { /* ignore */ }
  return 0;
};

// ── Cola de mutaciones ─────────────────────────────────────────────────────
export const addMutation = async (m) => {
  const id = await odb.mutations.add({ ...m, created_at: Date.now() });
  await mirrorMutationsToNative();
  return id;
};

export const getMutations = async () => {
  await syncNativeFlushedMutations();
  try { return await odb.mutations.orderBy("id").toArray(); } catch { return []; }
};

export const removeMutation = async (id) => {
  await odb.mutations.delete(id);
  await mirrorMutationsToNative();
};

export const countMutations = async () => {
  await syncNativeFlushedMutations();
  try { return await odb.mutations.count(); } catch { return 0; }
};

export const clearMutations = async () => {
  try { await odb.mutations.clear(); } catch { /* ignore */ }
  await mirrorMutationsToNative();
};
