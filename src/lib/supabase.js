import { loadAllCache, persistCacheKey, clearCacheStore, addMutation, getMutations, removeMutation, countMutations, clearMutations } from "./offlineStore";
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Token de autenticación — se activa al hacer login
let _authToken = null;
let _onSessionExpired = null; // callback para redirigir al login
let _isRefreshing = false;
let _refreshQueue = []; // promesas pendientes mientras se renueva el token

export const setAuthToken = (t) => {
  _authToken = t;
  if (t) localStorage.setItem("flux_token", t);
  else  localStorage.removeItem("flux_token");
};

/** Guardar refresh_token al hacer login */
export const saveRefreshToken = (rt) => {
  if (rt) localStorage.setItem("flux_refresh_token", rt);
  else   localStorage.removeItem("flux_refresh_token");
};

/** Renovar el access_token silenciosamente usando el refresh_token */
export const refreshSession = async () => {
  const rt = localStorage.getItem("flux_refresh_token");
  if (!rt) return false;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return false;
    const d = await r.json();
    setAuthToken(d.access_token);
    saveRefreshToken(d.refresh_token);
    return true;
  } catch { 
    return "OFFLINE"; 
  }
};

export const getAuthToken = () => _authToken;

/** Restaurar token guardado (llamar al montar App) */
export const restoreSession = () => {
  const saved = localStorage.getItem("flux_token");
  if (saved) { _authToken = saved; return saved; }
  return null;
};

// ── Caché de Consultas GET (persistente en IndexedDB, sin expiración) ──
// Mantiene siempre los últimos datos obtenidos con internet para poder usarlos offline.
const queryCache = new Map(); // path -> { data, timestamp, invalidated? }

const persistEntry = (path) => {
  const e = queryCache.get(path);
  persistCacheKey(path, e ? { data: e.data, timestamp: e.timestamp, invalidated: !!e.invalidated } : null);
};

/** Cargar la caché persistida (llamar antes de renderizar la app) */
export const hydrateOfflineCache = async () => {
  try {
    // Limpieza del antiguo caché en localStorage (límite 5MB, se borraba al llenarse)
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("flux_query_cache")) localStorage.removeItem(key);
    });
  } catch { /* ignore */ }
  const rows = await loadAllCache();
  rows.forEach((r) => {
    if (!queryCache.has(r.key)) queryCache.set(r.key, { data: r.data, timestamp: r.timestamp, invalidated: !!r.invalidated });
  });
};

/** Marca como obsoleta (NO borra): así el dato sigue disponible offline pero se vuelve a pedir. */
export const invalidateCache = (table) => {
  for (const [key, entry] of queryCache.entries()) {
    if (!table || key.split("?")[0] === table) {
      entry.invalidated = true;
      persistEntry(key);
    }
  }
};

/** Borrar todo el contenido offline (logout / sesión expirada) */
export const clearOfflineData = async () => {
  queryCache.clear();
  await Promise.all([clearCacheStore(), clearMutations()]);
};

export const onSessionExpired = (cb) => { _onSessionExpired = cb; };

// Estado de red "conocido": se marca caído al primer fallo de fetch y se limpia al primer éxito.
// Evita esperar timeouts en cada consulta cuando hay wifi pero no hay internet (gimnasio, sótano...).
let _netDown = false;
let _lastRetry = 0;
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { _netDown = false; });
  window.addEventListener("offline", () => { _netDown = true; });
}

const isOfflineNow = () => typeof navigator !== "undefined" && navigator.onLine === false;

// Tablas cuyo POST es seguro de encolar offline (no se necesita el id devuelto por el servidor)
const QUEUEABLE_POST = ["progreso", "citas_ratings", "notificaciones", "metricas_progreso", "solicitudes_entrenamiento"];

const isQueueable = (method, table) => {
  if (table.startsWith("rpc/")) return false;
  if (method === "PATCH" || method === "DELETE") return true;
  if (method === "POST") return QUEUEABLE_POST.includes(table);
  return false;
};

