import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, User,
  Dumbbell, Apple, TrendingUp, ShoppingBag, ShieldCheck, ArrowLeft
} from "lucide-react";
import {
  authSignIn, authResetPassword, authUpdatePassword, setAuthToken,
  setProfileId, dbGet, authSignUp, dbPost, dbPostMinimal, dbPatch,
  captureAuthHashSynchronously
} from "../lib/supabase";

const FALLBACK_SHOWCASE = [
  { id: "fb-1", name: "FLUX Clinical", specialty: "Nutrición Clínica", logo_url: "/flux_logo.jpeg", verified: true, badge: "Especialistas" },
  { id: "fb-2", name: "FLUX Performance", specialty: "Alto Rendimiento", logo_url: "/flux_logo.jpeg", verified: true, badge: "Entrenamiento" },
  { id: "fb-3", name: "FLUX Sports", specialty: "Ecosistema Integral", logo_url: "/flux_logo.jpeg", verified: true, badge: "Certificado" },
  { id: "fb-4", name: "FLUX Anthropometry", specialty: "Composición Corporal", logo_url: "/flux_logo.jpeg", verified: true, badge: "ISAK / Progreso" },
  { id: "fb-5", name: "FLUX Lab", specialty: "Suplementación", logo_url: "/flux_logo.jpeg", verified: true, badge: "Evidencia" },
];

// Semilla semanal determinista para rotación justa entre nutriólogos registrados
function getWeeklySeed() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
  return now.getFullYear() * 100 + weekNumber;
}

function seededShuffle(array, seed) {
  const copy = [...array];
  let m = copy.length;
  let s = seed;
  while (m) {
    s = (s * 9301 + 49297) % 233280;
    const i = Math.floor((s / 233280) * m--);
    const t = copy[m];
    copy[m] = copy[i];
    copy[i] = t;
  }
  return copy;
}

