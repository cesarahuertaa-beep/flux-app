const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Token de autenticación — se activa al hacer login
let _authToken = null;
export const setAuthToken = (t) => { _authToken = t; };

// ── Función base de petición ──
const q = async (path, opts={}) => {
  // Separamos headers del resto para evitar que ...opts sobreescriba los headers de auth
  const { headers: extraHeaders, ...restOpts } = opts;
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${_authToken || SUPA_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...extraHeaders
    },
    ...restOpts
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const t = await r.text(); return t ? JSON.parse(t) : [];
};

// ── Operaciones de base de datos ──
export const dbGet    = (p)   => q(p);
export const dbPost   = (p,b) => q(p, { method:"POST", body:JSON.stringify(b) });
export const dbPatch  = (p,b) => q(p, { method:"PATCH", body:JSON.stringify(b), headers:{Prefer:"return=representation"} });
export const dbDel    = (p)   => q(p, { method:"DELETE" });
export const dbUpsert = (p,b) => q(p, { method:"POST", body:JSON.stringify(b), headers:{Prefer:"resolution=merge-duplicates,return=representation"} });

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
export const setProfileId   = (id) => { _profileId = id; };
export const getProfileId   = ()   => _profileId;

// Obtener lista de nutriólogos (solo superadmin)
export const getNutriologos = () =>
  dbGet("profiles?role=eq.nutriologo&select=id,nombre,nombre_marca,email,color_primario,logo_url,activo&order=nombre.asc");

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
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, "Content-Type":"application/json" },
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