/** Aplica el cambio de forma optimista sobre la caché para que la UI lo vea sin internet */
const applyOptimistic = (method, path, body) => {
  const [table, query = ""] = path.split("?");
  const m = /(?:^|&)id=eq\.([^&]+)/.exec(query);
  if (!m || (method !== "PATCH" && method !== "DELETE")) return;
  const id = decodeURIComponent(m[1]);
  let patch = null;
  try { patch = body ? JSON.parse(body) : null; } catch { /* ignore */ }
  for (const [key, entry] of queryCache.entries()) {
    if (key.split("?")[0] !== table || !Array.isArray(entry.data)) continue;
    entry.data = method === "DELETE"
      ? entry.data.filter((r) => String(r?.id) !== id)
      : entry.data.map((r) => (String(r?.id) === id ? { ...r, ...patch } : r));
    persistEntry(key);
  }
};

/** Aplica un upsert (progreso, etc.) sobre las consultas guardadas: lo registrado offline se ve al reabrir */
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

const queueMutation = async (method, path, body, prefer) => {
  const table = path.split("?")[0];
  await addMutation({ method, path, body: body ?? null, prefer: prefer ?? null, table });
  applyOptimistic(method, path, body);
  if (method === "POST" && table === "progreso") {
    try { const b = JSON.parse(body); applyOptimisticUpsert(path, Array.isArray(b) ? b : [b]); } catch { /* ignore */ }
  }
};

const withTimeout = (ms) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
};

// ── Función base de petición ──
const q = async (path, opts={}, onBackgroundUpdate=null) => {
  const method = (opts.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const table = path.split('?')[0];
  let returnedCache = false;

  const fetchNetwork = async () => {
    const { headers: extraHeaders, upsert, force, ...restOpts } = opts;
    const prefer = upsert ? "resolution=merge-duplicates,return=representation" : "return=representation";
    const headers = {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${_authToken || SUPA_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer,
      ...extraHeaders
    };
    let r;
    const t = withTimeout(isGet ? (queryCache.has(path) ? 4000 : 15000) : 30000);
    try {
      if (isOfflineNow() || (_netDown && !isGet && isQueueable(method, table))) throw new Error("offline");
      r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers, ...restOpts, signal: t.signal });
      t.done();
      _netDown = false;
    } catch (err) {
      t.done();
      _netDown = true;
      if (isGet) {
        const cached = queryCache.get(path);
        if (cached && !returnedCache) return cached.data;
      } else if (isQueueable(method, table)) {
        // Sin internet: guardar para enviar luego y responder como si hubiera funcionado
        await queueMutation(method, path, restOpts.body, headers.Prefer);
        let echo = [];
        try { const b = restOpts.body ? JSON.parse(restOpts.body) : []; echo = Array.isArray(b) ? b : [b]; } catch { /* ignore */ }
        return method === "POST" ? echo : [];
      }
      if (returnedCache) return; // Ya retornamos caché, morimos silenciosamente
      throw new Error("OFFLINE");
    }

    // Interceptar 401
    if (r.status === 401 && _authToken) {
      if (!_isRefreshing) {
        _isRefreshing = true;
        const ok = await refreshSession();
        _isRefreshing = false;
        _refreshQueue.forEach(resolve => resolve(ok));
        _refreshQueue = [];
        if (ok === "OFFLINE") {
          if (returnedCache) return;
          if (isGet && queryCache.has(path)) return queryCache.get(path).data;
          throw new Error("OFFLINE");
        }
        if (!ok) {
          setAuthToken(null); setProfileId(null); saveRefreshToken(null);
          if (_onSessionExpired) _onSessionExpired();
          if (returnedCache) return;
          throw new Error("Sesión expirada — inicia sesión de nuevo");
        }
      } else {
        await new Promise(res => _refreshQueue.push(res));
      }
      return fetchNetwork();
    }

    if (opts.headers?.Prefer === "return=minimal" && r.ok) return [];
    if (!r.ok) {
      if (returnedCache) return;
      // Error de servidor en lectura: usar último dato bueno si existe
      if (isGet && r.status >= 500 && queryCache.has(path)) return queryCache.get(path).data;
      const e = await r.text(); throw new Error(e);
    }

    const txt = await r.text();
    const data = txt ? JSON.parse(txt) : [];

    if (isGet) {
      const prevCached = queryCache.get(path);
      const isDifferent = !prevCached || JSON.stringify(prevCached.data) !== JSON.stringify(data);

      queryCache.set(path, { data, timestamp: Date.now(), invalidated: false });
      if (isDifferent || prevCached?.invalidated) persistEntry(path);

      // Si la data es diferente a la caché que ya mostramos, actualizamos la UI en silencio
      if (returnedCache && onBackgroundUpdate && isDifferent) {
        onBackgroundUpdate(data);
      }
    }
    return data;
  };

  if (isGet) {
    const cached = opts.force ? null : queryCache.get(path);
    if (cached) {
      // Red conocida como caída: responder al instante con lo guardado y reintentar en segundo plano
      if (_netDown) {
        if (Date.now() - _lastRetry > 5000) {
          _lastRetry = Date.now();
          returnedCache = true;
          fetchNetwork().catch(() => {});
        }
        return cached.data;
      }
      // Caché hiper-reciente (< 15 s) y válida: sin red para no saturar en clics rápidos
      if (!cached.invalidated && Date.now() - cached.timestamp < 15000) {
        return cached.data;
      }
      // SWR: devolvemos caché instantáneo y consultamos en silencio
      if (onBackgroundUpdate && !cached.invalidated) {
        returnedCache = true;
        fetchNetwork().catch(() => {}); // Fuego y olvido
        return cached.data;
      }
    }
  } else {
    invalidateCache(table); // Mutaciones marcan la caché como obsoleta de inmediato
  }

  return fetchNetwork();
};



