import {
  loadAllCache,
  persistCacheKey,
  persistCacheBatchNow,
  clearCacheStore,
  addMutation,
  getMutations,
  removeMutation,
  countMutations,
  clearMutations,
  syncNativeFlushedMutations,
} from "./offlineStore";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Token de autenticación — se activa al hacer login
let _authToken = null;
let _profileId = null;
let _onSessionExpired = null; // callback para redirigir al login
let _isRefreshing = false;
let _refreshQueue = []; // promesas pendientes mientras se renueva el token

/** Sincroniza credenciales y metadatos de sesión con el WorkManager nativo de Android */
export const syncNativeCredentials = () => {
  try {
    if (typeof window === "undefined" || !window.FluxNativeSync?.saveCredentials) return;
    const accessToken = _authToken || localStorage.getItem("flux_token") || "";
    const refreshToken = localStorage.getItem("flux_refresh_token") || "";
    const profileId = _profileId || localStorage.getItem("flux_profileId") || "";
    const role = localStorage.getItem("flux_role") || "";
    const clientId = localStorage.getItem("flux_client_id") || "";
    const snapRaw = localStorage.getItem("flux_session_snapshot");
    const multiRaw = localStorage.getItem("flux_multi_roles");
    let email = "";
    let nutriologoId = "";
    try {
      const snap = snapRaw ? JSON.parse(snapRaw) : null;
      email = snap?.data?.email || "";
      nutriologoId = snap?.data?.nutriologo_id || "";
    } catch { /* ignore */ }

    if (!accessToken && !refreshToken) return;

    window.FluxNativeSync.saveCredentials(
      JSON.stringify({
        supaUrl: SUPA_URL,
        supaKey: SUPA_KEY,
        accessToken,
        refreshToken,
        profileId,
        role,
        clientId,
        email,
        nutriologoId,
        multiRolesJson: multiRaw || "[]",
      })
    );
  } catch { /* ignore */ }
};

export const setAuthToken = (t) => {
  _authToken = t;
  if (t) localStorage.setItem("flux_token", t);
  else localStorage.removeItem("flux_token");
  syncNativeCredentials();
};

/** Guardar refresh_token al hacer login */
export const saveRefreshToken = (rt) => {
  if (rt) localStorage.setItem("flux_refresh_token", rt);
  else localStorage.removeItem("flux_refresh_token");
  syncNativeCredentials();
};

const withTimeout = (ms) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
};

/** Renovar el access_token silenciosamente usando el refresh_token */
export const refreshSession = async () => {
  // Primero verificar si el WorkManager nativo ya renovó el token recientemente
  try {
    if (typeof window !== "undefined" && window.FluxNativeSync?.getRefreshedTokens) {
      const raw = window.FluxNativeSync.getRefreshedTokens();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.access_token && parsed.access_token !== _authToken) {
          setAuthToken(parsed.access_token);
          if (parsed.refresh_token) saveRefreshToken(parsed.refresh_token);
          return true;
        }
      }
    }
  } catch { /* ignore */ }

  const rt = localStorage.getItem("flux_refresh_token");
  if (!rt) {
    // Si hay token actual aunque sea viejo, en modo offline no cerrar la sesión
    return "OFFLINE";
  }
  const t = withTimeout(10000);
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
      signal: t.signal,
    });
    t.done();
    if (!r.ok) {
      // Errores de red, servidor (5xx), rate limit (429) o portales cautivos NUNCA deben cerrar sesión
      if (r.status >= 500 || r.status === 429 || r.status === 408) return "OFFLINE";
      const errBody = await r.json().catch(() => null);
      if (!errBody) return "OFFLINE"; // Portal cautivo devolvió HTML
      const errCode = String(errBody.error || errBody.error_code || errBody.msg || "").toLowerCase();
      if (errCode.includes("invalid_grant") || errCode.includes("refresh_token_not_found")) {
        // Verificar por segunda vez si el WorkManager nativo rotó el refresh_token en paralelo
        try {
          if (typeof window !== "undefined" && window.FluxNativeSync?.getRefreshedTokens) {
            const raw = window.FluxNativeSync.getRefreshedTokens();
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.access_token) {
                setAuthToken(parsed.access_token);
                if (parsed.refresh_token) saveRefreshToken(parsed.refresh_token);
                return true;
              }
            }
          }
        } catch { /* ignore */ }
        return false;
      }
      return "OFFLINE";
    }
    const d = await r.json();
    if (!d?.access_token) return "OFFLINE";
    setAuthToken(d.access_token);
    if (d.refresh_token) saveRefreshToken(d.refresh_token);
    return true;
  } catch {
    t.done();
    return "OFFLINE";
  }
};

