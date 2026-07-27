/**
 * offlineQueue.js
 * Cola de escrituras pendientes para atletas sin conexión.
 * Usa IndexedDB nativo — sin dependencias externas.
 */

const DB_NAME    = 'flux_offline';
const STORE      = 'progress_queue';
const DB_VERSION = 1;

let _db = null;

// ── Abrir / inicializar la BD ──────────────────────────────────────────────
const openDB = () => new Promise((resolve, reject) => {
  if (_db) return resolve(_db);
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE, { keyPath: '_qid', autoIncrement: true });
    }
  };
  req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
  req.onerror    = (e) => reject(e.target.error);
});

// ── Agregar un registro a la cola ──────────────────────────────────────────
export const enqueue = async (record) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({
      ...record,
      _queued_at: new Date().toISOString(),
    });
    req.onsuccess = resolve;
    req.onerror   = (e) => reject(e.target.error);
  });
};

// ── Obtener todos los registros pendientes ─────────────────────────────────
export const getAll = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = (e) => reject(e.target.error);
  });
};

// ── Limpiar la cola después de sincronizar ─────────────────────────────────
export const clearAll = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
};

// ── Cuántos registros están pendientes ────────────────────────────────────
export const getPendingCount = async () => {
  const items = await getAll();
  return items.length;
};

/**
 * syncQueue — Intenta subir todos los registros pendientes a Supabase.
 * @param {Function} upsertFn — la función dbUpsert del módulo supabase.js
 * Se llama automáticamente cuando el dispositivo recupera internet.
 */
export const syncQueue = async (upsertFn) => {
  if (!navigator.onLine) return;
  let items;
  try { items = await getAll(); } catch { return; }
  if (!items.length) return;

  // Quitar campos internos de la cola antes de enviar a Supabase
  const records = items.map(({ _qid, _queued_at, ...rest }) => rest);

  try {
    await upsertFn(
      'progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo',
      records
    );
    await clearAll();
  } catch (e) {
    // Si falla (sin internet aún), se reintentará en el próximo evento online
    console.warn('[FLUX offline] Sync falló, se reintentará:', e.message);
  }
};
