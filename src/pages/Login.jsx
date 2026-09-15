import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, User } from "lucide-react";
import { authSignIn, authResetPassword, authUpdatePassword, setAuthToken, setProfileId, dbGet, authSignUp, dbPost } from "../lib/supabase";

export default function Login({ onLogin }) {
  const [mode, setMode]           = useState("login");
  const [nombre, setNombre]       = useState("");
  const [email, setEmail]         = useState("");
  const [pass, setPass]           = useState("");
  const [newPass, setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [signupType, setSignupType] = useState("civil");
  const [docUrl, setDocUrl] = useState("");
  const [err, setErr]             = useState("");
  const [info, setInfo]           = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
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

      let availableRoles = [];

      // 1. Fetch from profiles
      const profiles = await dbGet(`profiles?id=eq.${data.user.id}`);
      let adminRole = profiles.length ? profiles[0].role : null;
      if (adminRole === "administrativo" && profiles[0].nutriologo_id) {
        const boss = await dbGet(`profiles?id=eq.${profiles[0].nutriologo_id}&select=role`);
        if (boss.length && boss[0].role === "superadmin") {
          adminRole = "staff";
        }
      }

      if (adminRole && ["superadmin", "nutriologo", "administrativo", "staff"].includes(adminRole)) {
        if (["nutriologo", "administrativo", "staff"].includes(adminRole) && profiles[0].activo === false) {
           // Suspended admin account (ignore or we could error, but we skip to allow client login if any)
        } else {
           availableRoles.push({
             role: adminRole,
             data: profiles[0]
           });
        }
      }

      // 2. Fetch from clientes
      const clientRows = await dbGet(`clientes?email=ilike.${encodeURIComponent(email.trim())}&activo=eq.true`);
      for (const clientData of clientRows) {
        if (clientData.nutriologo_id) {
          const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo`);
          if (nut.length && nut[0].activo === false) {
            continue; // Suspended clinic, skip this client profile
          }
        }
        availableRoles.push({
          role: "cliente",
          data: clientData
        });
      }

      if (availableRoles.length === 0) {
        setAuthToken(null); setProfileId(null);
        setErr("No se encontró tu cuenta activa.");
        setLoading(false); return;
      }

      
      let multiRoles = availableRoles.map(r => ({ role: r.role, data: r.data }));
      const hasPro = multiRoles.some(r => ["superadmin", "nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(r.role));
      if (hasPro) {
        multiRoles = multiRoles.filter(r => r.role !== 'cliente');
      }

      if (multiRoles.length === 0) {
        setAuthToken(null); setProfileId(null);
        setErr("No se encontró tu cuenta activa.");
        setLoading(false); return;
      }

      const sorted = multiRoles.sort((a, b) => a.role === 'cliente' ? 1 : -1);

      if (sorted.length === 1) {
        onLogin({ role: sorted[0].role, data: sorted[0].data, token: data.access_token, profileId: data.user.id });
      } else {
        onLogin({ 
          role: sorted[0].role, 
          data: sorted[0].data, 
          token: data.access_token, 
          profileId: data.user.id,
          multiRoles: sorted 
        });
      }
} catch(e) { setAuthToken(null); setProfileId(null); setErr(e.message); setLoading(false); }
  };

  
  const submitProRequest = async () => {
    if (!nombre || !email || !docUrl) {
      setErr("Todos los campos son obligatorios");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      await dbPost("solicitudes_profesionales", {
        nombre: nombre.trim(),
        email: email.trim(),
        tipo: signupType,
        documentacion_url: docUrl.trim(),
        estado: 'pendiente'
      });
      setInfo("Solicitud enviada con éxito. Nuestro equipo la revisará pronto.");
      setMode("login");
    } catch (e) {
      setErr("Error al enviar solicitud: " + e.message);
    }
    setLoading(false);
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
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="••••••••"
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm"
              />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
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

        
        {/* SIGNUP TYPE */}
        {mode === "signup_type" && <>
          <div className="mb-6 text-center">
            <h3 className="text-lg font-bold text-[#0B1929] mb-2">¿Cómo usarás Flux?</h3>
            <p className="text-xs text-[#6B7A8D]">Selecciona el tipo de cuenta que deseas crear.</p>
          </div>
          <div className="flex flex-col gap-3 mb-4">
            <button onClick={() => { setSignupType("civil"); setMode("signup_civil"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-[var(--brand-primary)] hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-[var(--brand-primary)] shrink-0">
                <User size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">Usuario Civil</p>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Entrena, sigue tu dieta y vincula a tu nutriólogo.</p>
              </div>
            </button>
            <button onClick={() => { setSignupType("nutriologo"); setMode("signup_pro"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-emerald-500 hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">Nutriólogo</p>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Gestiona pacientes y crea planes personalizados.</p>
              </div>
            </button>
            <button onClick={() => { setSignupType("nutriologo_estudiante"); setMode("signup_pro"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-amber-500 hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">Estudiante de Nutrición</p>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Para estudiantes con credencial vigente.</p>
              </div>
            </button>
          </div>
        </>}

        {/* SIGNUP CIVIL */}
        {mode === "signup_civil" && <>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre Completo</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User size={18} /></div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => e.key === "Enter" && signUpSubmit()} placeholder="Tu nombre" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></div>
              <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && signUpSubmit()} placeholder="tu@email.com" type="email" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></div>
              <input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && signUpSubmit()} placeholder="Mínimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          <button onClick={signUpSubmit} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
            {loading ? "CREANDO..." : <>CREAR CUENTA <ArrowRight size={16} /></>}
          </button>
          <div className="text-center">
            <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929]">Volver</button>
          </div>
        </>}

        {/* SIGNUP PRO */}
        {mode === "signup_pro" && <>
          <div className="mb-6 text-center">
            <h3 className="text-lg font-bold text-[#0B1929] mb-1">{signupType === 'nutriologo' ? 'Solicitud Nutriólogo' : 'Solicitud Estudiante de Nutrición'}</h3>
            <p className="text-xs text-[#6B7A8D]">Revisaremos tus datos para habilitar tu cuenta.</p>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre Completo</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User size={18} /></div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></div>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" type="email" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">URL de Cédula o Credencial</div>
            <div className="relative">
              <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="Link a tu documento / Drive / Foto" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
            <p className="text-[10px] text-[#6B7A8D] mt-2 leading-tight">Por ahora, pega un enlace donde podamos ver tu comprobante (ej. Google Drive público, Dropbox, o tu número de cédula).</p>
          </div>
          <button onClick={submitProRequest} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#10B981] text-white hover:bg-[#059669] cursor-pointer shadow-lg shadow-emerald-500/30'}`}>
            {loading ? "ENVIANDO..." : <>ENVIAR SOLICITUD <CheckCircle size={16} /></>}
          </button>
          <div className="text-center">
            <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929]">Volver</button>
          </div>
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
              <input type={showPass ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Confirmar contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input type={showPass ? "text" : "password"} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={e => e.key === "Enter" && setPassword()} placeholder="Repite tu contraseña" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
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