export const getAuthToken = () => _authToken;

/** Restaurar token guardado (llamar al montar App) */
export const restoreSession = () => {
  try {
    if (typeof window !== "undefined" && window.FluxNativeSync?.getRefreshedTokens) {
      const raw = window.FluxNativeSync.getRefreshedTokens();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) {
          localStorage.setItem("flux_token", parsed.access_token);
        }
        if (parsed?.refresh_token) {
          localStorage.setItem("flux_refresh_token", parsed.refresh_token);
        }
      }
    }
  } catch { /* ignore */ }

  const saved = localStorage.getItem("flux_token");
  if (saved) {
    _authToken = saved;
    syncNativeCredentials();
    return saved;
  }
  return null;
};

// ── Caché de Consultas GET (Fuente Única de la Verdad Local-First) ─────────
const queryCache = new Map(); // path -> { data, timestamp, invalidated? }
let _isHydrated = false;
let _hydrationPromise = null;

const persistEntry = (path) => {
  const e = queryCache.get(path);
  persistCacheKey(path, e ? { data: e.data, timestamp: e.timestamp, invalidated: !!e.invalidated } : null);
};

const emitCacheUpdate = (path, table, data) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("flux:cache-updated", { detail: { path, table, data } }));
  } catch { /* ignore */ }
};

/** Aplica el cambio de forma optimista sobre la caché para que la UI lo vea al milisegundo */
const applyOptimistic = (method, path, body) => {
  const [table, query = ""] = path.split("?");
  const m = /(?:^|&)id=eq\.([^&]+)/.exec(query);
  if (!m || (method !== "PATCH" && method !== "DELETE")) return;
  const id = decodeURIComponent(m[1]);
  let patch = null;
  try { patch = typeof body === "string" ? JSON.parse(body) : body; } catch { /* ignore */ }
  for (const [key, entry] of queryCache.entries()) {
    if (key.split("?")[0] !== table || !Array.isArray(entry.data)) continue;
    entry.data = method === "DELETE"
      ? entry.data.filter((r) => String(r?.id) !== id)
      : entry.data.map((r) => (String(r?.id) === id ? { ...r, ...patch } : r));
    persistEntry(key);
  }
};

/** Aplica un upsert (progreso, etc.) sobre las consultas guardadas: lo registrado se ve al instante */
const applyOptimisticUpsert = (path, rows) => {
  const [table, query = ""] = path.split("?");
  const oc = /(?:^|&)on_conflict=([^&]+)/.exec(query);
  const keys = oc ? decodeURIComponent(oc[1]).split(",") : ["id"];
  for (const [key, entry] of queryCache.entries()) {
    if (key.split("?")[0] !== table || !Array.isArray(entry.data)) continue;
    const kq = key.split("?")[1] || "";
    const cm = /(?:^|&)cliente_id=eq\.([^&]+)/.exec(kq);
    const data = entry.data.slice();
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      if (cm && row.cliente_id != null && String(row.cliente_id) !== cm[1]) continue;
      const idx = keys.includes("id") && row.id == null
        ? -1
        : data.findIndex((r) => keys.every((k) => String(r?.[k] ?? "") === String(row?.[k] ?? "")));
      if (idx >= 0) data[idx] = { ...data[idx], ...row };
      else data.push(row);
    }
    entry.data = data;
    persistEntry(key);
  }
};

