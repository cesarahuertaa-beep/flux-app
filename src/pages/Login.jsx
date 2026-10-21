import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, User } from "lucide-react";
import { authSignIn, authResetPassword, authUpdatePassword, setAuthToken, setProfileId, dbGet, authSignUp, dbPost, dbPostMinimal, dbPatch, captureAuthHashSynchronously } from "../lib/supabase";

export default function Login({ onLogin }) {
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('flux_pending_auth_token') || "");
  const [mode, setMode] = useState(() => {
    if (sessionStorage.getItem('flux_pending_auth_token')) return "set_password";
    if (sessionStorage.getItem('flux_pending_auth_error')) return "reset";
    const saved = sessionStorage.getItem('flux_login_mode') || "login";
    if (saved === "set_password" && !sessionStorage.getItem('flux_pending_auth_token')) return "login";
    return saved;
  });
  const [nombre, setNombre] = useState(() => sessionStorage.getItem('flux_login_nombre') || "");
  const [email, setEmail] = useState(() => sessionStorage.getItem('flux_login_email') || "");
  const [pass, setPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [signupType, setSignupType] = useState(() => sessionStorage.getItem('flux_signupType') || "civil");
  const [nombreMarca, setNombreMarca] = useState("");
  const [mapaUrl, setMapaUrl] = useState("");
  const [cedula, setCedula] = useState(() => sessionStorage.getItem('flux_login_cedula') || "");
  const [err, setErr] = useState(() => sessionStorage.getItem('flux_pending_auth_error') || "");
  const [info, setInfo] = useState(() => sessionStorage.getItem('flux_pending_auth_info') || "");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    return !(
      sessionStorage.getItem('flux_pending_auth_token') ||
      sessionStorage.getItem('flux_pending_auth_error') ||
      sessionStorage.getItem('flux_pending_auth_info')
    );
  });
  const [fadeSplash, setFadeSplash] = useState(false);
  const [avisoAceptado, setAvisoAceptado] = useState(() => sessionStorage.getItem('flux_aviso') === 'true');

  useEffect(() => {
    sessionStorage.setItem('flux_login_mode', mode);
    sessionStorage.setItem('flux_signupType', signupType);
    sessionStorage.setItem('flux_login_nombre', nombre);
    sessionStorage.setItem('flux_login_email', email);
    sessionStorage.setItem('flux_login_cedula', cedula);
    sessionStorage.setItem('flux_aviso', avisoAceptado ? 'true' : 'false');
  }, [mode, signupType, nombre, email, cedula, avisoAceptado]);

  useEffect(() => {
    const syncPendingAuthState = () => {
      captureAuthHashSynchronously();
      const pendingToken = sessionStorage.getItem('flux_pending_auth_token');
      const pendingError = sessionStorage.getItem('flux_pending_auth_error');
      const pendingInfo = sessionStorage.getItem('flux_pending_auth_info');
      const pendingEmail = sessionStorage.getItem('flux_login_email');

      if (pendingEmail) setEmail(pendingEmail);

      if (pendingToken) {
        setAccessToken(pendingToken);
        setMode("set_password");
        setErr("");
        setInfo("Crea tu contraseña para activar y acceder a tu cuenta.");
        setShowSplash(false);
      } else if (pendingError) {
        sessionStorage.removeItem('flux_pending_auth_error');
        setErr(pendingError);
        setMode("reset");
        setShowSplash(false);
      } else if (pendingInfo) {
        sessionStorage.removeItem('flux_pending_auth_info');
        setInfo(pendingInfo);
        setMode("login");
        setShowSplash(false);
      }
    };

    syncPendingAuthState();
    window.addEventListener("hashchange", syncPendingAuthState);

    const timer1 = setTimeout(() => setFadeSplash(true), 2000);
    const timer2 = setTimeout(() => setShowSplash(false), 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener("hashchange", syncPendingAuthState);
    };
  }, []);

  const submit = async (overrideEmail, overridePass) => {
    const loginEmail = (typeof overrideEmail === "string" ? overrideEmail : email).trim();
    const loginPass = typeof overridePass === "string" ? overridePass : pass;
    if (!loginEmail || !loginPass) {
      setErr("Ingresa tu correo y contraseña");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      const data = await authSignIn(loginEmail, loginPass);
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
          // Suspended admin account (skip to allow client login if any)
        } else {
          availableRoles.push({
            role: adminRole,
            data: profiles[0]
          });
        }
      }

      // 2. Fetch from clientes
      const clientRows = await dbGet(`clientes?email=ilike.${encodeURIComponent(loginEmail)}`);
      for (const clientData of clientRows) {
        if (!clientData.auth_id && data.user?.id) {
          try {
            await dbPatch(`clientes?id=eq.${clientData.id}`, { auth_id: data.user.id });
            clientData.auth_id = data.user.id;
          } catch (e) {}
        }
        if (clientData.nutriologo_id) {
          const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo,nombre,nombre_marca`);
          if (nut.length) {
            if (nut[0].activo === false) {
              continue; // Suspended clinic, skip this client profile
            }
            clientData.nombre_clinica = nut[0].nombre_marca || "Consultorio";
            clientData.nutriologo_nombre = nut[0].nombre;
          }
        }
        availableRoles.push({
          role: "cliente",
          data: clientData
        });
      }

      // 3. AUTO-CREACIÓN DE ATLETA INDEPENDIENTE
      // Todos los usuarios deben tener una cuenta de Atleta Independiente, EXCEPTO Nutriólogos y Superadmin
      const isNutriOrSuper = adminRole && ["nutriologo", "nutriologo_estudiante", "superadmin"].includes(adminRole);

      if (!isNutriOrSuper) {
        const hasIndep = clientRows.some(c => c.nutriologo_id === null);
        if (!hasIndep) {
          try {
            const nombreMeta = data.user?.user_metadata?.nombre || (profiles.length ? profiles[0].nombre : loginEmail.split("@")[0]);
            await dbPostMinimal("clientes", {
              nombre: nombreMeta,
              email: loginEmail,
              auth_id: data.user.id,
              activo: true,
              nutriologo_id: null
            });
            const checkAgain = await dbGet(`clientes?auth_id=eq.${data.user.id}&nutriologo_id=is.null`);
            if (checkAgain.length > 0) {
              availableRoles.push({ role: 'cliente', data: checkAgain[0] });
            }
          } catch (e) {
            console.error("No se pudo auto-crear Atleta Independiente", e);
          }
        }
      }

      if (availableRoles.length === 0) {
        setAuthToken(null); setProfileId(null);
        setErr("No se encontró un perfil activo asociado a esta cuenta.");
        setLoading(false); return;
      }

      let multiRoles = availableRoles.map(r => ({ role: r.role, data: r.data }));

      // Si ES nutriólogo o superadmin, NO le mostramos el rol "cliente" en el switch normal (usan Modo Atleta)
      if (isNutriOrSuper) {
        multiRoles = multiRoles.filter(r => r.role !== 'cliente');
      }

      if (multiRoles.length === 0) {
        setAuthToken(null); setProfileId(null);
        setErr("Tu cuenta se encuentra suspendida o sin perfiles activos.");
        setLoading(false); return;
      }

      const sorted = multiRoles.sort((a, b) => a.role === 'cliente' ? 1 : -1);
      const firstRole = sorted[0];
      // Un "civil" es un cliente sin nutriólogo asignado
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
    } catch (e) {
      setAuthToken(null);
      setProfileId(null);
      const msg = e.message || "Error al iniciar sesión";
      if (msg.toLowerCase().includes("invalid login credentials")) {
        setErr("Correo o contraseña incorrectos. Si fuiste invitado recientemente, usa el enlace de tu correo o '¿Olvidaste tu contraseña?'.");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setErr("Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada o solicita restablecer tu contraseña.");
      } else {
        setErr(msg);
      }
      setLoading(false);
    }
  };


  const submitProRequest = async () => {
    if (!avisoAceptado) {
      setErr("Debes aceptar el Aviso de Privacidad para continuar.");
      return;
    }
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
      setInfo("Solicitud enviada con éxito. Nuestro equipo la revisará pronto y recibirás un correo de invitación.");
      setMode("login");
    } catch (e) {
      setErr("Error al enviar solicitud: " + e.message);
    }
    setLoading(false);
  };

  const signUpSubmit = async () => {
    if (!avisoAceptado) {
      setErr("Debes aceptar el Aviso de Privacidad para continuar.");
      return;
    }
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
      const data = await authSignUp(email.trim(), pass, nombre.trim());
      const userObj = data?.user || data;
      const userId = userObj?.id;
      const identities = userObj?.identities;

      // En Supabase, si el correo ya existe (ej. fue invitado por un nutriólogo o ya se registró),
      // devuelve identities: [] por privacidad.
      if (Array.isArray(identities) && identities.length === 0) {
        setInfo("Este correo ya tiene una cuenta o invitación registrada. Si no tienes tu contraseña, haz clic en '¿Olvidaste tu contraseña?' para crear una nueva.");
        setMode("login");
        setLoading(false);
        return;
      }

      if (!userId) {
        throw new Error("No se pudo crear el usuario en Auth.");
      }

      // Si Supabase devolvió sesión directa (sin confirmación por correo)
      if (data?.session?.access_token) {
        try {
          await dbPostMinimal("clientes", {
            nombre: nombre.trim(),
            email: email.trim(),
            auth_id: userId,
            activo: true,
            nutriologo_id: null
          });
        } catch (e) {}
        await submit(email.trim(), pass);
        return;
      }

      // Cuando la confirmación de email está activa, intentamos crear el registro y notificamos al usuario
      try {
        await dbPostMinimal("clientes", {
          nombre: nombre.trim(),
          email: email.trim(),
          auth_id: userId,
          activo: true,
          nutriologo_id: null
        });
      } catch (postErr) {
        // El perfil de Atleta Independiente se auto-creará en el primer inicio de sesión tras confirmar correo
      }
      setPass("");
      setInfo("¡Cuenta creada! Revisa tu bandeja de entrada (y carpeta de Spam) para confirmar tu correo e iniciar sesión.");
      setMode("login");
      setLoading(false);
    } catch (e) {
      const msg = e.message || "Error al crear cuenta";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
        setErr("Este correo ya está registrado. Inicia sesión o usa '¿Olvidaste tu contraseña?'.");
        setMode("login");
      } else {
        setErr(msg);
      }
      setLoading(false);
    }
  };

  const sendReset = async () => {
    if (!email || !email.trim()) { setErr("Escribe tu correo electrónico"); return; }
    setLoading(true); setErr(""); setInfo("");
    try {
      await authResetPassword(email.trim());
      setInfo("Te enviamos un enlace a tu correo para crear o restablecer tu contraseña. Revisa también tu carpeta de Spam.");
      setMode("login");
    } catch (e) {
      setErr(e.message || "Error al enviar correo de recuperación");
    }
    setLoading(false);
  };

  const setPassword = async () => {
    if (!newPass || newPass.length < 6) { setErr("La contraseña debe tener mínimo 6 caracteres"); return; }
    if (newPass !== confirmPass) { setErr("Las contraseñas no coinciden"); return; }
    const tokenToUse = accessToken || sessionStorage.getItem('flux_pending_auth_token');
    if (!tokenToUse) {
      setErr("Tu sesión de enlace expiró. Solicita un nuevo enlace en '¿Olvidaste tu contraseña?'.");
      setMode("reset");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      const updatedUser = await authUpdatePassword(tokenToUse, newPass);
      const userEmail = (email || updatedUser?.email || sessionStorage.getItem('flux_login_email') || "").trim();

      sessionStorage.removeItem('flux_pending_auth_token');
      sessionStorage.removeItem('flux_pending_auth_type');
      sessionStorage.removeItem('flux_pending_auth_refresh');
      setAccessToken("");

      if (userEmail) {
        setEmail(userEmail);
        setPass(newPass);
        await submit(userEmail, newPass);
        return;
      }

      setInfo("¡Contraseña establecida con éxito! Ya puedes iniciar sesión.");
      setMode("login");
    } catch (e) {
      setErr(e.message || "Error al guardar la contraseña");
    }
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
        <div className={`text-center ${mode ==="reset" || mode ==="set_password" ? 'mb-6' : 'mb-5'}`}>
          {(mode ==="reset" || mode ==="set_password") && (
            <div className="mt-3 text-[13px] text-[#6B7A8D] tracking-wide">
              {mode ==="reset" ?"Recuperar contraseña" :"Crear nueva contraseña"}
            </div>
          )}
          {(mode ==="login" || mode.startsWith("signup")) && (
            <div className="flex bg-[#F0F4FA] rounded-full p-1 mx-auto w-fit mt-2">
              <button
                onClick={() => { setMode("login"); setErr(""); setInfo(""); }}
                className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${mode ==="login" ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
              >
                Iniciar Sesión
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

        {/* ── LOGIN FORM ── */}
        {mode ==="login" && <>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail size={18} />
              </div>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key ==="Enter" && submit()}
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
                type={showPass ?"text" :"password"}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key ==="Enter" && submit()}
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
            {loading ?"VERIFICANDO…" : <>ENTRAR <ArrowRight size={16} /></>}
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
        {mode ==="signup_type" && <>
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
                <p className="text-sm font-bold text-[#0B1929]">Atleta Independiente</p>
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
        {mode ==="signup_civil" && <>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre Completo</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User size={18} /></div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => e.key ==="Enter" && signUpSubmit()} placeholder="Tu nombre" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></div>
              <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key ==="Enter" && signUpSubmit()} placeholder="tu@email.com" type="email" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></div>
              <input type={showPass ?"text" :"password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key ==="Enter" && signUpSubmit()} placeholder="Mínimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          <div className="mb-4 flex items-start gap-2">
            <input type="checkbox" id="aviso_civil" checked={avisoAceptado} onChange={e => setAvisoAceptado(e.target.checked)} className="mt-1 accent-[#2e5cb8]" />
            <label htmlFor="aviso_civil" className="text-xs text-[#6B7A8D] leading-tight cursor-pointer">
              He leído y acepto el <Link to="/privacidad" className="text-[#1A6FD4] underline">Aviso de Privacidad</Link> para el tratamiento de mis datos personales y de salud.
            </label>
          </div>
          <button onClick={signUpSubmit} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
            {loading ?"CREANDO..." : <>CREAR CUENTA <ArrowRight size={16} /></>}
          </button>
          <div className="text-center">
            <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929]">Volver</button>
          </div>
        </>}

        {/* SIGNUP PRO */}
        {mode ==="signup_pro" && <>
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
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre de Consultorio/Marca</div>
            <div className="relative">
              <input value={nombreMarca} onChange={e => setNombreMarca(e.target.value)} placeholder="Ej. NutriFit" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Ubicación (Google Maps) (Opcional)</div>
            <div className="relative">
              <input value={mapaUrl} onChange={e => setMapaUrl(e.target.value)} placeholder="Enlace de Maps" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          {signupType === 'nutriologo' && (
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Número de Cédula Profesional</div>
            <div className="relative">
              <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Tu número de cédula" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          )}
          <div className="mb-4 flex items-start gap-2">
            <input type="checkbox" id="aviso_pro" checked={avisoAceptado} onChange={e => setAvisoAceptado(e.target.checked)} className="mt-1 accent-[#10B981]" />
            <label htmlFor="aviso_pro" className="text-xs text-[#6B7A8D] leading-tight cursor-pointer">
              He leído y acepto el <Link to="/privacidad" className="text-[#1A6FD4] underline">Aviso de Privacidad</Link> para el tratamiento de mis datos personales y de salud.
            </label>
          </div>
          <button onClick={submitProRequest} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#10B981] text-white hover:bg-[#059669] cursor-pointer shadow-lg shadow-emerald-500/30'}`}>
            {loading ?"ENVIANDO..." : <>ENVIAR SOLICITUD <CheckCircle size={16} /></>}
          </button>
          <div className="text-center">
            <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929]">Volver</button>
          </div>
        </>}


        {/* ── RESET FORM ── */}
        {mode ==="reset" && <>
          <div className="mb-5">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Tu email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail size={18} />
              </div>
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendReset()}
                placeholder="tu@email.com" type="email"
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"
              />
            </div>
          </div>
          <button onClick={sendReset} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1px] font-['Space_Grotesk',sans-serif] transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
            {loading ?"ENVIANDO…" :"ENVIAR ENLACE A MI CORREO"}
          </button>
          <div className="text-center">
            <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} className="bg-transparent border-none text-[#6B7A8D] text-xs cursor-pointer font-['Inter',sans-serif] transition-colors hover:text-[#2e5cb8]">
              Volver al login
            </button>
          </div>
        </>}

        {/* ── SET PASSWORD FORM ── */}
        {mode ==="set_password" && <>
          {email && (
            <div className="mb-4 bg-[#F0F4FA] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#0B1929]">
              <Mail size={15} className="text-[var(--brand-primary)] shrink-0" />
              <div className="truncate">
                <span className="text-[#6B7A8D] mr-1">Cuenta:</span>
                <span className="font-semibold">{email}</span>
              </div>
            </div>
          )}
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nueva contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input type={showPass ?"text" :"password"} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
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
              <input type={showPass ?"text" :"password"} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={e => e.key ==="Enter" && setPassword()} placeholder="Repite tu contraseña" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button onClick={setPassword} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1px] font-['Space_Grotesk',sans-serif] transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
            {loading ?"GUARDANDO…" :"ESTABLECER CONTRASEÑA Y ENTRAR"}
          </button>
          <div className="text-center">
            <button
              onClick={() => {
                sessionStorage.removeItem('flux_pending_auth_token');
                sessionStorage.removeItem('flux_pending_auth_type');
                sessionStorage.removeItem('flux_pending_auth_refresh');
                setAccessToken("");
                setMode("login");
                setErr("");
                setInfo("");
              }}
              className="bg-transparent border-none text-[#6B7A8D] text-xs cursor-pointer font-['Inter',sans-serif] transition-colors hover:text-[#2e5cb8]"
            >
              Volver al login
            </button>
          </div>
        </>}

        {/* Footer */}
        <div className="mt-7 text-center text-[10px] text-[#6B7A8D] tracking-[2px] uppercase font-['Space_Grotesk',sans-serif]">
          KEEP GOING 💪
        </div>
      </div>
    </div>
  );
}