// ── Normalizar llaves en inserciones masivas para evitar error PGRST102 (All object keys must match) ──
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
export const dbGet    = (p, onBgUpdate) => q(p, {}, onBgUpdate);
export const dbPost   = (p, b, opts = {}) => q(p, { method: "POST", body: JSON.stringify(normalizeBatchKeys(b)), ...opts });
export const dbPatch  = (p, b) => q(p, { method: "PATCH", body: JSON.stringify(b), headers: { Prefer: "return=representation" } });
export const dbGetFresh = (p) => q(p, { force: true });
export const dbDel    = (p)   => q(p, { method: "DELETE" });
export const dbUpsert = async (p, b) => {
  const normalizedBody = normalizeBatchKeys(b);
  const table = p.split('?')[0];
  invalidateCache(table); // Marcar caché obsoleta en upsert
  const prefer = "resolution=merge-duplicates,return=representation";
  const body = JSON.stringify(normalizedBody);
  const queueIt = async () => {
    await addMutation({ method: "POST", path: p, body, prefer, table });
    const rows = Array.isArray(normalizedBody) ? normalizedBody : [normalizedBody];
    applyOptimisticUpsert(p, rows);
    return rows;
  };
  if (isOfflineNow() || _netDown) return queueIt();
  let r;
  const t = withTimeout(30000);
  try {
    r = await fetch(`${SUPA_URL}/rest/v1/${p}`, {
      method: "POST",
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${_authToken || SUPA_KEY}`,
        "Content-Type": "application/json",
        "Prefer": prefer
      },
      body,
      signal: t.signal
    });
    t.done();
  } catch {
    t.done();
    return queueIt(); // Sin conexión: se enviará al recuperarla
  }
  // Interceptar 401 en upsert — renovar token silenciosamente
  if (r.status === 401 && _authToken) {
    const ok = await refreshSession();
    if (ok === "OFFLINE") return queueIt();
    if (!ok) {
      setAuthToken(null); setProfileId(null); saveRefreshToken(null);
      if (_onSessionExpired) _onSessionExpired();
      throw new Error("Sesión expirada — inicia sesión de nuevo");
    }
    // Reintentar con token nuevo
    return dbUpsert(p, normalizedBody);
  }
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const txt = await r.text(); return txt ? JSON.parse(txt) : [];
};

// ── Sincronización en segundo plano ──
let _flushing = false;

/** Envía a Supabase las escrituras guardadas sin internet (en orden). */
export const flushMutations = async () => {
  if (_flushing || isOfflineNow()) return 0;
  _flushing = true;
  let sent = 0;
  const touched = new Set();
  try {
    const items = await getMutations();
    for (const m of items) {
      let r;
      try {
        const send = () => fetch(`${SUPA_URL}/rest/v1/${m.path}`, {
          method: m.method,
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${_authToken || SUPA_KEY}`,
            "Content-Type": "application/json",
            ...(m.prefer ? { Prefer: m.prefer } : {})
          },
          body: m.body ?? undefined
        });
        r = await send();
        if (r.status === 401) {
          const ok = await refreshSession();
          if (ok !== true) break; // sin sesión válida / sin red: reintentar luego
          r = await send();
        }
      } catch {
        break; // sin red: reintentar luego
      }
      // Errores temporales: conservar y reintentar luego
      _netDown = false;
      if (r.status === 401 || r.status === 408 || r.status === 429 || r.status >= 500) break;
      if (!r.ok) console.warn("[FLUX offline] Mutación descartada:", r.status, m.method, m.path);
      await removeMutation(m.id);
      touched.add(m.table);
      sent++;
    }
  } finally {
    _flushing = false;
  }
  if (sent) {
    touched.forEach((t) => invalidateCache(t));
    try { window.dispatchEvent(new CustomEvent("flux:synced", { detail: { tables: [...touched] } })); } catch { /* ignore */ }
  }
  return sent;
};