/** Reaplica todas las mutaciones pendientes encima de queryCache para proteger ediciones offline ("Push antes de Pull") */
const reapplyPendingMutations = async (filterTable = null) => {
  try {
    const items = await getMutations();
    for (const m of items) {
      if (filterTable && m.table !== filterTable) continue;
      if (m.method === "PATCH" || m.method === "DELETE") {
        applyOptimistic(m.method, m.path, m.body);
      } else if (m.method === "POST" && m.table === "progreso") {
        try {
          const b = JSON.parse(m.body);
          applyOptimisticUpsert(m.path, Array.isArray(b) ? b : [b]);
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
};

/** Incorpora en queryCache e IndexedDB cualquier caché descargada por el WorkManager nativo de Android */
const mergeNativeSyncedCache = async () => {
  try {
    if (typeof window === "undefined" || !window.FluxNativeSync?.getSyncedCache) return false;
    const raw = window.FluxNativeSync.getSyncedCache();
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;

    const batchToPersist = new Map();
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry || !Array.isArray(entry.data)) continue;
      const existing = queryCache.get(key);
      const nativeTs = Number(entry.timestamp || 0);
      if (!existing || nativeTs >= Number(existing.timestamp || 0)) {
        const record = { data: entry.data, timestamp: nativeTs || Date.now(), invalidated: false };
        queryCache.set(key, record);
        batchToPersist.set(key, record);
      }
    }
    if (batchToPersist.size > 0) {
      await persistCacheBatchNow(batchToPersist);
      return true;
    }
  } catch (e) {
    console.warn("[FLUX native cache merge]", e?.message);
  }
  return false;
};

/** Cargar la caché persistida (se garantiza su resolución antes de cualquier dbGet) */
export const hydrateOfflineCache = () => {
  if (_hydrationPromise) return _hydrationPromise;
  _hydrationPromise = (async () => {
    try {
      // Limpieza del antiguo caché en localStorage (límite 5MB)
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("flux_query_cache")) localStorage.removeItem(key);
      });
    } catch { /* ignore */ }

    try {
      // 1. Sincronizar mutaciones ya subidas por el WorkManager nativo con la app cerrada
      await syncNativeFlushedMutations();

      // 2. Cargar toda la base de datos local desde IndexedDB
      const rows = await loadAllCache();
      rows.forEach((r) => {
        if (!queryCache.has(r.key)) {
          queryCache.set(r.key, {
            data: r.data,
            timestamp: r.timestamp || Date.now(),
            invalidated: !!r.invalidated,
          });
        }
      });

      // 3. Fusionar los datos más recientes descargados en segundo plano por el WorkManager nativo de Android
      await mergeNativeSyncedCache();

      // 4. Reaplicar cualquier mutación pendiente local encima para no perder ediciones hechas offline
      await reapplyPendingMutations();
    } catch (e) {
      console.warn("[FLUX hydrate]", e?.message);
    } finally {
      _isHydrated = true;
    }
  })();
  return _hydrationPromise;
};

// Callback global invocado por Android cuando el WorkManager termina una sincronización con la app abierta
if (typeof window !== "undefined") {
  window.__onFluxNativeSync = async () => {
    await syncNativeFlushedMutations();
    const updated = await mergeNativeSyncedCache();
    await reapplyPendingMutations();
    if (updated) {
      emitCacheUpdate("*", "*", null);
    }
  };
}

/** Marca como obsoleta (NO borra): así el dato sigue disponible en 0 ms pero se refresca en segundo plano. */
export const invalidateCache = (table) => {
  for (const [key, entry] of queryCache.entries()) {
    if (!table || key.split("?")[0] === table) {
      entry.invalidated = true;
      persistEntry(key);
    }
  }
};

/** Borrar todo el contenido offline (SOLO al cerrar sesión explícitamente por el usuario) */
export const clearOfflineData = async () => {
  queryCache.clear();
  try {
    if (typeof window !== "undefined" && window.FluxNativeSync?.clearCredentials) {
      window.FluxNativeSync.clearCredentials();
    }
  } catch { /* ignore */ }
  await Promise.all([clearCacheStore(), clearMutations()]);
};

export const onSessionExpired = (cb) => { _onSessionExpired = cb; };

// Estado de red "conocido": se marca caído al primer fallo de fetch y se limpia al primer éxito.
let _netDown = false;
let _lastRetry = 0;
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { _netDown = false; });
  window.addEventListener("offline", () => { _netDown = true; });
}

const isOfflineNow = () => typeof navigator !== "undefined" && navigator.onLine === false;

// Tablas cuyo POST es seguro de encolar offline
const QUEUEABLE_POST = ["progreso", "citas_ratings", "notificaciones", "metricas_progreso", "solicitudes_entrenamiento"];