export default function Login({ onLogin }) {
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('flux_pending_auth_token') || "");
  const [mode, setMode] = useState(() => {
    if (sessionStorage.getItem('flux_pending_auth_token')) return "set_password";
    if (sessionStorage.getItem('flux_pending_auth_error')) return "reset";
    if (sessionStorage.getItem('flux_pending_auth_info')) return "login";
    const saved = sessionStorage.getItem('flux_login_mode') || "welcome";
    if (saved === "set_password" && !sessionStorage.getItem('flux_pending_auth_token')) return "welcome";
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
  const [nutriPool, setNutriPool] = useState([]);

  // Sincronizar color de barras del sistema en Android y PWA según la pantalla activa
  useEffect(() => {
    const color = showSplash ? "#FFFFFF" : "#060E1A";
    const darkIcons = Boolean(showSplash);
    if (typeof document !== "undefined") {
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute("content", color);
    }
    if (typeof window !== "undefined" && window.FluxAndroidBars) {
      try {
        window.FluxAndroidBars.setBars(color, darkIcons);
      } catch (e) {}
    }
  }, [showSplash, mode]);

  // Cargar nutriólogos públicos para el escaparate rotativo superior
  useEffect(() => {
    let active = true;
    const fetchShowcaseNutris = async () => {
      try {
        const nutris = await dbGet('directorio_nutriologos_publicos?select=id,nombre,nombre_marca,especialidad,verificado,logo_url');
        if (active && Array.isArray(nutris) && nutris.length > 0) {
          const valid = nutris.map(n => ({
            id: n.id,
            name: n.nombre_marca || n.nombre || "Especialista FLUX",
            specialty: n.especialidad || "Nutrición y Deporte",
            logo_url: n.logo_url || "/flux_logo.jpeg",
            verified: Boolean(n.verificado),
            badge: n.verificado ? "Verificado" : "Especialista"
          }));
          setNutriPool(valid);
        }
      } catch (e) {
        // Silencioso: usa el fallback de la marca
      }
    };
    fetchShowcaseNutris();
    return () => { active = false; };
  }, []);

  // Construir las 5 tarjetas del escaparate con rotación semanal justa
  const showcaseCards = useMemo(() => {
    const seed = getWeeklySeed();
    const withLogo = nutriPool.filter(n => n.logo_url && !n.logo_url.startsWith("photo-"));
    const withoutLogo = nutriPool.filter(n => !n.logo_url || n.logo_url.startsWith("photo-"));
    const rotated = [
      ...seededShuffle(withLogo, seed),
      ...seededShuffle(withoutLogo, seed + 1)
    ];

    const finalFive = [];
    for (let i = 0; i < 5; i++) {
      if (rotated[i]) {
        finalFive.push(rotated[i]);
      } else {
        finalFive.push(FALLBACK_SHOWCASE[i]);
      }
    }
    return finalFive;
  }, [nutriPool]);

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

    const timer1 = setTimeout(() => setFadeSplash(true), 1800);
    const timer2 = setTimeout(() => setShowSplash(false), 2500);

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
            const recienCreado = await dbGet(`clientes?auth_id=eq.${data.user.id}&nutriologo_id=is.null`);
            if (recienCreado && recienCreado.length > 0) {
              availableRoles.push({
                role: "cliente",
                data: recienCreado[0]
              });
            }
          } catch (postErr) {
            console.error("Failed to auto-create independent profile:", postErr);
          }
        }
      }

      if (availableRoles.length === 0) {
        if (adminRole && profiles.length && profiles[0].activo === false) {
          setErr("Tu cuenta de especialista se encuentra suspendida o en revisión.");
        } else {
          setErr("No se encontró un perfil activo asociado a este correo.");
        }
        setLoading(false);
        return;
      }

      const priority = {
        superadmin: 1,
        staff: 2,
        nutriologo: 3,
        nutriologo_estudiante: 4,
        administrativo: 5,
        cliente: 6
      };

      availableRoles.sort((a, b) => {
        if (a.role === "cliente" && b.role === "cliente") {
          if (a.data.nutriologo_id && !b.data.nutriologo_id) return -1;
          if (!a.data.nutriologo_id && b.data.nutriologo_id) return 1;
          return 0;
        }
        return (priority[a.role] || 99) - (priority[b.role] || 99);
      });

      const primary = availableRoles[0];
      const isCivilUser = primary.role === "cliente" && !primary.data.nutriologo_id;
      const finalPrimaryRole = isCivilUser ? "civil" : primary.role;

      onLogin({
        role: finalPrimaryRole,
        data: primary.data,
        token: data.access_token,
        refresh_token: data.refresh_token,
        profileId: data.user.id,
        multiRoles: availableRoles
      });
    } catch (e) {
      setErr("ERR_CATCH:" + (e.message || "Credenciales incorrectas"));
    }
    setLoading(false);
  };

  const submitProRequest = async () => {
    if (!nombre || !nombre.trim() || !email || !email.trim()) {
      setErr("Completa tu nombre y correo electrónico");
      return;
    }
    if (signupType === 'nutriologo' && (!cedula || !cedula.trim())) {
      setErr("La cédula profesional es obligatoria para nutriólogos titulados");
      return;
    }
    if (!avisoAceptado) {
      setErr("Debes aceptar el Aviso de Privacidad para continuar");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      await dbPost("solicitudes_registro", {
        nombre: nombre.trim(),
        email: email.trim(),
        tipo: signupType,
        cedula: signupType === 'nutriologo' ? cedula.trim() : null,
        nombre_marca: nombreMarca.trim() || null,
        mapa_url: mapaUrl.trim() || null,
        estado: "pendiente"
      });
      setInfo("¡Solicitud enviada con éxito! Revisaremos tus credenciales y te enviaremos un correo de activación pronto.");
      setMode("login");
    } catch (e) {
      setErr(e.message || "Error al enviar la solicitud");
    }
    setLoading(false);
  };

  const signUpSubmit = async () => {
    if (!nombre || !nombre.trim() || !email || !email.trim() || !pass) {
      setErr("Completa todos los campos");
      return;
    }
    if (pass.length < 6) {
      setErr("La contraseña debe tener mínimo 6 caracteres");
      return;
    }
    if (!avisoAceptado) {
      setErr("Debes aceptar el Aviso de Privacidad para crear tu cuenta");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      const data = await authSignUp(email.trim(), pass, nombre.trim());
      const userId = data?.user?.id || data?.id;
      const sessionToken = data?.session?.access_token || data?.access_token;

      if (sessionToken && userId) {
        setAuthToken(sessionToken);
        setProfileId(userId);
        try {
          await dbPostMinimal("clientes", {
            nombre: nombre.trim(),
            email: email.trim(),
            auth_id: userId,
            activo: true,
            nutriologo_id: null
          });
        } catch (postErr) {
          console.error("Client creation handled in submit:", postErr);
        }
        await submit(email.trim(), pass);
        return;
      }

      try {
        await dbPostMinimal("clientes", {
          nombre: nombre.trim(),
          email: email.trim(),
          auth_id: userId,
          activo: true,
          nutriologo_id: null
        });
      } catch (postErr) {}
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

  // Posiciones estilo Disney+ para las 5 tarjetas superiores (centro protagonista, laterales escalonados)
  const cardSlotStyles = [
    "w-[64px] h-[92px] sm:w-[78px] sm:h-[110px] opacity-75 scale-95 -mr-1.5 z-10 border-white/15",
    "w-[72px] h-[104px] sm:w-[88px] sm:h-[124px] opacity-90 scale-95 -mr-1 z-20 border-sky-400/30",
    "w-[92px] h-[132px] sm:w-[110px] sm:h-[154px] opacity-100 scale-100 z-30 border-sky-400/70 shadow-[0_0_25px_rgba(56,189,248,0.28)]",
    "w-[72px] h-[104px] sm:w-[88px] sm:h-[124px] opacity-90 scale-95 -ml-1 z-20 border-sky-400/30",
    "w-[64px] h-[92px] sm:w-[78px] sm:h-[110px] opacity-75 scale-95 -ml-1.5 z-10 border-white/15",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#061224] via-[#0B1D36] to-[#060E1A] flex flex-col justify-between relative overflow-hidden font-['Inter',sans-serif] text-white select-none">
      {/* Resplandor ambiental estilo Disney+ con colores FLUX */}
      <div className="pointer-events-none absolute top-[-10%] left-1/2 -translate-x-1/2 w-[520px] h-[420px] rounded-full bg-[#1A6FD4]/25 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-[15%] left-1/2 -translate-x-1/2 w-[380px] h-[280px] rounded-full bg-sky-500/10 blur-[95px]" />

      {/* ── Splash Screen Overlay ── */}
      {showSplash && (
        <div className={`fixed inset-0 bg-white z-50 flex items-center justify-center transition-opacity duration-[700ms] ease-out ${fadeSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <img src="/flux_logo.jpeg" alt="Flux Splash" className="w-[280px] h-auto" />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODO 1: PANTALLA DE BIENVENIDA ESTILO DISNEY+ (HERO SHOWCASE)
         ══════════════════════════════════════════════════════════════════ */}
      {mode === "welcome" ? (
        <div className="flex-1 flex flex-col justify-between w-full max-w-[460px] mx-auto px-6 pt-8 pb-6 relative z-10 animate-in">
          
          {/* 1. Escaparate Superior de 5 Nutriólogos / Especialistas en rotación */}
          <div className="flex flex-col items-center mt-2">
            <div className="flex items-center justify-center w-full py-2">
              {showcaseCards.map((card, idx) => (
                <div
                  key={card.id || idx}
                  className={`${cardSlotStyles[idx]} rounded-2xl border bg-gradient-to-b from-[#13294B] to-[#091526] p-2 flex flex-col items-center justify-between relative overflow-hidden transition-all duration-500`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060E1A] via-transparent to-transparent opacity-80 pointer-events-none" />
                  <div className="w-full flex-1 flex items-center justify-center p-1">
                    <img
                      src={card.logo_url || "/flux_logo.jpeg"}
                      alt={card.name}
                      onError={(e) => { e.currentTarget.src = "/flux_logo.jpeg"; }}
                      className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl object-cover bg-white shadow-md border border-white/20"
                    />
                  </div>
                  <div className="relative z-10 w-full text-center pb-0.5">
                    <p className="text-[9px] sm:text-[10px] font-bold text-white truncate px-1 leading-tight">
                      {card.name}
                    </p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[7px] font-semibold uppercase tracking-wider bg-white/10 text-sky-300 border border-sky-400/20">
                      {card.badge || "Especialista"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-sky-300/70 tracking-widest uppercase mt-2 font-medium">
              Especialistas destacados de la semana
            </p>
          </div>

          {/* 2. Bloque Central: Logo FLUX + Slogan Principal + Pilares + KEEP GOING */}
          <div className="flex flex-col items-center text-center my-auto py-4">
            <div className="relative mb-4">
              <div className="absolute -inset-3 rounded-3xl bg-sky-400/20 blur-xl" />
              <img
                src="/flux_logo.jpeg"
                alt="FLUX"
                className="relative w-20 h-20 rounded-2xl object-cover shadow-2xl border border-white/20 bg-white"
              />
            </div>

            <div className="tracking-[4px] text-xs font-extrabold text-sky-400 uppercase mb-1 font-['Space_Grotesk',sans-serif]">
              FLUX HEALTH SYSTEM
            </div>

            <h1 className="text-[22px] sm:text-[25px] font-extrabold text-white leading-snug max-w-[340px] mt-1" style={{ fontFamily: "DM Sans, sans-serif" }}>
              Tu nutrición clínica y entrenamiento de alto rendimiento, en un mismo lugar.
            </h1>

            {/* Barra de íconos / pilares estilo Disney + Pixar + Marvel */}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 mt-5 px-2 text-[10px] font-bold tracking-wider uppercase text-slate-300">
              <span className="flex items-center gap-1 text-sky-300">
                <Apple size={12} className="text-sky-400" /> Nutrición
              </span>
              <span className="text-slate-600">+</span>
              <span className="flex items-center gap-1 text-sky-300">
                <Dumbbell size={12} className="text-sky-400" /> Rutinas
              </span>
              <span className="text-slate-600">+</span>
              <span className="flex items-center gap-1 text-sky-300">
                <TrendingUp size={12} className="text-sky-400" /> Progreso
              </span>
              <span className="text-slate-600">+</span>
              <span className="flex items-center gap-1 text-sky-300">
                <ShoppingBag size={12} className="text-sky-400" /> Store
              </span>
            </div>
          </div>

          {/* 3. Bloque Inferior: Botón COMENZAR + Subtítulo Keep Going + Barra INICIAR SESIÓN */}
          <div className="w-full flex flex-col items-center">
            <button
              onClick={() => { setMode("signup_type"); setErr(""); setInfo(""); }}
              className="w-full py-4 rounded-xl bg-white text-[#061224] font-extrabold text-sm tracking-[2px] uppercase shadow-[0_8px_30px_rgba(255,255,255,0.18)] hover:bg-sky-50 active:scale-[0.99] transition-all cursor-pointer font-['Space_Grotesk',sans-serif]"
            >
              COMENZAR
            </button>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold tracking-[2.5px] uppercase text-sky-300/90 font-['Space_Grotesk',sans-serif]">
              <span>KEEP GOING</span>
              <span>💪</span>
            </div>

            <div className="w-full border-t border-white/10 mt-5 pt-4 text-center">
              <button
                onClick={() => { setMode("login"); setErr(""); setInfo(""); }}
                className="w-full py-2 text-xs font-bold tracking-[2px] uppercase text-white/90 hover:text-sky-300 transition-colors cursor-pointer font-['Space_Grotesk',sans-serif]"
              >
                INICIAR SESIÓN
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
            MODO 2: FORMULARIOS (LOGIN, REGISTRO, RECUPERACIÓN)
           ══════════════════════════════════════════════════════════════════ */
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative z-10">
          <div className="animate-in w-full max-w-[420px] px-7 sm:px-9 pt-7 pb-8 bg-white text-[#0B1929] rounded-3xl border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.45)] relative">
            
            {/* Botón superior para regresar a la pantalla de Bienvenida */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { setMode("welcome"); setErr(""); setInfo(""); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7A8D] hover:text-[#0B1929] transition-colors cursor-pointer"
              >
                <ArrowLeft size={15} /> Inicio
              </button>
              <div className="flex items-center gap-1.5">
                <img src="/flux_logo.jpeg" alt="Flux" className="w-6 h-6 rounded-lg object-cover" />
                <span className="text-xs font-extrabold tracking-wider text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>FLUX</span>
              </div>
            </div>

            {/* Selector Iniciar Sesión / Crear Cuenta */}
            <div className={`text-center ${mode === "reset" || mode === "set_password" ? 'mb-5' : 'mb-5'}`}>
              {(mode === "reset" || mode === "set_password") && (
                <div className="mt-1 text-sm font-bold text-[#0B1929]">
                  {mode === "reset" ? "Recuperar contraseña" : "Crear nueva contraseña"}
                </div>
              )}
              {(mode === "login" || mode.startsWith("signup")) && (
                <div className="flex bg-[#F0F4FA] rounded-full p-1 mx-auto w-full">
                  <button
                    onClick={() => { setMode("login"); setErr(""); setInfo(""); }}
                    className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${mode === "login" ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    onClick={() => { setMode("signup_type"); setErr(""); setInfo(""); }}
                    className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${mode.startsWith("signup") ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
                  >
                    Crear Cuenta
                  </button>
                </div>
              )}
            </div>

            {/* Alertas */}
            {info && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-[13px] text-green-700 mb-5 leading-relaxed flex items-center gap-2 select-text">
                <CheckCircle size={16} className="text-green-600 shrink-0" />
                <span>{info}</span>
              </div>
            )}
            {err && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-600 mb-5 leading-relaxed text-center flex items-center gap-2 justify-center select-text">
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
              <div className="mb-5 text-center">
                <h3 className="text-base font-bold text-[#0B1929] mb-1">¿Cómo usarás Flux?</h3>
                <p className="text-xs text-[#6B7A8D]">Selecciona el tipo de cuenta que deseas crear.</p>
              </div>
              <div className="flex flex-col gap-3 mb-2">
                <button onClick={() => { setSignupType("civil"); setMode("signup_civil"); }} className="p-3.5 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-3.5 hover:border-[var(--brand-primary)] hover:shadow-md transition-all text-left cursor-pointer">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-[var(--brand-primary)] shrink-0">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0B1929]">Atleta Independiente</p>
                    <p className="text-xs text-[#6B7A8D] mt-0.5">Entrena, sigue tu dieta y vincula a tu nutriólogo.</p>
                  </div>
                </button>
                <button onClick={() => { setSignupType("nutriologo"); setMode("signup_pro"); }} className="p-3.5 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-3.5 hover:border-emerald-500 hover:shadow-md transition-all text-left cursor-pointer">
                  <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0B1929]">Nutriólogo</p>
                    <p className="text-xs text-[#6B7A8D] mt-0.5">Gestiona pacientes y crea planes personalizados.</p>
                  </div>
                </button>
                <button onClick={() => { setSignupType("nutriologo_estudiante"); setMode("signup_pro"); }} className="p-3.5 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-3.5 hover:border-amber-500 hover:shadow-md transition-all text-left cursor-pointer">
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
              <div className="mb-5">
                <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Contraseña</div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></div>
                  <input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && signUpSubmit()} placeholder="Mínimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              <div className="mb-4 flex items-start gap-2">
                <input type="checkbox" id="aviso_civil" checked={avisoAceptado} onChange={e => setAvisoAceptado(e.target.checked)} className="mt-1 accent-[#2e5cb8]" />
                <label htmlFor="aviso_civil" className="text-xs text-[#6B7A8D] leading-tight cursor-pointer">
                  He leído y acepto el <Link to="/privacidad" className="text-[#1A6FD4] underline">Aviso de Privacidad</Link> para el tratamiento de mis datos personales y de salud.
                </label>
              </div>
              <button onClick={signUpSubmit} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-3 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
                {loading ? "CREANDO..." : <>CREAR CUENTA <ArrowRight size={16} /></>}
              </button>
              <div className="text-center">
                <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929] cursor-pointer">Volver</button>
              </div>
            </>}

            {/* SIGNUP PRO */}
            {mode === "signup_pro" && <>
              <div className="mb-4 text-center">
                <h3 className="text-base font-bold text-[#0B1929] mb-1">{signupType === 'nutriologo' ? 'Solicitud Nutriólogo' : 'Solicitud Estudiante de Nutrición'}</h3>
                <p className="text-xs text-[#6B7A8D]">Revisaremos tus datos para habilitar tu cuenta.</p>
              </div>
              <div className="mb-3.5">
                <div className="text-[11px] text-[#6B7A8D] mb-1.5 font-semibold uppercase tracking-[1px]">Nombre Completo</div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User size={18} /></div>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-2.5 w-full outline-none transition-all text-sm" />
                </div>
              </div>
              <div className="mb-3.5">
                <div className="text-[11px] text-[#6B7A8D] mb-1.5 font-semibold uppercase tracking-[1px]">Email</div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></div>
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" type="email" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-2.5 w-full outline-none transition-all text-sm" />
                </div>
              </div>
              <div className="mb-3.5">
                <div className="text-[11px] text-[#6B7A8D] mb-1.5 font-semibold uppercase tracking-[1px]">Nombre de Consultorio/Marca</div>
                <div className="relative">
                  <input value={nombreMarca} onChange={e => setNombreMarca(e.target.value)} placeholder="Ej. NutriFit" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 w-full outline-none transition-all text-sm" />
                </div>
              </div>
              <div className="mb-3.5">
                <div className="text-[11px] text-[#6B7A8D] mb-1.5 font-semibold uppercase tracking-[1px]">Ubicación (Google Maps) (Opcional)</div>
                <div className="relative">
                  <input value={mapaUrl} onChange={e => setMapaUrl(e.target.value)} placeholder="Enlace de Maps" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 w-full outline-none transition-all text-sm" />
                </div>
              </div>
              {signupType === 'nutriologo' && (
                <div className="mb-4">
                  <div className="text-[11px] text-[#6B7A8D] mb-1.5 font-semibold uppercase tracking-[1px]">Número de Cédula Profesional</div>
                  <div className="relative">
                    <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Tu número de cédula" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 w-full outline-none transition-all text-sm" />
                  </div>
                </div>
              )}
              <div className="mb-4 flex items-start gap-2">
                <input type="checkbox" id="aviso_pro" checked={avisoAceptado} onChange={e => setAvisoAceptado(e.target.checked)} className="mt-1 accent-[#10B981]" />
                <label htmlFor="aviso_pro" className="text-xs text-[#6B7A8D] leading-tight cursor-pointer">
                  He leído y acepto el <Link to="/privacidad" className="text-[#1A6FD4] underline">Aviso de Privacidad</Link> para el tratamiento de mis datos personales y de salud.
                </label>
              </div>
              <button onClick={submitProRequest} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-3 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#10B981] text-white hover:bg-[#059669] cursor-pointer shadow-lg shadow-emerald-500/30'}`}>
                {loading ? "ENVIANDO..." : <>ENVIAR SOLICITUD <CheckCircle size={16} /></>}
              </button>
              <div className="text-center">
                <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929] cursor-pointer">Volver</button>
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
                    onKeyDown={e => e.key === "Enter" && sendReset()}
                    placeholder="tu@email.com" type="email"
                    className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <button onClick={sendReset} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1px] font-['Space_Grotesk',sans-serif] transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
                {loading ? "ENVIANDO…" : "ENVIAR ENLACE A MI CORREO"}
              </button>
              <div className="text-center">
                <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} className="bg-transparent border-none text-[#6B7A8D] text-xs cursor-pointer font-['Inter',sans-serif] transition-colors hover:text-[#2e5cb8]">
                  Volver al login
                </button>
              </div>
            </>}

            {/* ── SET PASSWORD FORM ── */}
            {mode === "set_password" && <>
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
              <button onClick={setPassword} disabled={loading} className={`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1px] font-['Space_Grotesk',sans-serif] transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}`}>
                {loading ? "GUARDANDO…" : "ESTABLECER CONTRASEÑA Y ENTRAR"}
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
            <div className="mt-6 text-center text-[10px] text-[#6B7A8D] tracking-[2px] uppercase font-['Space_Grotesk',sans-serif]">
              KEEP GOING 💪
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
