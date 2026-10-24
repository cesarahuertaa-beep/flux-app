import Dexie from "dexie";

/**
 * Almacén offline persistente (IndexedDB vía Dexie).
 *  - cache:     últimas respuestas GET (sin expiración; solo se refrescan)
 *  - mutations: cola de escrituras hechas sin internet, que se envían al volver la conexión
 */
const odb = new Dexie("FluxOfflineV2");
odb.version(1).stores({
  cache: "key, timestamp",
  mutations: "++id, table",
});

const MAX_CACHE_ENTRIES = 400;

// ── Caché ──────────────────────────────────────────────────────────────────
export const loadAllCache = async () => {
  try { return await odb.cache.toArray(); } catch { return []; }
};

let _dirty = new Map();   // key -> entry | null (null = borrar)
let _timer = null;

const flushCache = async () => {
  _timer = null;
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
      const old = await odb.cache.orderBy("timestamp").limit(total - MAX_CACHE_ENTRIES).primaryKeys();
      await odb.cache.bulkDelete(old);
    }
  } catch (e) {
    console.warn("[FLUX offline] No se pudo persistir caché:", e?.message);
  }
};

/** entry = { data, timestamp, invalidated? } ; entry=null elimina la clave */
export const persistCacheKey = (key, entry) => {
  _dirty.set(key, entry);
  if (!_timer) _timer = setTimeout(flushCache, 300);
};

export const clearCacheStore = async () => {
  _dirty = new Map();
  try { await odb.cache.clear(); } catch { /* ignore */ }
};

// ── Cola de mutaciones ─────────────────────────────────────────────────────
export const addMutation = (m) => odb.mutations.add({ ...m, created_at: Date.now() });
export const getMutations = () => odb.mutations.orderBy("id").toArray();
export const removeMutation = (id) => odb.mutations.delete(id);
export const countMutations = async () => { try { return await odb.mutations.count(); } catch { return 0; } };
export const clearMutations = async () => { try { await odb.mutations.clear(); } catch { /* ignore */ } };