const isQueueable = (method, table) => {
  if (table.startsWith("rpc/")) return false;
  if (method === "PATCH" || method === "DELETE") return true;
  if (method === "POST") return QUEUEABLE_POST.includes(table);
  return false;
};

const queueMutation = async (method, path, body, prefer) => {
  const table = path.split("?")[0];
  await addMutation({ method, path, body: body ?? null, prefer: prefer ?? null, table });
  applyOptimistic(method, path, body);
  if (method === "POST" && table === "progreso") {
    try { const b = JSON.parse(body); applyOptimisticUpsert(path, Array.isArray(b) ? b : [b]); } catch { /* ignore */ }
  }
};

// ── Función base de petición (Arquitectura Local-First / Single Source of Truth) ──
const q = async (path, opts = {}, onBackgroundUpdate = null) => {
  if (!_isHydrated) {
    await hydrateOfflineCache();
  }

  const method = (opts.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const table = path.split("?")[0];
  let returnedCache = false;

  const fetchNetwork = async () => {
    const { headers: extraHeaders, upsert, force, ...restOpts } = opts;
    const prefer = upsert ? "resolution=merge-duplicates,return=representation" : "return=representation";
    const headers = {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${_authToken || SUPA_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer,
      ...extraHeaders,
    };
    let r;
    const t = withTimeout(isGet ? (queryCache.has(path) ? 5000 : 12000) : 25000);
    try {
      if (isOfflineNow() || (_netDown && !isGet && isQueueable(method, table))) throw new Error("OFFLINE");
      r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers, ...restOpts, signal: t.signal });
      t.done();
      _netDown = false;
    } catch {
      t.done();
      _netDown = true;
      if (isGet) {
        const cached = queryCache.get(path);
        if (cached && !returnedCache) return cached.data;
      } else if (isQueueable(method, table)) {
        await queueMutation(method, path, restOpts.body, headers.Prefer);
        let echo = [];
        try { const b = restOpts.body ? JSON.parse(restOpts.body) : []; echo = Array.isArray(b) ? b : [b]; } catch { /* ignore */ }
        return method === "POST" ? echo : [];
      }
      if (returnedCache) return;
      throw new Error("OFFLINE");
    }

    // Interceptar 401 — renovar token de forma segura sin destruir jamás la caché offline
    if (r.status === 401 && _authToken) {
      let ok;
      if (!_isRefreshing) {
        _isRefreshing = true;
        ok = await refreshSession();
        _isRefreshing = false;
        _refreshQueue.forEach((resolve) => resolve(ok));
        _refreshQueue = [];
      } else {
        ok = await new Promise((res) => _refreshQueue.push(res));
      }

      if (ok === "OFFLINE" || !ok) {
        if (returnedCache) return;
        if (isGet && queryCache.has(path)) return queryCache.get(path).data;
        if (!isGet && isQueueable(method, table)) {
          await queueMutation(method, path, restOpts.body, headers.Prefer);
          let echo = [];
          try { const b = restOpts.body ? JSON.parse(restOpts.body) : []; echo = Array.isArray(b) ? b : [b]; } catch { /* ignore */ }
          return method === "POST" ? echo : [];
        }
        throw new Error("OFFLINE");
      }
      return fetchNetwork();
    }

    if (opts.headers?.Prefer === "return=minimal" && r.ok) return [];
    if (!r.ok) {
      if (returnedCache) return;
      // En lectura, cualquier fallo HTTP devuelve el último dato bueno de la base local si existe
      if (isGet && queryCache.has(path)) return queryCache.get(path).data;
      const e = await r.text().catch(() => "Error de red");
      throw new Error(e);
    }

    let data;
    try {
      const txt = await r.text();
      data = txt ? JSON.parse(txt) : [];
    } catch {
      // Si un portal cautivo de Wi-Fi devuelve HTML en vez de JSON, tratar como OFFLINE y usar caché local
      _netDown = true;
      if (returnedCache) return;
      if (isGet && queryCache.has(path)) return queryCache.get(path).data;
      throw new Error("OFFLINE");
    }

    if (isGet) {
      const prevCached = queryCache.get(path);
      const prevJson = prevCached ? JSON.stringify(prevCached.data) : null;

      queryCache.set(path, { data, timestamp: Date.now(), invalidated: false });
      // Proteger cambios hechos en offline que aún estén en la cola de salida ("Push antes de Pull")
      await reapplyPendingMutations(table);

      const finalData = queryCache.get(path)?.data ?? data;
      const isDifferent = !prevCached || prevJson !== JSON.stringify(finalData);

      if (isDifferent || prevCached?.invalidated) persistEntry(path);

      if (returnedCache && isDifferent) {
        if (onBackgroundUpdate) onBackgroundUpdate(finalData);
        emitCacheUpdate(path, table, finalData);
      }
      return finalData;
    }
    return data;
  };

  if (isGet) {
    const cached = opts.force ? null : queryCache.get(path);
    if (cached) {
      // PATRÓN LOCAL-FIRST (Estilo WhatsApp):
      // Siempre respondemos en 0 ms desde la base de datos interna del teléfono.
      // Si hay conexión y la caché tiene > 8 segundos o fue marcada obsoleta, actualizamos en segundo plano.
      if (!isOfflineNow()) {
        const age = Date.now() - (cached.timestamp || 0);
        if (_netDown) {
          if (Date.now() - _lastRetry > 5000) {
            _lastRetry = Date.now();
            returnedCache = true;
            fetchNetwork().catch(() => {});
          }
        } else if (cached.invalidated || age > 8000) {
          returnedCache = true;
          fetchNetwork().catch(() => {});
        }
      }
      return cached.data;
    }
  } else {
    // En mutaciones (PATCH / DELETE), actualizar optimísticamente la caché local de inmediato (online y offline)
    if (method === "PATCH" || method === "DELETE") {
      applyOptimistic(method, path, opts.body);
    }
    invalidateCache(table);
  }

  return fetchNetwork();
};

