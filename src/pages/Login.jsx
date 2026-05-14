import { useState, useEffect } from "react";
import { useBrand } from "../components/BrandContext";
import { authSignIn, authResetPassword, authUpdatePassword, setAuthToken, setProfileId, dbGet } from "../lib/supabase";

// Componente de Input Glassmorphism reutilizable
const GlassInput = ({ label, ...props }) => (
  <div className="mb-4 w-full">
    <label className="block text-[10px] uppercase tracking-[2px] text-slate-500 font-bold mb-2 ml-1">
      {label}
    </label>
    <input
      {...props}
      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all duration-300 backdrop-blur-sm shadow-inner"
    />
  </div>
);

export default function Login({ onLogin }) {
  const [mode,        setMode]        = useState("login");
  const [email,       setEmail]       = useState("");
  const [pass,        setPass]        = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [err,         setErr]         = useState("");
  const [info,        setInfo]        = useState("");
  const [loading,     setLoading]     = useState(false);
  const [accessToken, setAccessToken] = useState("");

  const brand = useBrand();
  const logoUrl   = brand?.logo_url   || "/logo.png";
  const brandName = brand?.nombre_marca || "FLUX Sport Supplements";

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const token  = params.get("access_token");
      const type   = params.get("type");
      if (token && (type === "invite" || type === "recovery" || type === "signup")) {
        setAccessToken(token);
        setMode("set_password");
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  // ── Login ───────────────────────────────────────────────────────────────────
  const submit = async () => {
    setLoading(true); setErr(""); setInfo("");
    try {
      const data = await authSignIn(email.trim(), pass);
      setAuthToken(data.access_token);
      setProfileId(data.user.id);

      const profiles = await dbGet(`profiles?id=eq.${data.user.id}`);
      const role = profiles.length ? profiles[0].role : null;

      if (role === "admin" || role === "superadmin" || role === "nutriologo" || role === "administrativo") {
        if ((role === "nutriologo" || role === "administrativo") && profiles[0].activo === false) {
          setAuthToken(null); setProfileId(null);
          setErr("Tu cuenta está suspendida. Contacta a soporte.");
          setLoading(false); return;
        }
        onLogin({ role: role === "admin" ? "admin" : role, token: data.access_token, profileId: data.user.id });
        return;
      }

      // Cliente
      const rows = await dbGet(`clientes?email=ilike.${encodeURIComponent(email.trim())}&activo=eq.true`);
      if (!rows.length) {
        setAuthToken(null); setProfileId(null);
        setErr("No se encontró tu cuenta activa.");
        setLoading(false); return;
      }
      const clientData = rows[0];
      // Verificar que la clínica del cliente esté activa
      if (clientData.nutriologo_id) {
        const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo`);
        if (nut.length && nut[0].activo === false) {
          setAuthToken(null); setProfileId(null);
          setErr("El servicio de tu clínica está suspendido temporalmente.");
          setLoading(false); return;
        }
      }
      onLogin({ role: "client", data: clientData, token: data.access_token });

    } catch (e) { setAuthToken(null); setProfileId(null); setErr(e.message); setLoading(false); }
  };

  // ── Reset ───────────────────────────────────────────────────────────────────
  const sendReset = async () => {
    if (!email) { setErr("Escribe tu email"); return; }
    setLoading(true); setErr("");
    try {
      await authResetPassword(email.trim());
      setInfo("✅ Revisa tu email para restablecer tu contraseña.");
      setMode("login");
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  // ── Set Password ────────────────────────────────────────────────────────────
  const setPassword = async () => {
    if (newPass.length < 6) { setErr("Mínimo 6 caracteres"); return; }
    if (newPass !== confirmPass) { setErr("Las contraseñas no coinciden"); return; }
    setLoading(true); setErr("");
    try {
      await authUpdatePassword(accessToken, newPass);
      setInfo("✅ Contraseña establecida. Ya puedes entrar.");
      setMode("login");
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const modeTitle = { login: "Bienvenido", reset: "Recuperar acceso", set_password: "Nueva contraseña" };
  const modeSub   = { login: "Ingresa tus credenciales para continuar", reset: "Sigue los pasos para restablecer tu acceso", set_password: "Elige una contraseña segura" };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">

      {/* ── Fondo atmosférico ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-900/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="grid lg:grid-cols-2 w-full max-w-5xl z-10 items-center gap-12">

        {/* ── Columna izquierda: Branding ── */}
        <div className="hidden lg:flex flex-col items-start space-y-8">
          <div className="flex items-center gap-4">
            {logoUrl && logoUrl !== "/logo.png"
              ? <img src={logoUrl} alt={brandName} className="h-16 object-contain" />
              : (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <span className="text-white font-black text-3xl italic">F</span>
                  </div>
                  <h1 className="text-5xl font-black tracking-tighter text-white italic">FLUX</h1>
                </div>
              )
            }
          </div>

          <div className="space-y-3">
            <p className="text-2xl text-slate-300 font-light leading-snug">
              Tu transformación<br />
              <span className="text-white font-semibold">comienza aquí.</span>
            </p>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
              Plataforma integral de nutrición y entrenamiento personalizado para atletas de alto rendimiento.
            </p>
          </div>

          <div className="h-px w-24 bg-gradient-to-r from-indigo-500 to-transparent" />

          <div className="grid grid-cols-3 gap-6 pt-4">
            {[["🥦", "Nutrición"], ["🏋️", "Rutinas"], ["📈", "Progreso"]].map(([icon, label]) => (
              <div key={label} className="text-center space-y-2">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                  {icon}
                </div>
                <p className="text-slate-500 text-xs tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Columna derecha: Card Glassmorphism ── */}
        <div className="flex justify-center">
          <div className="w-full max-w-[420px] bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[32px] p-10 shadow-2xl relative overflow-hidden group">

            {/* Inner glow */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/15 transition-all duration-700 pointer-events-none" />

            {/* Header de la card */}
            <div className="text-center mb-8">
              {/* Logo compacto visible solo en móvil */}
              <div className="lg:hidden mb-6">
                {logoUrl && logoUrl !== "/logo.png"
                  ? <img src={logoUrl} alt={brandName} className="h-12 object-contain mx-auto" />
                  : <span className="text-4xl font-black text-white italic tracking-tighter">FLUX</span>
                }
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{modeTitle[mode]}</h2>
              <p className="text-slate-500 mt-2 text-sm">{modeSub[mode]}</p>
            </div>

            {/* Notificaciones */}
            {err && (
              <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-center leading-relaxed">
                {err}
              </div>
            )}
            {info && (
              <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs text-center leading-relaxed">
                {info}
              </div>
            )}

            {/* ── Formularios ── */}
            <div className="space-y-1">

              {/* LOGIN */}
              {mode === "login" && <>
                <GlassInput id="login-email" label="Email" type="email" placeholder="ejemplo@flux.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()} />
                <GlassInput id="login-pass" label="Contraseña" type="password" placeholder="••••••••"
                  value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()} />
                <button id="btn-login" onClick={submit} disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all duration-300 active:scale-[0.98] mt-3 uppercase tracking-widest text-xs">
                  {loading ? "Verificando…" : "Entrar"}
                </button>
                <button onClick={() => { setMode("reset"); setErr(""); }}
                  className="w-full text-slate-500 text-[11px] mt-5 hover:text-indigo-400 transition-colors py-2">
                  ¿Olvidaste tu contraseña?
                </button>
              </>}

              {/* RESET */}
              {mode === "reset" && <>
                <GlassInput id="reset-email" label="Tu email" type="email" placeholder="tu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} />
                <button onClick={sendReset} disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all mt-3 uppercase tracking-widest text-xs">
                  {loading ? "Enviando…" : "Enviar instrucciones"}
                </button>
                <button onClick={() => { setMode("login"); setErr(""); }}
                  className="w-full text-slate-500 text-[11px] mt-5 hover:text-indigo-400 transition-colors py-2">
                  Volver al login
                </button>
              </>}

              {/* SET PASSWORD */}
              {mode === "set_password" && <>
                <GlassInput id="new-pass" label="Nueva contraseña" type="password" placeholder="Mínimo 6 caracteres"
                  value={newPass} onChange={e => setNewPass(e.target.value)} />
                <GlassInput id="confirm-pass" label="Confirmar contraseña" type="password" placeholder="Repite tu contraseña"
                  value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && setPassword()} />
                <button onClick={setPassword} disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all mt-3 uppercase tracking-widest text-xs">
                  {loading ? "Guardando…" : "Establecer contraseña"}
                </button>
              </>}

            </div>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-white/5 text-center">
              <p className="text-[10px] tracking-[4px] text-slate-700 font-black uppercase">Keep Going 💪</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
