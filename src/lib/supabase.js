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
export const onSessionExpired = (cb) => { _onSessionExpired = cb; };

// ── Función base de petición ──
const q = async (path, opts={}) => {
  const { headers: extraHeaders, upsert, ...restOpts } = opts;
  const prefer = upsert
    ? "resolution=merge-duplicates,return=representation"
    : "return=representation";
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
    throw new Error("OFFLINE");
  }
  // Interceptar 401 — intentar renovar el token antes de cerrar sesión
  if (r.status === 401 && _authToken) {
    if (!_isRefreshing) {
      _isRefreshing = true;
      const ok = await refreshSession();
      _isRefreshing = false;
      _refreshQueue.forEach(resolve => resolve(ok));
      _refreshQueue = [];
      if (ok === "OFFLINE") {
        throw new Error("OFFLINE");
      }
      if (!ok) {
        setAuthToken(null); setProfileId(null); saveRefreshToken(null);
        if (_onSessionExpired) _onSessionExpired();
        throw new Error("Sesión expirada — inicia sesión de nuevo");
      }
      // Reintentar la petición original con el token nuevo
      return q(path, opts);
    } else {
      // Esperar a que termine el refresh en curso y reintentar
      await new Promise(resolve => _refreshQueue.push(resolve));
      return q(path, opts);
    }
  }
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const t = await r.text(); return t ? JSON.parse(t) : [];
};

// ── Operaciones de base de datos ──
export const dbGet    = (p)   => q(p);
export const dbPost   = (p,b) => q(p, { method:"POST", body:JSON.stringify(b) });
export const dbPatch  = (p,b) => q(p, { method:"PATCH", body:JSON.stringify(b), headers:{Prefer:"return=representation"} });
export const dbDel    = (p)   => q(p, { method:"DELETE" });
export const dbUpsert = async (p, b) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${p}`, {
    method: "POST",
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${_authToken || SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(b)
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
    return dbUpsert(p, b);
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
  const r = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { nombre } })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || d.error_description || "Error registrando cuenta");
  
  if (d.session) {
    if (d.session.refresh_token) saveRefreshToken(d.session.refresh_token);
  }
  return d;
};

// Invitar usuario — extraData: { role, nombre, nombre_marca, color_primario }
export const authInvite = async (email, extraData={}) => {
  const r = await fetch(`${SUPA_URL}/functions/v1/invite-user`, {
    method:"POST",
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${_authToken || SUPA_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({email, ...extraData})
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Error al invitar usuario");
  return d;
};

export const authResetPassword = async (email) => {
  const r = await fetch(`${SUPA_URL}/auth/v1/recover`, {
    method:"POST", headers:{apikey:SUPA_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email, redirect_to: window.location.origin})
  });
  if (!r.ok) throw new Error("Error al enviar email de recuperación");
};

export const authUpdatePassword = async (token, password) => {
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    method:"PUT", headers:{apikey:SUPA_KEY, Authorization:`Bearer ${token}`, "Content-Type":"application/json"},
    body:JSON.stringify({password})
  });
  if (!r.ok) throw new Error("Error al actualizar contraseña");
};