// ── Normalizar llaves en inserciones masivas para evitar error PGRST102 ──
const normalizeBatchKeys = (data) => {
  if (!Array.isArray(data) || data.length <= 1) return data;
  const allKeys = new Set();
  for (const item of data) {
    if (item && typeof item === "object") {
      Object.keys(item).forEach((k) => allKeys.add(k));
    }
  }
  return data.map((item) => {
    if (!item || typeof item !== "object") return item;
    const normalized = {};
    for (const key of allKeys) {
      normalized[key] = item[key] !== undefined ? item[key] : null;
    }
    return normalized;
  });
};

// ── Operaciones de base de datos ──
export const dbGet = (p, onBgUpdate) => q(p, {}, onBgUpdate);
export const dbPost = (p, b, opts = {}) => q(p, { method: "POST", body: JSON.stringify(normalizeBatchKeys(b)), ...opts });
export const dbPatch = (p, b) => q(p, { method: "PATCH", body: JSON.stringify(b), headers: { Prefer: "return=representation" } });
export const dbGetFresh = (p) => q(p, { force: true });
export const dbDel = (p) => q(p, { method: "DELETE" });

export const dbUpsert = async (p, b) => {
  if (!_isHydrated) {
    await hydrateOfflineCache();
  }
  const normalizedBody = normalizeBatchKeys(b);
  const rows = Array.isArray(normalizedBody) ? normalizedBody : [normalizedBody];
  const table = p.split("?")[0];

  // Actualización Optimista Inmediata en la base local (tanto online como offline)
  applyOptimisticUpsert(p, rows);
  invalidateCache(table);

  const prefer = "resolution=merge-duplicates,return=representation";
  const body = JSON.stringify(normalizedBody);
  const queueIt = async () => {
    await addMutation({ method: "POST", path: p, body, prefer, table });
    return rows;
  };
  if (isOfflineNow() || _netDown) return queueIt();
  let r;
  const t = withTimeout(25000);
  try {
    r = await fetch(`${SUPA_URL}/rest/v1/${p}`, {
      method: "POST",
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${_authToken || SUPA_KEY}`,
        "Content-Type": "application/json",
        Prefer: prefer,
      },
      body,
      signal: t.signal,
    });
    t.done();
    _netDown = false;
  } catch {
    t.done();
    _netDown = true;
    return queueIt(); // Sin conexión: queda en cola para enviarse al recuperar señal
  }
  // Interceptar 401 en upsert — renovar token silenciosamente; si falla, encolar para no perder jamás el registro
  if (r.status === 401 && _authToken) {
    const ok = await refreshSession();
    if (ok !== true) return queueIt();
    return dbUpsert(p, normalizedBody);
  }
  if (!r.ok) {
    if (r.status >= 500 || r.status === 408 || r.status === 429) return queueIt();
    const e = await r.text();
    throw new Error(e);
  }
  const txt = await r.text();
  try {
    return txt ? JSON.parse(txt) : [];
  } catch {
    return queueIt();
  }
};

// ── Sincronización en segundo plano ("Push antes de Pull") ──
let _flushingPromise = null;

/** Envía a Supabase las escrituras guardadas sin internet (en estricto orden FIFO). */
export const flushMutations = async () => {
  if (!_isHydrated) await hydrateOfflineCache();
  if (isOfflineNow()) return 0;
  if (_flushingPromise) return _flushingPromise;

  _flushingPromise = (async () => {
    let sent = 0;
    const touched = new Set();
    try {
      const items = await getMutations();
      for (const m of items) {
        let r;
        const t = withTimeout(20000);
        try {
          const send = () =>
            fetch(`${SUPA_URL}/rest/v1/${m.path}`, {
              method: m.method,
              headers: {
                apikey: SUPA_KEY,
                Authorization: `Bearer ${_authToken || SUPA_KEY}`,
                "Content-Type": "application/json",
                ...(m.prefer ? { Prefer: m.prefer } : {}),
              },
              body: m.body ?? undefined,
              signal: t.signal,
            });
          r = await send();
          if (r.status === 401) {
            const ok = await refreshSession();
            if (ok !== true) {
              t.done();
              break; // sin sesión renovada o sin red: conservar en cola para reintentar luego
            }
            r = await send();
          }
          t.done();
        } catch {
          t.done();
          _netDown = true;
          break; // sin red: conservar en cola para reintentar luego
        }
        _netDown = false;
        if (r.status === 401 || r.status === 408 || r.status === 429 || r.status >= 500) break;
        if (!r.ok) console.warn("[FLUX offline] Mutación descartada:", r.status, m.method, m.path);
        await removeMutation(m.id);
        touched.add(m.table);
        sent++;
      }
    } finally {
      _flushingPromise = null;
    }
    if (sent) {
      touched.forEach((t) => invalidateCache(t));
      try {
        window.dispatchEvent(new CustomEvent("flux:synced", { detail: { tables: [...touched] } }));
      } catch { /* ignore */ }
    }
    return sent;
  })();

  return _flushingPromise;
};

/** Refresca en segundo plano las consultas guardadas que ya están viejas (mantiene el dato "al día"). */
export const refreshStaleCache = async (maxAgeMs = 90000, limit = 30) => {
  if (!_authToken || isOfflineNow()) return;
  if (_flushingPromise) await _flushingPromise;
  const stale = [...queryCache.entries()]
    .filter(([k, v]) => !k.startsWith("rpc/") && (v.invalidated || Date.now() - v.timestamp > maxAgeMs))
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .slice(0, limit);
  for (const [path] of stale) {
    try {
      await q(path, { force: true });
    } catch {
      if (isOfflineNow() || _netDown) break;
    }
  }
};

export const getPendingMutations = countMutations;

export const storageUpload = async (bucket, path, file) => {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${_authToken || SUPA_KEY}`, "Content-Type": file.type },
    body: file,
  });
  if (!r.ok) {
    const e = await r.text();
    throw new Error(e);
  }
  return `${SUPA_URL}/storage/v1/object/public/${bucket}/${path}`;
};

