const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Token de autenticación — se activa al hacer login
let _authToken = null;
export const setAuthToken = (t) => { _authToken = t; };

// ── Función base de petición ──
const q = async (path, opts={}) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${_authToken || SUPA_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...opts.headers
    },
    ...opts
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

export const authInvite = async (email) => {
  const r = await fetch(`${SUPA_URL}/functions/v1/invite-user`, {
    method:"POST",
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({email})
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
