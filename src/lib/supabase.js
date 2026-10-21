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

/** Registrar callback para cuando la sesión expire (401) */
// ── Caché de Consultas GET ──
const CACHE_VERSION = "v3"; // Cambiar esto en nuevas versiones para limpiar la caché
const queryCache = new Map();

const loadCache = () => {
  try {
    // Limpieza de emergencia de cachés viejos
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("flux_query_cache_") && key !== `flux_query_cache_${CACHE_VERSION}`) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem("flux_query_cache"); // limpiar el legado

    const stored = localStorage.getItem(`flux_query_cache_${CACHE_VERSION}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.keys(parsed).forEach(k => {
        if (Date.now() - parsed[k].timestamp < 300000) {
          queryCache.set(k, parsed[k]);
        }
      });
    }
  } catch(e) {}
};
loadCache();

const saveCache = () => {
  try {
    const obj = {};
    for (const [k, v] of queryCache.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(`flux_query_cache_${CACHE_VERSION}`, JSON.stringify(obj));
  } catch(e) {
    if (e.name === 'QuotaExceededError') localStorage.removeItem(`flux_query_cache_${CACHE_VERSION}`);
  }
};

export const invalidateCache = (table) => {
  if (!table) { queryCache.clear(); saveCache(); return; }
  for (const key of queryCache.keys()) {
    if (key.startsWith(table)) queryCache.delete(key);
  }
  saveCache();
};

export const onSessionExpired = (cb) => { _onSessionExpired = cb; };

// ── Función base de petición ──
const q = async (path, opts={}, onBackgroundUpdate=null) => {
  const isGet = !opts.method || opts.method === "GET";
  const table = path.split('?')[0];
  let returnedCache = false;

  const fetchNetwork = async () => {
    const { headers: extraHeaders, upsert, ...restOpts } = opts;
    const prefer = upsert ? "resolution=merge-duplicates,return=representation" : "return=representation";
    let r;
    try {
      r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${_authToken || SUPA_KEY}`,
          "Content-Type": "application/json",
          Prefer: prefer,
          ...extraHeaders
        },
        ...restOpts
      });
    } catch (err) {
      if (isGet) {
        const cached = queryCache.get(path);
        if (cached && !returnedCache) return cached.data;
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
      const e = await r.text(); throw new Error(e); 
    }
    
    const t = await r.text(); 
    const data = t ? JSON.parse(t) : [];
    
    if (isGet) {
      const prevCached = queryCache.get(path);
      const isDifferent = !prevCached || JSON.stringify(prevCached.data) !== JSON.stringify(data);
      
      queryCache.set(path, { data, timestamp: Date.now() });
      saveCache();
      
      // Si la data es diferente a la caché que ya mostramos, actualizamos la UI en silencio
      if (returnedCache && onBackgroundUpdate && isDifferent) {
        onBackgroundUpdate(data);
      }
    }
    return data;
  };

  if (isGet) {
    const cached = queryCache.get(path);
    if (cached) {
      // Si la caché es hiper-reciente (< 15 segundos), usamos caché puro para no saturar la red en clics rápidos
      if (Date.now() - cached.timestamp < 15000) {
        return cached.data;
      }
      // Si el componente soporta actualización en 2do plano (SWR), devolvemos caché instantáneo y consultamos en silencio
      if (onBackgroundUpdate) {
        returnedCache = true;
        fetchNetwork().catch(() => {}); // Fuego y olvido
        return cached.data;
      }
    }
  } else {
    invalidateCache(table); // Mutaciones invalidan caché de inmediato
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
export const dbDel    = (p)   => q(p, { method: "DELETE" });
export const dbUpsert = async (p, b) => {
  const normalizedBody = normalizeBatchKeys(b);
  invalidateCache(p.split('?')[0]); // Invalidar caché en upsert
  const r = await fetch(`${SUPA_URL}/rest/v1/${p}`, {
    method: "POST",
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${_authToken || SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(normalizedBody)
  });
  // Interceptar 401 en upsert — renovar token silenciosamente
  if (r.status === 401 && _authToken) {
    const ok = await refreshSession();
    if (!ok) {
      setAuthToken(null); setProfileId(null); saveRefreshToken(null);
      if (_onSessionExpired) _onSessionExpired();
      throw new Error("Sesión expirada — inicia sesión de nuevo");
    }
    // Reintentar con token nuevo
    return dbUpsert(p, normalizedBody);
  }
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const t = await r.text(); return t ? JSON.parse(t) : [];
};

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
