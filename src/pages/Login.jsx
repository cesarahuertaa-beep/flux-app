import { useState, useEffect } from "react";
import { Mail, Lock, ArrowRight, CheckCircle, AlertCircle, User } from "lucide-react";
import { authSignIn, authResetPassword, authUpdatePassword, setAuthToken, setProfileId, dbGet, authSignUp, dbPost } from "../lib/supabase";

export default function Login({ onLogin }) {
  const [mode, setMode]           = useState("login");
  const [nombre, setNombre]       = useState("");
  const [email, setEmail]         = useState("");
  const [pass, setPass]           = useState("");
  const [newPass, setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [err, setErr]             = useState("");
  const [info, setInfo]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setFadeSplash(true), 2000);
    const timer2 = setTimeout(() => setShowSplash(false), 2800);
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#","?"));
      const token = params.get("access_token");
      const type  = params.get("type");
      if (token && (type==="invite"||type==="recovery"||type==="signup")) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.email) setEmail(payload.email);
        } catch(e) {}
        setTimeout(() => {
          setAccessToken(token); 
          setMode("set_password");
        }, 0);
        window.history.replaceState(null,"",window.location.pathname);
      }
    } else if (hash.includes("error_description")) {
      const params = new URLSearchParams(hash.replace("#","?"));
      const desc = params.get("error_description");
      if (desc) {
        setErr("El enlace es inválido o ya expiró (recuerda que los enlaces de invitación son de un solo uso).");
        window.history.replaceState(null,"",window.location.pathname);
      }
    }
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

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
      const rows = await dbGet(`clientes?email=ilike.${encodeURIComponent(email.trim())}&activo=eq.true`);
      if (!rows.length) {
        setAuthToken(null); setProfileId(null);
        setErr("No se encontró tu cuenta activa.");
        setLoading(false); return;
      }
      const clientData = rows[0];
      if (clientData.nutriologo_id) {
        const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo`);
        if (nut.length && nut[0].activo === false) {
          setAuthToken(null); setProfileId(null);
          setErr("El servicio de tu clínica está suspendido temporalmente.");
          setLoading(false); return;
        }
      }
      onLogin({ role:"client", data:clientData, token:data.access_token });
    } catch(e) { setAuthToken(null); setProfileId(null); setErr(e.message); setLoading(false); }
  };

  const signUpSubmit = async () => {
    if (!nombre.trim() || !email.trim() || !pass) {
      setErr("Por favor llena todos los campos");
      return;
    }
    if (pass.length < 6) {
      setErr("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      const data = await authSignUp(email.trim(), pass, nombre);
      if (!data.user) {
        throw new Error("No se pudo crear el usuario en Auth.");
      }
      
      await dbPost("clientes", { 
        nombre: nombre.trim(), 
        email: email.trim(), 
        auth_id: data.user.id, 
        activo: true, 
        nutriologo_id: null 
      });

      await submit();
    } catch(e) {
      setErr(e.message);
      setLoading(false);
    }
  };

  const sendReset = async () => {
    if (!email) { setErr("Escribe tu email"); return; }
    setLoading(true); setErr("");
    try {
      await authResetPassword(email.trim());
      setInfo("Revisa tu email para restablecer tu contraseña.");
      setMode("login");
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  const setPassword = async () => {
    if (!newPass || newPass.length < 6) { setErr("Mínimo 6 caracteres"); return; }
    if (newPass !== confirmPass) { setErr("Las contraseñas no coinciden"); return; }
    setLoading(true); setErr("");
    try {
      await authUpdatePassword(accessToken, newPass);
      setInfo("Contraseña establecida. Ya puedes entrar.");
      setMode("login");
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center relative overflow-hidden font-['Inter',sans-serif]">
      {/* ── Splash Screen Overlay ── */}
      {showSplash && (
        <div className={`absolute inset-0 bg-white z-50 flex items-center justify-center transition-opacity duration-[800ms] ease-out ${fadeSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <img src="/flux_logo.jpeg" alt="Flux Splash" className="w-[320px] h-auto" />
        </div>
      )}

      {/* ── Login Card ── */}
      <div className="animate-in w-full max-w-[420px] px-10 pt-11 pb-9 bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl relative z-10 mx-4">
        
        {/* Top Spacer / Toggle */}
        <div className={`text-center ${mode === "reset" || mode === "set_password" ? 'mb-6' : 'mb-5'}`}>
          {(mode === "reset" || mode === "set_password") && (
            <div className="mt-3 text-[13px] text-[#6B7A8D] tracking-wide">
              {mode === "reset" ? "Recuperar contraseña" : "Crear nueva contraseña"}
            </div>
          )}
          {(mode === "login" || mode === "signup") && (
            <div className="flex bg-[#F0F4FA] rounded-full p-1 mx-auto w-fit mt-2">
              <button
                onClick={() => { setMode("login"); setErr(""); setInfo(""); }}
                className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${mode === "login" ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => { setMode("signup"); setErr(""); setInfo(""); }}
                className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${mode === "signup" ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
              >
                Crear Cuenta
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        {info && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-[13px] text-green-700 mb-5 leading-relaxed flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600 shrink-0" />
            <span>{info}</span>
          </div>
        )}
        {err && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-600 mb-5 leading-relaxed text-center flex items-center gap-2 justify-center">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {/* ── LOGIN FORM ── */}
        {mode === "login" && <>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail size={18} />
              </div>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="tu@email.com"
                type="email"
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"
              />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="••••••••"
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"
              />
            </div>
          </div>

          <button onClick={submit} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
            {loading ? "VERIFICANDO…" : <>ENTRAR <ArrowRight size={16} /></>}
          </button>

          <div className="text-center">
            <button
              onClick={() => { setMode("reset"); setErr(""); }}
              className="bg-transparent border-none text-[#6B7A8D] text-xs cursor-pointer font-['Inter',sans-serif] transition-colors hover:text-[#2e5cb8] tracking-wide"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </>}

        {/* ── SIGNUP FORM ── */}
        {mode === "signup" && <>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre Completo</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <User size={18} />
              </div>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && signUpSubmit()}
                placeholder="Tu nombre"
                type="text"
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"
              />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail size={18} />
              </div>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && signUpSubmit()}
                placeholder="tu@email.com"
                type="email"
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"
              />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && signUpSubmit()}
                placeholder="••••••••"
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"
              />
            </div>
          </div>

          <button onClick={signUpSubmit} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
            {loading ? "CREANDO…" : <>CREAR CUENTA <ArrowRight size={16} /></>}
          </button>
        </>}

        {/* ── RESET FORM ── */}
        {mode === "reset" && <>
          <div className="mb-5">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Tu email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail size={18} />
              </div>
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" type="email"
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"
              />
            </div>
          </div>
          <button onClick={sendReset} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1px] font-['Space_Grotesk',sans-serif] transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
            {loading ? "ENVIANDO…" : "ENVIAR INSTRUCCIONES"}
          </button>
          <div className="text-center">
            <button onClick={() => { setMode("login"); setErr(""); }} className="bg-transparent border-none text-[#6B7A8D] text-xs cursor-pointer font-['Inter',sans-serif] transition-colors hover:text-[#2e5cb8]">
              Volver al login
            </button>
          </div>
        </>}

        {/* ── SET PASSWORD FORM ── */}
        {mode === "set_password" && <>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nueva contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Confirmar contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={e => e.key === "Enter" && setPassword()} placeholder="Repite tu contraseña" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <button onClick={setPassword} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm tracking-[1px] font-['Space_Grotesk',sans-serif] transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
            {loading ? "GUARDANDO…" : "ESTABLECER CONTRASEÑA"}
          </button>
        </>}

        {/* Footer */}
        <div className="mt-7 text-center text-[10px] text-[#6B7A8D] tracking-[2px] uppercase font-['Space_Grotesk',sans-serif]">
          KEEP GOING 💪
        </div>
      </div>
    </div>
  );
}
