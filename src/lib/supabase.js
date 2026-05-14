const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Token de autenticación — se activa al hacer login
let _authToken = null;
let _onSessionExpired = null; // callback para redirigir al login

export const setAuthToken = (t) => {
  _authToken = t;
  // Persistir en sessionStorage para sobrevivir recargas
  if (t) sessionStorage.setItem("flux_token", t);
  else  sessionStorage.removeItem("flux_token");
};

export const getAuthToken = () => _authToken;

/** Restaurar token guardado (llamar al montar App) */
export const restoreSession = () => {
  const saved = sessionStorage.getItem("flux_token");
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
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${_authToken || SUPA_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer,
      ...extraHeaders
    },
    ...restOpts
  });
  // Interceptar sesión expirada
  if (r.status === 401 && _authToken) {
    setAuthToken(null);
    setProfileId(null);
    if (_onSessionExpired) _onSessionExpired();
    throw new Error("Sesión expirada — inicia sesión de nuevo");
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
  // Interceptar sesión expirada
  if (r.status === 401 && _authToken) {
    setAuthToken(null);
    setProfileId(null);
    if (_onSessionExpired) _onSessionExpired();
    throw new Error("Sesión expirada — inicia sesión de nuevo");
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
  if (id) sessionStorage.setItem("flux_profileId", id);
  else  sessionStorage.removeItem("flux_profileId");
};
export const getProfileId   = ()   => _profileId;

/** Restaurar profileId guardado */
export const restoreProfileId = () => {
  const saved = sessionStorage.getItem("flux_profileId");
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