/** Refresca en segundo plano las consultas guardadas que ya están viejas (mantiene el dato "al día"). */
export const refreshStaleCache = async (maxAgeMs = 120000, limit = 25) => {
  if (!_authToken || isOfflineNow()) return;
  const stale = [...queryCache.entries()]
    .filter(([k, v]) => !k.startsWith("rpc/") && (v.invalidated || Date.now() - v.timestamp > maxAgeMs))
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .slice(0, limit);
  for (const [path] of stale) {
    try { await q(path, { force: true }); } catch { if (isOfflineNow()) break; }
  }
};

export const getPendingMutations = countMutations;



export const storageUpload = async (bucket, path, file) => {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
    method:"POST",
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${_authToken||SUPA_KEY}`, "Content-Type":file.type },
    body:file
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  return `${SUPA_URL}/storage/v1/object/public/${bucket}/${path}`;
};

export const storageDelete = async (bucket, path) => {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
    method:"DELETE",
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${_authToken||SUPA_KEY}` }
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
};

export const storageListFolder = async (bucket, prefix) => {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/list/${bucket}`, {
    method:"POST",
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${_authToken||SUPA_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ prefix })
  });
  if (!r.ok) { return []; }
  return await r.json();
};

export const storageRemoveMany = async (bucket, prefixes) => {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}`, {
    method:"DELETE",
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${_authToken||SUPA_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ prefixes })
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
};

// ── Multi-tenancy: Profile del usuario logueado ──
let _profileId = null;
export const setProfileId   = (id) => {
  _profileId = id;
  if (id) localStorage.setItem("flux_profileId", id);
  else  localStorage.removeItem("flux_profileId");
};
export const getProfileId   = ()   => _profileId;

/** Restaurar profileId guardado */
export const restoreProfileId = () => {
  const saved = localStorage.getItem("flux_profileId");
  if (saved) { _profileId = saved; return saved; }
  return null;
};

// Obtener lista de nutriólogos (solo superadmin)
export const getNutriologos = () =>
  dbGet("profiles?role=eq.nutriologo&select=id,nombre,nombre_marca,email,telefono,color_primario,logo_url,activo&order=nombre.asc");

