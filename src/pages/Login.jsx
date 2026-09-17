import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, User } from "lucide-react";
import { authSignIn, authResetPassword, authUpdatePassword, setAuthToken, setProfileId, dbGet, authSignUp, dbPost, dbPostMinimal } from "../lib/supabase";

export default function Login({ onLogin }) {
  const [mode, setMode]           = useState("login");
  const [nombre, setNombre]       = useState("");
  const [email, setEmail]         = useState("");
  const [pass, setPass]           = useState("");
  const [newPass, setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [signupType, setSignupType] = useState("civil");
  const [nombreMarca, setNombreMarca] = useState("");
  const [mapaUrl, setMapaUrl] = useState("");
  const [cedula, setCedula] = useState("");
  const [err, setErr]             = useState("");
  const [info, setInfo]           = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  const [avisoAceptado, setAvisoAceptado] = useState(false);
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
        setErr("El enlace es invÃ¡lido o ya expirÃ³ (recuerda que los enlaces de invitaciÃ³n son de un solo uso).");
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

      if (adminRole && ["superadmin", "nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(adminRole)) {
        if (["nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(adminRole) && profiles[0].activo === false) {
           // Suspended admin account (ignore or we could error, but we skip to allow client login if any)
        } else {
           availableRoles.push({
             role: adminRole,
             data: profiles[0]
           });
        }
      }

      // 2. Fetch from clientes
      const clientRows = await dbGet(`clientes?email=ilike.${encodeURIComponent(email.trim())}`);
      for (const clientData of clientRows) {
        if (clientData.nutriologo_id) {
          const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo,nombre`);
          if (nut.length) {
            if (nut[0].activo === false) {
              continue; // Suspended clinic, skip this client profile
            }
            clientData.nombre_clinica = nut[0].nombre;
          }
        }
        availableRoles.push({
          role: "cliente",
          data: clientData
        });
      }

      // 3. AUTO-CREACIÃ“N DE ATLETA INDEPENDIENTE
      // Todos los usuarios deben tener una cuenta de Atleta Independiente, EXCEPTO NutriÃ³logos y Superadmin
      const isNutriOrSuper = adminRole && ["nutriologo", "nutriologo_estudiante", "superadmin"].includes(adminRole);
      
      if (!isNutriOrSuper) {
        const hasIndep = clientRows.some(c => c.nutriologo_id === null);
        if (!hasIndep) {
          try {
             const nombreMeta = data.user?.user_metadata?.nombre || (profiles.length ? profiles[0].nombre : email.trim().split("@")[0]);
             const newClient = await dbPostMinimal("clientes", {
                nombre: nombreMeta,
                email: email.trim(),
                auth_id: data.user.id,
                activo: true,
                nutriologo_id: null
             });
             const checkAgain = await dbGet(`clientes?auth_id=eq.${data.user.id}&nutriologo_id=is.null`);
             if (checkAgain.length > 0) {
                 availableRoles.push({ role: 'cliente', data: checkAgain[0] });
             }
          } catch(e) {
             console.error("No se pudo auto-crear Atleta Independiente", e);
          }
        }
      }

      if (availableRoles.length === 0) {
          setAuthToken(null); setProfileId(null);
          setErr("ERR_DIAG_1: Perfil intruso detectado o no se pudo crear cuenta de atleta.");
          setLoading(false); return;
      }

      let multiRoles = availableRoles.map(r => ({ role: r.role, data: r.data }));
      
      // Si ES nutriÃ³logo o superadmin, NO le mostramos el rol "cliente" en el switch normal (usan Modo Atleta)
      if (isNutriOrSuper) {
        multiRoles = multiRoles.filter(r => r.role !== 'cliente');
      }

      if (multiRoles.length === 0) {
        setAuthToken(null); setProfileId(null);
        setErr("ERR_DIAG_2: No se encontro tu cuenta activa.");
        setLoading(false); return;
      }

      const sorted = multiRoles.sort((a, b) => a.role === 'cliente' ? 1 : -1);
      const firstRole = sorted[0];
      // Un "civil" es un cliente sin nutriÃ³logo asignado
      const isCivilUser = firstRole.role === 'cliente' && !firstRole.data?.nutriologo_id;
      const finalRole = isCivilUser ? 'civil' : firstRole.role;

      if (sorted.length === 1) {
        onLogin({ role: finalRole, data: firstRole.data, token: data.access_token, profileId: data.user.id });
      } else {
        onLogin({ 
          role: finalRole, 
          data: firstRole.data, 
          token: data.access_token, 
          profileId: data.user.id,
          multiRoles: sorted 
        });
      }
} catch(e) { setAuthToken(null); setProfileId(null); setErr("ERR_CATCH: " + e.message); setLoading(false); }
  };

  
  const submitProRequest = async () => {
    if (!avisoAceptado) { setErr('Debes aceptar el Aviso de Privacidad'); return; }
    if (!nombre || !email || (signupType === 'nutriologo' && !cedula)) {
      setErr("Por favor llena los campos obligatorios");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      await dbPost("solicitudes_profesionales", {
        nombre: nombre.trim(),
        email: email.trim(),
        tipo: signupType,
        cedula: cedula.trim(),
        nombre_marca: nombreMarca.trim(),
        mapa_url: mapaUrl.trim(),
        estado: 'pendiente'
      });
      setInfo("Solicitud enviada con Ã©xito. Nuestro equipo la revisarÃ¡ pronto.");
      setMode("login");
    } catch (e) {
      setErr("Error al enviar solicitud: " + e.message);
    }
    setLoading(false);
  };

  const signUpSubmit = async () => {
    if (!avisoAceptado) { setErr('Debes aceptar el Aviso de Privacidad'); return; }
    if (!nombre.trim() || !email.trim() || !pass) {
      setErr("Por favor llena todos los campos");
      return;
    }
    if (pass.length < 6) {
      setErr("La contraseÃ±a debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      const data = await authSignUp(email.trim(), pass, nombre);
      const userId = data?.user?.id || data?.id;
        
        

        if (!userId) {
          throw new Error("No se pudo crear el usuario en Auth. " + JSON.stringify(data));
        }
      
      try {
          await dbPostMinimal("clientes", { 
            nombre: nombre.trim(), 
            email: email.trim(), 
            auth_id: userId, 
            activo: true, 
            nutriologo_id: null 
          });
          await submit(); // Intenta iniciar sesiÃ³n si no hay confirmaciÃ³n de email
        } catch (postErr) {
          // Si la BD rebota el insert (por ejemplo, si "Confirmar Email" estÃ¡ activado en Supabase 
          // y el usuario aÃºn no tiene Token), no es un error crÃ­tico. 
          // El perfil se crearÃ¡ cuando inicien sesiÃ³n por primera vez.
          console.log("Perfil no insertado aÃºn (posible ConfirmaciÃ³n de Email pendiente):", postErr.message);
          setInfo("Â¡Cuenta creada! Por favor revisa tu bandeja de correo para confirmar tu email e iniciar sesiÃ³n.");
          setMode("login");
        }
    } catch(e) {
      setErr("ERR_CATCH: " + e.message);
      setLoading(false);
    }
  };

  const sendReset = async () => {
    if (!email) { setErr("Escribe tu email"); return; }
    setLoading(true); setErr("");
    try {
      await authResetPassword(email.trim());
      setInfo("Revisa tu email para restablecer tu contraseÃ±a.");
      setMode("login");
    } catch(e) { setErr("ERR_CATCH: " + e.message); }
    setLoading(false);
  };

  const setPassword = async () => {
    if (!newPass || newPass.length < 6) { setErr("MÃ­nimo 6 caracteres"); return; }
    if (newPass !== confirmPass) { setErr("Las contraseÃ±as no coinciden"); return; }
    setLoading(true); setErr("");
    try {
      await authUpdatePassword(accessToken, newPass);
      setInfo("ContraseÃ±a establecida. Ya puedes entrar.");
      setMode("login");
    } catch(e) { setErr("ERR_CATCH: " + e.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center relative overflow-hidden font-['Inter',sans-serif]">
      {/* â”€â”€ Splash Screen Overlay â”€â”€ */}
      {showSplash && (
        <div className={`absolute inset-0 bg-white z-50 flex items-center justify-center transition-opacity duration-[800ms] ease-out ${fadeSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <img src="/flux_logo.jpeg" alt="Flux Splash" className="w-[320px] h-auto" />
        </div>
      )}

      {/* â”€â”€ Login Card â”€â”€ */}
      <div className="animate-in w-full max-w-[420px] px-10 pt-11 pb-9 bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl relative z-10 mx-4">
        
        {/* Top Spacer / Toggle */}
        <div className={`text-center ${mode === "reset" || mode === "set_password" ? 'mb-6' : 'mb-5'}`}>
          {(mode === "reset" || mode === "set_password") && (
            <div className="mt-3 text-[13px] text-[#6B7A8D] tracking-wide">
              {mode === "reset" ? "Recuperar contraseÃ±a" : "Crear nueva contraseÃ±a"}
            </div>
          )}
          {(mode === "login" || mode.startsWith("signup")) && (
            <div className="flex bg-[#F0F4FA] rounded-full p-1 mx-auto w-fit mt-2">
              <button
                onClick={() => { setMode("login"); setErr(""); setInfo(""); }}
                className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${mode === "login" ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
              >
                Iniciar SesiÃ³n
              </button>
              <button
                onClick={() => { setMode("signup_type"); setErr(""); setInfo(""); }}
                className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${mode.startsWith("signup") ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
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

        {/* â”€â”€ LOGIN FORM â”€â”€ */}
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
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">ContraseÃ±a</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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
            {loading ? "VERIFICANDOâ€¦" : <>ENTRAR <ArrowRight size={16} /></>}
          </button>

          <div className="text-center">
            <button
              onClick={() => { setMode("reset"); setErr(""); }}
              className="bg-transparent border-none text-[#6B7A8D] text-xs cursor-pointer font-['Inter',sans-serif] transition-colors hover:text-[#2e5cb8] tracking-wide"
            >
              Â¿Olvidaste tu contraseÃ±a?
            </button>
          </div>
        </>}

        
        {/* SIGNUP TYPE */}
        {mode === "signup_type" && <>
          <div className="mb-6 text-center">
            <h3 className="text-lg font-bold text-[#0B1929] mb-2">Â¿CÃ³mo usarÃ¡s Flux?</h3>
            <p className="text-xs text-[#6B7A8D]">Selecciona el tipo de cuenta que deseas crear.</p>
          </div>
          <div className="flex flex-col gap-3 mb-4">
            <button onClick={() => { setSignupType("civil"); setMode("signup_civil"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-[var(--brand-primary)] hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-[var(--brand-primary)] shrink-0">
                <User size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">Atleta Independiente</p>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Entrena, sigue tu dieta y vincula a tu nutriÃ³logo.</p>
              </div>
            </button>
            <button onClick={() => { setSignupType("nutriologo"); setMode("signup_pro"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-emerald-500 hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">NutriÃ³logo</p>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Gestiona pacientes y crea planes personalizados.</p>
              </div>
            </button>
            <button onClick={() => { setSignupType("nutriologo_estudiante"); setMode("signup_pro"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-amber-500 hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">Estudiante de NutriciÃ³n</p>
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
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">ContraseÃ±a</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></div>
              <input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && signUpSubmit()} placeholder="MÃ­nimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
                      <div className="mb-6 flex items-start gap-2">
              <input type="checkbox" id="aviso" checked={avisoAceptado} onChange={e => setAvisoAceptado(e.target.checked)} className="mt-1" />
              <label htmlFor="aviso" className="text-xs text-[#6B7A8D] leading-tight">
                He leído y acepto el <a href="https://flux-sport.com/privacidad" target="_blank" className="text-[#1A6FD4] underline">Aviso de Privacidad</a> para el tratamiento de mis datos personales y de salud.
              </label>
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
            <h3 className="text-lg font-bold text-[#0B1929] mb-1">{signupType === 'nutriologo' ? 'Solicitud NutriÃ³logo' : 'Solicitud Estudiante de NutriciÃ³n'}</h3>
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
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre de Consultorio/Marca</div>
            <div className="relative">
              <input value={nombreMarca} onChange={e => setNombreMarca(e.target.value)} placeholder="Ej. NutriFit" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">UbicaciÃ³n (Google Maps) (Opcional)</div>
            <div className="relative">
              <input value={mapaUrl} onChange={e => setMapaUrl(e.target.value)} placeholder="Enlace de Maps" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          {signupType === 'nutriologo' && (
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">NÃºmero de CÃ©dula Profesional</div>
            <div className="relative">
              <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Tu nÃºmero de cÃ©dula" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          )}
                      <div className="mb-6 flex items-start gap-2">
              <input type="checkbox" id="aviso" checked={avisoAceptado} onChange={e => setAvisoAceptado(e.target.checked)} className="mt-1" />
              <label htmlFor="aviso" className="text-xs text-[#6B7A8D] leading-tight">
                He leído y acepto el <a href="https://flux-sport.com/privacidad" target="_blank" className="text-[#1A6FD4] underline">Aviso de Privacidad</a> para el tratamiento de mis datos personales y de salud.
              </label>
            </div>
            <button onClick={submitProRequest} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#10B981] text-white hover:bg-[#059669] cursor-pointer shadow-lg shadow-emerald-500/30'}`}>
            {loading ? "ENVIANDO..." : <>ENVIAR SOLICITUD <CheckCircle size={16} /></>}
          </button>
          <div className="text-center">
            <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929]">Volver</button>
          </div>
        </>}


        {/* â”€â”€ RESET FORM â”€â”€ */}
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
            {loading ? "ENVIANDOâ€¦" : "ENVIAR INSTRUCCIONES"}
          </button>
          <div className="text-center">
            <button onClick={() => { setMode("login"); setErr(""); }} className="bg-transparent border-none text-[#6B7A8D] text-xs cursor-pointer font-['Inter',sans-serif] transition-colors hover:text-[#2e5cb8]">
              Volver al login
            </button>
          </div>
        </>}

        {/* â”€â”€ SET PASSWORD FORM â”€â”€ */}
        {mode === "set_password" && <>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nueva contraseÃ±a</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input type={showPass ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="MÃ­nimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
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
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Confirmar contraseÃ±a</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input type={showPass ? "text" : "password"} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={e => e.key === "Enter" && setPassword()} placeholder="Repite tu contraseÃ±a" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
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
            {loading ? "GUARDANDOâ€¦" : "ESTABLECER CONTRASEÃ‘A"}
          </button>
        </>}

        {/* Footer */}
        <div className="mt-7 text-center text-[10px] text-[#6B7A8D] tracking-[2px] uppercase font-['Space_Grotesk',sans-serif]">
          KEEP GOING ðŸ’ª
        </div>
      </div>
    </div>
  );
}