export const storageDelete = async (bucket, path) => {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "DELETE",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${_authToken || SUPA_KEY}` },
  });
  if (!r.ok) {
    const e = await r.text();
    throw new Error(e);
  }
};

export const storageListFolder = async (bucket, prefix) => {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${_authToken || SUPA_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix }),
  });
  if (!r.ok) return [];
  return await r.json();
};

export const storageRemoveMany = async (bucket, prefixes) => {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${_authToken || SUPA_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes }),
  });
  if (!r.ok) {
    const e = await r.text();
    throw new Error(e);
  }
};

// ── Multi-tenancy: Profile del usuario logueado ──
export const setProfileId = (id) => {
  _profileId = id;
  if (id) localStorage.setItem("flux_profileId", id);
  else localStorage.removeItem("flux_profileId");
  syncNativeCredentials();
};
export const getProfileId = () => _profileId;

/** Restaurar profileId guardado */
export const restoreProfileId = () => {
  const saved = localStorage.getItem("flux_profileId");
  if (saved) {
    _profileId = saved;
    return saved;
  }
  return null;
};

// Obtener lista de nutriólogos (solo superadmin)
export const getNutriologos = () =>
  dbGet("profiles?role=eq.nutriologo&select=id,nombre,nombre_marca,email,telefono,color_primario,logo_url,activo&order=nombre.asc");

// Actualizar perfil (nombre, marca, color, rol)
export const updateProfile = (id, data) => dbPatch(`profiles?id=eq.${id}`, data);

// ── Autenticación ──
export const authSignIn = async (email, password) => {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.msg || "Error de autenticación");
  if (d.refresh_token) saveRefreshToken(d.refresh_token);
  return d;
};

export const authSignUp = async (email, password, nombre) => {
  const redirectUrl =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? `${window.location.origin}/login`
      : "https://flux-sport.com/login";

  const r = await fetch(`${SUPA_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectUrl)}`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { nombre } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || d.error_description || d.message || "Error registrando cuenta");

  if (d.session) {
    if (d.session.refresh_token) saveRefreshToken(d.session.refresh_token);
    if (d.session.access_token) setAuthToken(d.session.access_token);
  }
  return d;
};

export const authInvite = async (email, extraData = {}) => {
  const r = await fetch(`${SUPA_URL}/functions/v1/invite-user`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${_authToken || SUPA_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, ...extraData }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Error al invitar usuario");
  return d;
};

export const authResetPassword = async (email) => {
  const redirectUrl =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? `${window.location.origin}/login`
      : "https://flux-sport.com/login";

  const r = await fetch(`${SUPA_URL}/auth/v1/recover`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, redirect_to: redirectUrl }),
  });
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    const rawMsg = errData.msg || errData.error_description || errData.message || "";
    if (r.status === 429 || rawMsg.toLowerCase().includes("rate limit") || rawMsg.toLowerCase().includes("security purposes")) {
      throw new Error("Por seguridad, espera 60 segundos antes de solicitar otro enlace al mismo correo.");
    }
    throw new Error(rawMsg || "Error al enviar email de recuperación");
  }
};

export const authUpdatePassword = async (token, password) => {
  if (!token) {
    throw new Error("La sesión de recuperación expiró. Solicita un nuevo enlace con '¿Olvidaste tu contraseña?'.");
  }
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    const rawMsg = errData.msg || errData.error_description || errData.message || "";
    if (r.status === 401 || r.status === 403 || rawMsg.toLowerCase().includes("expired") || rawMsg.toLowerCase().includes("invalid")) {
      throw new Error("El enlace ya expiró. Por favor solicita uno nuevo en '¿Olvidaste tu contraseña?'.");
    }
    if (rawMsg.toLowerCase().includes("same_password") || rawMsg.toLowerCase().includes("different from the old")) {
      throw new Error("La nueva contraseña debe ser diferente a la anterior.");
    }
    throw new Error(rawMsg || "Error al actualizar contraseña");
  }
  return await r.json().catch(() => ({}));
};

export const captureAuthHashSynchronously = (isAppMode = false) => {
  if (typeof window === "undefined") return false;

  const rawHash = window.location.hash || "";
  const rawSearch = window.location.search || "";
  const combined = `${rawHash}&${rawSearch}`;

  const hasAuthCallback =
    combined.includes("access_token=") ||
    combined.includes("error_description=") ||
    combined.includes("error=access_denied") ||
    combined.includes("error=unauthorized_client") ||
    combined.includes("error_code=otp_expired");

  if (!hasAuthCallback) return false;

  const hashQuery = rawHash
    .replace(/^#\/[^#?]*[#?]?/, "")
    .replace(/^#/, "");
  const searchQuery = rawSearch.replace(/^\?/, "");
  const fullQuery = [hashQuery, searchQuery].filter(Boolean).join("&");
  const params = new URLSearchParams(fullQuery);

  const token = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type") || "recovery";
  const errorDesc = params.get("error_description");
  const errorCode = params.get("error_code");
  const errorType = params.get("error");

  setAuthToken(null);
  setProfileId(null);
  saveRefreshToken(null);
  localStorage.removeItem("flux_role");
  localStorage.removeItem("flux_client_id");
  localStorage.removeItem("flux_multi_roles");
  sessionStorage.removeItem("flux_atleta_data");
  sessionStorage.removeItem("flux_admin_tab");
  sessionStorage.removeItem("flux_cliente_tab");
  sessionStorage.removeItem("flux_programar_subtab");
  sessionStorage.removeItem("flux_admin_selected_client");

  if (token) {
    let decodedEmail = "";
    try {
      const base64Url = token.split(".")[1];
      if (base64Url) {
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        const payload = JSON.parse(jsonPayload);
        if (payload.email) decodedEmail = payload.email;
      }
    } catch { /* ignore */ }

    if (decodedEmail) {
      sessionStorage.setItem("flux_login_email", decodedEmail);
    }
    sessionStorage.removeItem("flux_pending_auth_error");

    if (type === "signup") {
      sessionStorage.removeItem("flux_pending_auth_token");
      sessionStorage.removeItem("flux_pending_auth_type");
      sessionStorage.setItem(
        "flux_pending_auth_info",
        "¡Correo confirmado exitosamente! Ya puedes iniciar sesión con tu contraseña."
      );
      sessionStorage.setItem("flux_login_mode", "login");
    } else {
      sessionStorage.setItem("flux_pending_auth_token", token);
      sessionStorage.setItem("flux_pending_auth_type", type);
      if (refreshToken) {
        sessionStorage.setItem("flux_pending_auth_refresh", refreshToken);
      }
      sessionStorage.removeItem("flux_pending_auth_info");
      sessionStorage.setItem("flux_login_mode", "set_password");
    }
  } else if (errorDesc || errorCode || errorType) {
    sessionStorage.removeItem("flux_pending_auth_token");
    sessionStorage.removeItem("flux_pending_auth_type");
    sessionStorage.removeItem("flux_pending_auth_info");
    sessionStorage.setItem(
      "flux_pending_auth_error",
      "Este enlace ya expiró o ya fue utilizado (recuerda que los enlaces de correo son de un solo uso). Ingresa tu correo abajo para enviarte un enlace nuevo."
    );
    sessionStorage.setItem("flux_login_mode", "reset");
  }

  try {
    if (isAppMode) {
      window.history.replaceState(null, "", window.location.pathname + "#/login");
    } else {
      window.history.replaceState(null, "", "/login");
    }
  } catch { /* ignore */ }

  return true;
};

export const dbPostMinimal = (p, b) => q(p, { method: "POST", body: JSON.stringify(normalizeBatchKeys(b)), headers: { Prefer: "return=minimal" } });

/** Sincroniza datos personales universales en todas las identidades del usuario */
export const syncPersonalData = async (email, data) => {
  if (!email) return;

  const profileFields = ["nombre", "telefono", "email", "avatar_url", "firma_url", "fecha_nacimiento", "genero", "pais", "estado_provincia"];
  const clienteFields = ["nombre", "telefono", "email", "avatar_url", "fecha_nacimiento", "genero", "pais", "estado_provincia", "objetivo"];

  const dataForProfile = {};
  const dataForCliente = {};

  const sanitizedData = { ...data };
  if (sanitizedData.fecha_nacimiento === "") {
    sanitizedData.fecha_nacimiento = null;
  }

  Object.keys(sanitizedData).forEach((k) => {
    if (profileFields.includes(k)) dataForProfile[k] = sanitizedData[k];
    if (clienteFields.includes(k)) dataForCliente[k] = sanitizedData[k];
  });

  const promises = [];
  if (Object.keys(dataForProfile).length > 0) {
    promises.push(dbPatch(`profiles?email=ilike.${email}`, dataForProfile));
  }
  if (Object.keys(dataForCliente).length > 0) {
    promises.push(dbPatch(`clientes?email=ilike.${email}`, dataForCliente));
  }

  await Promise.all(promises);
};