// Actualizar perfil (nombre, marca, color, rol)
export const updateProfile  = (id, data) => dbPatch(`profiles?id=eq.${id}`, data);

// ── Autenticación ──
export const authSignIn = async (email, password) => {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method:"POST", headers:{apikey:SUPA_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email,password})
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.msg || "Error de autenticación");
  // Guardar refresh_token para renovación automática de sesión
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
    body: JSON.stringify({ email, password, data: { nombre } })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || d.error_description || d.message || "Error registrando cuenta");

  if (d.session) {
    if (d.session.refresh_token) saveRefreshToken(d.session.refresh_token);
    if (d.session.access_token) setAuthToken(d.session.access_token);
  }
  return d;
};

// Invitar usuario — extraData: { role, nombre, nombre_marca, color_primario }
export const authInvite = async (email, extraData = {}) => {
  const r = await fetch(`${SUPA_URL}/functions/v1/invite-user`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${_authToken || SUPA_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, ...extraData })
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

  const r = await fetch(`${SUPA_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectUrl)}`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, redirect_to: redirectUrl })
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
    body: JSON.stringify({ password })
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

/**
 * Intercepta de forma SÍNCRONA cualquier hash/query de autenticación de Supabase
 * (invitación, recuperación de contraseña, confirmación de correo o error de token expirado)
 * ANTES de que React Router (HashRouter o BrowserRouter) monte o redirija.
 */
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

  // Extraer parámetros incluso si hay prefijos de HashRouter como #/login#access_token=...
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

  // 1. SIEMPRE cerrar cualquier sesión previa abierta para evitar colisión de cuentas
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

  // 2. Procesar token válido
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
    } catch (e) {}

    if (decodedEmail) {
      sessionStorage.setItem("flux_login_email", decodedEmail);
    }
    sessionStorage.removeItem("flux_pending_auth_error");

    if (type === "signup") {
      // Confirmación de correo de usuario que ya eligió su contraseña al registrarse
      sessionStorage.removeItem("flux_pending_auth_token");
      sessionStorage.removeItem("flux_pending_auth_type");
      sessionStorage.setItem(
        "flux_pending_auth_info",
        "¡Correo confirmado exitosamente! Ya puedes iniciar sesión con tu contraseña."
      );
      sessionStorage.setItem("flux_login_mode", "login");
    } else {
      // Invitación (type=invite) o Recuperación de contraseña (type=recovery / magiclink)
      sessionStorage.setItem("flux_pending_auth_token", token);
      sessionStorage.setItem("flux_pending_auth_type", type);
      if (refreshToken) {
        sessionStorage.setItem("flux_pending_auth_refresh", refreshToken);
      }
      sessionStorage.removeItem("flux_pending_auth_info");
      sessionStorage.setItem("flux_login_mode", "set_password");
    }
  } else if (errorDesc || errorCode || errorType) {
    // 3. Procesar enlace expirado o ya consumido
    sessionStorage.removeItem("flux_pending_auth_token");
    sessionStorage.removeItem("flux_pending_auth_type");
    sessionStorage.removeItem("flux_pending_auth_info");
    sessionStorage.setItem(
      "flux_pending_auth_error",
      "Este enlace ya expiró o ya fue utilizado (recuerda que los enlaces de correo son de un solo uso). Ingresa tu correo abajo para enviarte un enlace nuevo."
    );
    sessionStorage.setItem("flux_login_mode", "reset");
  }

  // 4. Limpiar la URL de inmediato sin recargar la página para que el Router abra directo en /login
  try {
    if (isAppMode) {
      window.history.replaceState(null, "", window.location.pathname + "#/login");
    } else {
      window.history.replaceState(null, "", "/login");
    }
  } catch (e) {}

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
  
  // Sanitización profunda de datos: Postgres rechaza "" en columnas de fecha (DATE) o numéricas.
  const sanitizedData = { ...data };
  if (sanitizedData.fecha_nacimiento === "") {
    sanitizedData.fecha_nacimiento = null;
  }
  
  Object.keys(sanitizedData).forEach(k => {
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
