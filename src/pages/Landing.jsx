import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { dbGet } from "../lib/supabase";
import { version } from "../../package.json";
import {
  Star, MapPin, ChevronRight, Smartphone, Globe, LogIn,
  Search, Filter, Mail, CheckCircle, Zap, Shield, Users,
  User, X, Menu, MessageCircle, Dumbbell, Activity, Utensils,
  QrCode, ExternalLink, ArrowRight, Sparkles, Flame, Clock,
  Share2, Play
} from "lucide-react";
import {
  peekLandingConfig,
  fetchLandingConfig,
  formatWhatsAppUrl,
  getActiveSalesWhatsApp
} from "../lib/landingConfig";

function Stars({ n }) {
  const safeN = typeof n === 'number' && !isNaN(n) ? n : 5;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={11}
          fill={i <= Math.round(safeN) ? "#1A6FD4" : "none"}
          stroke={i <= Math.round(safeN) ? "#1A6FD4" : "#CBD5E1"}
        />
      ))}
    </div>
  );
}

// ── NAVBAR ──
function Navbar({ session, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { label: "App", href: "#app-showcase" },
    { label: "Suplementos", href: "#suplementos" },
    { label: "Ropa", href: "#ropa" },
    { label: "Nutriólogos", href: "#nutriologos" },
    { label: "Descargas", href: "#descargas" },
  ];
  const hasAppAccess = !!session;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img src="/flux_logo.jpeg" alt="Flux" className="w-8 h-8 rounded-xl object-cover shadow-xs" />
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>FLUX</p>
            <p className="text-[8px] font-semibold tracking-widest text-[#1A6FD4] uppercase -mt-0.5">Health System</p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-6 flex-1">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-[#6B7A8D] hover:text-[#1A6FD4] transition-colors font-semibold"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3 ml-auto flex-shrink-0">
          {!session ? (
            <>
              <Link
                to="/login"
                onClick={() => sessionStorage.setItem('flux_login_mode', 'login')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#1A6FD4] font-semibold transition-colors"
              >
                <LogIn size={15} strokeWidth={1.5} /> Iniciar sesión
              </Link>
              <Link
                to="/login"
                onClick={() => sessionStorage.setItem('flux_login_mode', 'signup_type')}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--brand-primary)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all shadow-xs"
              >
                Comenzar Gratis <ChevronRight size={14} />
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2 py-1 text-xs sm:text-sm text-[#6B7A8D] font-medium">
                <User size={14} strokeWidth={1.5} /> Hola, {session.data?.nombre || "Usuario"}
              </span>
              <button onClick={onLogout} className="text-xs sm:text-sm text-red-500 hover:text-red-600 font-semibold cursor-pointer">
                Salir
              </button>
            </div>
          )}

          {hasAppAccess && (
            <Link
              to="/app"
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0B1929] text-white text-sm font-bold rounded-xl hover:bg-[#1E2D3D] transition-all shadow-xs"
            >
              <Globe size={14} strokeWidth={2} /> Ir a tu App
            </Link>
          )}
        </div>

        <button
          className="md:hidden ml-auto text-[#0B1929] cursor-pointer p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Abrir menú móvil"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Menú Móvil */}
      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-[#E2E5EA] shadow-xl p-5 flex flex-col gap-4 animate-in fade-in">
          <nav className="flex flex-col gap-3 pb-4 border-b border-[#E2E5EA]">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-bold text-[#0B1929] hover:text-[#1A6FD4]"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            {!session ? (
              <>
                <Link
                  to="/login"
                  onClick={() => {
                    sessionStorage.setItem('flux_login_mode', 'login');
                    setMobileOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 text-sm font-bold text-[#0B1929] py-2.5 rounded-xl border border-[#E2E5EA] bg-gray-50"
                >
                  <LogIn size={16} /> Iniciar sesión
                </Link>
                <Link
                  to="/login"
                  onClick={() => {
                    sessionStorage.setItem('flux_login_mode', 'signup_type');
                    setMobileOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 text-sm font-bold text-white py-2.5 rounded-xl bg-[var(--brand-primary)] shadow-sm"
                >
                  Comenzar Gratis <ChevronRight size={16} />
                </Link>
              </>
            ) : (
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#6B7A8D]">
                  <User size={16} /> Mi Cuenta ({session.data?.nombre || "Usuario"})
                </span>
                <button onClick={onLogout} className="text-sm text-red-500 font-bold cursor-pointer">
                  Salir
                </button>
              </div>
            )}

            {hasAppAccess && (
              <Link
                to="/app"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 text-sm font-bold text-white py-2.5 rounded-xl bg-[#0B1929] mt-1 shadow-sm"
              >
                <Globe size={16} /> Ir a tu App
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

// ── SMARTPHONE MOCKUP (SHOWCASE INTERACTIVO DE LA APP) ──
function HeroPhoneMockup({ config }) {
  const screenshots = config?.app_screenshots || [];
  const [selectedScreenIdx, setSelectedScreenIdx] = useState(0);

  const hasScreenshots = screenshots.length > 0;

  return (
    <div className="relative mx-auto w-full max-w-[320px] sm:max-w-[340px]">
      {/* Resplandor decorativo de fondo */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500/20 via-sky-400/20 to-emerald-400/20 rounded-[48px] blur-2xl -z-10" />

      {/* Marco del Smartphone */}
      <div className="relative bg-[#0B1929] rounded-[42px] p-3 shadow-2xl border-4 border-[#1E2D3D] ring-1 ring-white/10 flex flex-col overflow-hidden aspect-[9/18.5]">
        {/* Notch / Dynamic Island */}
        <div className="w-28 h-4 bg-black rounded-full mx-auto mb-2.5 shrink-0 flex items-center justify-end px-3">
          <div className="w-2 h-2 rounded-full bg-[#1E2D3D]" />
        </div>

        {/* Pantalla del Teléfono */}
        <div className="flex-1 bg-[#F7F9FC] rounded-[30px] overflow-hidden flex flex-col text-[#0B1929] relative shadow-inner">
          {hasScreenshots ? (
            // Modo Capturas Reales subidas por el Superadmin
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 relative overflow-hidden bg-black">
                <img
                  src={screenshots[selectedScreenIdx]?.url}
                  alt={screenshots[selectedScreenIdx]?.title || "App Screen"}
                  className="w-full h-full object-cover animate-in fade-in duration-300"
                />
              </div>
              {/* Selector de capturas */}
              <div className="bg-white/95 backdrop-blur-md p-2.5 border-t border-[#E2E8F0] shrink-0">
                <div className="flex items-center justify-center gap-1.5">
                  {screenshots.map((s, idx) => (
                    <button
                      key={s.id || idx}
                      onClick={() => setSelectedScreenIdx(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        selectedScreenIdx === idx ? 'w-6 bg-[var(--brand-primary)]' : 'w-2 bg-gray-300'
                      }`}
                      title={s.title || `Captura ${idx + 1}`}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-bold text-center text-[#6B7A8D] mt-1 truncate">
                  {screenshots[selectedScreenIdx]?.title || "Previsualización Oficial"}
                </p>
              </div>
            </div>
          ) : (
            // Modo Interfaz Interactiva Simulada en CSS de Alta Fidelidad
            <div className="p-3.5 flex flex-col h-full justify-between select-none">
              {/* Barra de Estado y Header */}
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center font-bold text-xs">
                      FL
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#0B1929] leading-tight">FLUX App</p>
                      <p className="text-[8px] font-semibold text-emerald-600">Plan Atleta Pro</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    ★ Premium
                  </span>
                </div>

                {/* Widget 1: Nutrición & Macros del Día */}
                <div className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-2xs mb-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#0B1929]">
                      <Utensils size={12} className="text-[#1A6FD4]" /> Macros del Día
                    </div>
                    <span className="text-[10px] font-bold text-[#1A6FD4]">2,150 / 2,400 kcal</span>
                  </div>
                  {/* Barra de calorías */}
                  <div className="w-full bg-[#F0F4FA] h-2 rounded-full overflow-hidden mb-2">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full w-[88%] rounded-full" />
                  </div>
                  {/* Píldoras de nutrientes */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-blue-50 p-1 rounded-lg border border-blue-100">
                      <p className="text-[8px] text-[#6B7A8D] uppercase font-bold">Prot</p>
                      <p className="text-[10px] font-bold text-blue-700">165g</p>
                    </div>
                    <div className="bg-amber-50 p-1 rounded-lg border border-amber-100">
                      <p className="text-[8px] text-[#6B7A8D] uppercase font-bold">Carbs</p>
                      <p className="text-[10px] font-bold text-amber-700">220g</p>
                    </div>
                    <div className="bg-emerald-50 p-1 rounded-lg border border-emerald-100">
                      <p className="text-[8px] text-[#6B7A8D] uppercase font-bold">Grasas</p>
                      <p className="text-[10px] font-bold text-emerald-700">62g</p>
                    </div>
                  </div>
                </div>

                {/* Widget 2: Entrenamiento Activo con Temporizador */}
                <div className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-2xs mb-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#0B1929]">
                      <Dumbbell size={12} className="text-emerald-600" /> Rutina en Curso
                    </div>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      Serie 3 de 4
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-[#0B1929] truncate">Press de Banca con Barra</p>
                  <p className="text-[9px] text-[#6B7A8D] mb-2">80 kg × 8 reps • RPE 8.5</p>

                  {/* Burbuja animada del temporizador */}
                  <div className="flex items-center justify-between bg-[#0B1929] text-white px-2.5 py-1.5 rounded-xl text-[10px] font-bold">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span>Descanso</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 font-mono">
                      <Clock size={11} />
                      <span>01:15</span>
                    </div>
                  </div>
                </div>

                {/* Widget 3: Biometría & Somatocarta */}
                <div className="bg-white rounded-2xl p-2.5 border border-[#E2E8F0] shadow-2xs">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-[#0B1929] flex items-center gap-1">
                      <Activity size={11} className="text-purple-600" /> Masa Muscular
                    </span>
                    <span className="font-bold text-emerald-600">+1.8 kg (Último ciclo)</span>
                  </div>
                </div>
              </div>

              {/* Barra inferior simulada */}
              <div className="bg-white p-2 rounded-2xl border border-[#E2E8F0] flex items-center justify-around text-[#6B7A8D] text-[9px] font-bold">
                <span className="text-[var(--brand-primary)] flex flex-col items-center">
                  <Utensils size={12} /> Dieta
                </span>
                <span className="flex flex-col items-center">
                  <Dumbbell size={12} /> Rutina
                </span>
                <span className="flex flex-col items-center">
                  <Activity size={12} /> Progreso
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HERO ──
function Hero({ config }) {
  return (
    <section id="app-showcase" className="pt-28 pb-16 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
      <div className="flex-1 max-w-2xl text-center lg:text-left">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[#1A6FD4] text-xs font-bold tracking-wider uppercase mb-6 shadow-2xs">
          <Zap size={13} className="fill-[#1A6FD4]" /> Ecosistema FLUX Health &amp; Sport
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0B1929] leading-[1.1] mb-6 tracking-tight" style={{ fontFamily: "DM Sans, sans-serif" }}>
          Revoluciona tu <span className="text-[#1A6FD4]">salud y entrenamiento</span>
        </h1>

        <p className="text-[#6B7A8D] text-base sm:text-lg mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
          La plataforma definitiva que combina nutrición clínica personalizada, entrenamiento guiado con temporizador de descanso inteligente y monitoreo científico de tu composición corporal.
        </p>

        {/* Botones Principales de Conversión */}
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5">
          <Link
            to="/login"
            onClick={() => sessionStorage.setItem('flux_login_mode', 'signup_type')}
            className="bg-[var(--brand-primary)] hover:opacity-95 text-white px-7 py-3.5 rounded-xl font-bold transition-all shadow-md flex items-center gap-2 text-sm sm:text-base cursor-pointer"
          >
            Comenzar Gratis <ChevronRight size={18} />
          </Link>

          <Link
            to="/app"
            className="bg-white hover:bg-gray-50 text-[#0B1929] border border-[#E2E5EA] px-6 py-3.5 rounded-xl font-bold transition-all shadow-xs flex items-center gap-2 text-sm sm:text-base cursor-pointer"
          >
            <Globe size={17} className="text-[#1A6FD4]" /> Usar App Web (PWA)
          </Link>
        </div>

        {/* Insignias de Disponibilidad */}
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-6">
          {config?.playstore_activo && config?.playstore_url ? (
            <a
              href={config.playstore_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
            >
              <Smartphone size={14} className="text-emerald-600" />
              <span>Disponible en Google Play</span>
              <ExternalLink size={12} />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F0F4FA] border border-[#E2E8F0] text-xs font-semibold text-[#6B7A8D]">
              <Smartphone size={14} className="text-[#1A6FD4]" />
              <span>Google Play: <strong className="text-[#0B1929]">Fase Beta / Próximamente</strong></span>
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
            <CheckCircle size={14} /> 100% Funcional en Navegador Web
          </div>
        </div>
      </div>

      {/* Mockup del Teléfono Inteligente */}
      <div className="flex-1 w-full flex justify-center lg:justify-end">
        <HeroPhoneMockup config={config} />
      </div>
    </section>
  );
}

// ── PROPUESTA DE VALOR (FEATURES) ──
function Features() {
  return (
    <section className="py-16 bg-white border-y border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-[#F7F9FC] transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-[#1A6FD4]">
            <Dumbbell size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#0B1929] mb-1 text-base">Entrenamiento Guiado</h3>
            <p className="text-xs sm:text-sm text-[#6B7A8D] leading-relaxed">
              Rutinas estructuradas con temporizador de descanso automático, registro de RPE, series y cargas reales.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-[#F7F9FC] transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0 text-emerald-600">
            <Utensils size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#0B1929] mb-1 text-base">Nutrición &amp; Macros con IA</h3>
            <p className="text-xs sm:text-sm text-[#6B7A8D] leading-relaxed">
              Metas calóricas exactas, biblioteca de platillos y auditoría inteligente de tus comidas diarias.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-[#F7F9FC] transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center flex-shrink-0 text-purple-600">
            <Activity size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#0B1929] mb-1 text-base">Evolución &amp; Biometría</h3>
            <p className="text-xs sm:text-sm text-[#6B7A8D] leading-relaxed">
              Gráficas históricas de grasa y músculo, somatocarta Heath-Carter y mapa de desarrollo muscular.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SECCIÓN SUPLEMENTOS (CON PEDIDOS DIRECTOS POR WHATSAPP) ──
function SupplementsSection({ supplements, config }) {
  const safeSupplements = Array.isArray(supplements) ? supplements : [];
  const isTiendaActiva = config?.tienda_activa !== false;

  const getBuyLink = (prod) => {
    // Si tiene enlace externo asignado por el admin, lo usamos
    if (config?.external_links?.[prod.id]) {
      return { url: config.external_links[prod.id], isExternal: true };
    }
    // Si no, generamos el enlace de WhatsApp
    const number = getActiveSalesWhatsApp(config);
    let msg = config?.whatsapp_mensaje || "¡Hola FLUX! Me interesa adquirir [producto] por $[precio].";
    msg = msg.replace(/\[producto\]/gi, prod.name || "producto");
    msg = msg.replace(/\[precio\]/gi, `${prod.price || 0}`);
    return { url: formatWhatsAppUrl(number, msg), isExternal: false };
  };

  return (
    <section id="suplementos" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#1A6FD4] uppercase mb-1.5">Nutrición Deportiva</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>
              Suplementos FLUX
            </h2>
            <p className="text-[#6B7A8D] mt-1.5 text-xs sm:text-sm">
              Fórmulas respaldadas por la ciencia. Pedidos directos con atención personalizada.
            </p>
          </div>
        </div>

        {!isTiendaActiva || safeSupplements.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-[#F7F9FC] rounded-3xl border border-[#E2E5EA] text-center w-full">
            <h3 className="text-xl font-bold text-[#0B1929] mb-1.5">Próximamente disponible</h3>
            <p className="text-[#6B7A8D] text-xs sm:text-sm max-w-md">
              La nueva línea de suplementos oficiales FLUX está en preparación. ¡Muy pronto podrás adquirirlos aquí!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {safeSupplements.map((s) => {
              const { url, isExternal } = getBuyLink(s);
              const flavors = Array.isArray(s.flavors) ? s.flavors : [];

              return (
                <div key={s.id} className="group bg-white rounded-3xl border border-[#E2E5EA] overflow-hidden hover:shadow-md hover:border-[#1A6FD4]/40 transition-all flex flex-col">
                  <div className="relative h-48 bg-[#F0F4FB] overflow-hidden">
                    <img
                      src={s.img && !s.img.startsWith('photo-') ? s.img : '/flux_logo.jpeg'}
                      alt={s.name || 'Producto'}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/flux_logo.jpeg'; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {s.tag && (
                      <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg ${s.badge || 'bg-gray-100 text-[#0B1929]'}`}>
                        {s.tag}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <p className="text-[10px] text-[#6B7A8D] font-mono mb-1">{s.subtitle}</p>
                    <h3 className="text-sm font-bold text-[#0B1929] mb-2">{s.name}</h3>

                    <div className="flex items-center gap-1.5 mb-3">
                      <Stars n={s.rating} />
                      <span className="text-[11px] text-[#6B7A8D] font-mono">{s.rating || 5}</span>
                    </div>

                    {flavors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {flavors.map((f, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-[#F0F2F5] text-[#6B7A8D] rounded-md font-medium">
                            {String(f)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#F0F4FA]">
                      <span className="text-lg font-bold text-[#0B1929]">
                        ${s.price || 0} <span className="text-[11px] font-normal text-[#6B7A8D]">MXN</span>
                      </span>

                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                          isExternal
                            ? 'bg-[#0B1929] text-white hover:bg-[#1E2D3D]'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isExternal ? (
                          <><span>Comprar</span> <ExternalLink size={12} /></>
                        ) : (
                          <><MessageCircle size={13} /> <span>Pedir por WhatsApp</span></>
                        )}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ── SECCIÓN ROPA DEPORTIVA (CON PEDIDOS DIRECTOS POR WHATSAPP) ──
function ApparelSection({ apparel, config }) {
  const safeApparel = Array.isArray(apparel) ? apparel : [];
  const isTiendaActiva = config?.tienda_activa !== false;

  const getBuyLink = (prod) => {
    if (config?.external_links?.[prod.id]) {
      return { url: config.external_links[prod.id], isExternal: true };
    }
    const number = getActiveSalesWhatsApp(config);
    let msg = config?.whatsapp_mensaje || "¡Hola FLUX! Me interesa adquirir [producto] por $[precio].";
    msg = msg.replace(/\[producto\]/gi, prod.name || "ropa");
    msg = msg.replace(/\[precio\]/gi, `${prod.price || 0}`);
    return { url: formatWhatsAppUrl(number, msg), isExternal: false };
  };

  return (
    <section id="ropa" className="py-20 bg-[#F7F9FC] border-t border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#1A6FD4] uppercase mb-1.5">Ropa &amp; Accesorios</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>
              Colección FLUX Wear
            </h2>
            <p className="text-[#6B7A8D] mt-1.5 text-xs sm:text-sm">
              Prendas de alta durabilidad y tecnología anti-sudor diseñadas para entrenar sin límites.
            </p>
          </div>
        </div>

        {!isTiendaActiva || safeApparel.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-[#E2E5EA] text-center w-full">
            <h3 className="text-xl font-bold text-[#0B1929] mb-1.5">Colección en camino</h3>
            <p className="text-[#6B7A8D] text-xs sm:text-sm max-w-md">
              Estamos confeccionando la nueva ropa deportiva FLUX con materiales de grado competitivo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {safeApparel.map((a) => {
              const { url, isExternal } = getBuyLink(a);
              const sizes = Array.isArray(a.sizes) ? a.sizes : [];

              return (
                <div key={a.id} className="group bg-white rounded-3xl border border-[#E2E5EA] overflow-hidden hover:shadow-md hover:border-[#1A6FD4]/40 transition-all flex flex-col">
                  <div className="relative h-60 bg-[#E8ECF2] overflow-hidden">
                    <img
                      src={a.img && !a.img.startsWith('photo-') ? a.img : '/flux_logo.jpeg'}
                      alt={a.name}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/flux_logo.jpeg'; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-sm font-bold text-[#0B1929] mb-1 truncate">{a.name}</h3>
                    <p className="text-xs text-[#6B7A8D] line-clamp-1 mb-3">{a.subtitle}</p>

                    {sizes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {sizes.map((sz, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 border border-[#E2E8F0] text-[#6B7A8D] rounded-md font-mono">
                            {String(sz)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#F0F4FA]">
                      <span className="text-lg font-bold text-[#0B1929]">${a.price}</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                          isExternal
                            ? 'bg-[#0B1929] text-white hover:bg-[#1E2D3D]'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isExternal ? (
                          <><span>Comprar</span> <ExternalLink size={12} /></>
                        ) : (
                          <><MessageCircle size={13} /> <span>Pedir por WhatsApp</span></>
                        )}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ── RED DE NUTRIÓLOGOS CERTIFICADOS ──
function NutritionistsSection({ nutritionists }) {
  const [search, setSearch] = useState("");
  const safeNutris = Array.isArray(nutritionists) ? nutritionists : [];
  const filtered = safeNutris.filter(
    (n) => (n.name || '').toLowerCase().includes(search.toLowerCase()) ||
           (n.specialty || '').toLowerCase().includes(search.toLowerCase()) ||
           (n.location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section id="nutriologos" className="py-20 bg-white border-t border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <p className="text-xs font-bold tracking-widest text-[#1A6FD4] uppercase mb-1.5">Directorio de Especialistas</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans, sans-serif" }}>
            Nutriólogos y Entrenadores Certificados
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7A8D]">
            Profesionales de la salud verificados en la plataforma FLUX para atenderte presencial o en línea.
          </p>

          {safeNutris.length > 0 && (
            <div className="flex gap-3 mt-5">
              <div className="flex items-center gap-2 flex-1 max-w-md bg-[#F7F9FC] rounded-2xl border border-[#E2E8F0] px-4 h-11 focus-within:border-[#1A6FD4] transition-colors">
                <Search size={16} className="text-[#6B7A8D] flex-shrink-0" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Buscar especialista por nombre, zona o enfoque..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm text-[#0B1929]"
                />
              </div>
            </div>
          )}
        </div>

        {safeNutris.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-[#F7F9FC] rounded-3xl border border-[#E2E8F0] text-center w-full">
            <h3 className="text-xl font-bold text-[#0B1929] mb-1.5">Directorio en actualización</h3>
            <p className="text-[#6B7A8D] text-xs sm:text-sm max-w-md">
              Pronto podrás consultar a los nutriólogos verificados por FLUX y agendar tu cita directa.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((n) => {
              const isEstudiante = n.role === "nutriologo_estudiante";
              return (
              <div key={n.id} className="relative bg-white rounded-3xl border border-[#E2E8F0] p-5 hover:shadow-md hover:border-[#1A6FD4]/40 transition-all flex flex-col justify-between">
                {/* Banner Esquina Superior Derecha: Profesional vs Estudiante */}
                <span
                  className={`absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isEstudiante
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-blue-50 text-[#1A6FD4] border-blue-200"
                  }`}
                >
                  {isEstudiante ? "Estudiante" : "Profesional"}
                </span>

                <div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative flex-shrink-0">
                      <img
                        src={n.img || "/flux_logo.jpeg"}
                        alt={n.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/flux_logo.jpeg";
                        }}
                        className="w-14 h-14 rounded-2xl object-cover bg-[#E8ECF2]"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${n.available ? "bg-emerald-500" : "bg-[#CBD5E1]"}`} />
                    </div>
                    <div className="flex-1 min-w-0 pr-20">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-bold text-[#0B1929] leading-tight">{n.name}</h3>
                        {n.verified && <CheckCircle size={14} className="text-[#1A6FD4] flex-shrink-0" />}
                      </div>
                      {n.specialty && (
                        <p className="text-xs text-[#6B7A8D] mt-1 line-clamp-1">{n.specialty}</p>
                      )}
                      {n.location && (
                        <p className="text-[11px] font-mono text-[#9BA5B0] mt-1 flex items-center gap-1">
                          <MapPin size={11} className="shrink-0" /> <span className="truncate">{n.location}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7A8D] bg-[#F0F4FB] px-3 py-2 rounded-xl mb-4">
                    {n.reviewCount > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star size={12} className="fill-[#1A6FD4] text-[#1A6FD4]" /> {n.rating.toFixed(1)} ({n.reviewCount} {n.reviewCount === 1 ? "reseña" : "reseñas"})
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#9BA5B0] italic">Sin reseñas</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-[#F0F4FA]">
                  {n.telefono && (
                    <a
                      href={`https://wa.me/${n.telefono.replace(/\D/g, '').length === 10 ? '52' + n.telefono.replace(/\D/g, '') : n.telefono.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle size={14} /> Contactar por WhatsApp
                    </a>
                  )}
                  {n.mapa_url && (
                    <a
                      href={n.mapa_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-white border border-[#E2E8F0] text-[#0B1929] hover:border-[#1A6FD4] h-9 rounded-xl text-xs font-semibold transition-all flex items-center justify-center"
                    >
                      Ver ubicación en mapa
                    </a>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ── SECCIÓN DESCARGAS Y ACCESO (LLEVA FLUX CONTIGO) ──
function Downloads({ config }) {
  const isPlayStoreActive = Boolean(config?.playstore_activo && config?.playstore_url);
  const qrTarget = config?.qr_destino_url || (typeof window !== "undefined" ? `${window.location.origin}/app` : "https://www.flux-sport.com/app");
  const qrSrc = config?.qr_imagen_url || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrTarget)}`;

  return (
    <section id="descargas" className="py-20 bg-[#F7F9FC] border-t border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold tracking-widest text-[#1A6FD4] uppercase mb-1.5">Acceso Multiplataforma</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            Lleva FLUX siempre contigo
          </h2>
          <p className="text-[#6B7A8D] text-xs sm:text-sm mt-2">
            Disfruta de una experiencia fluida, rápida y sincronizada en tiempo real desde tu teléfono, tablet o computadora.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Tarjeta 1: Web / PWA */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between hover:border-[var(--brand-primary)] transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center mb-4">
                <Globe size={24} />
              </div>
              <h3 className="text-base font-bold text-[#0B1929] mb-1">App Web Progresiva (PWA)</h3>
              <p className="text-xs text-[#6B7A8D] leading-relaxed mb-4">
                Accede al instante desde Chrome, Safari o cualquier navegador. Puedes instalarla como app nativa sin ocupar memoria.
              </p>
            </div>
            <Link
              to="/app"
              className="w-full bg-[var(--brand-primary)] text-white text-xs font-bold py-2.5 rounded-xl text-center hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-xs"
            >
              Abrir App en Navegador <ArrowRight size={14} />
            </Link>
          </div>

          {/* Tarjeta 2: Google Play */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between hover:border-[var(--brand-primary)] transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Smartphone size={24} />
              </div>
              <h3 className="text-base font-bold text-[#0B1929] mb-1">Android (Google Play)</h3>
              <p className="text-xs text-[#6B7A8D] leading-relaxed mb-4">
                {isPlayStoreActive
                  ? "Descarga la aplicación oficial directamente desde Google Play Store en tu dispositivo Android."
                  : "Actualmente en fase de pruebas cerrada para optimizar el rendimiento y la experiencia nativa."}
              </p>
            </div>
            {isPlayStoreActive ? (
              <a
                href={config.playstore_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl text-center transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Smartphone size={14} /> Descargar en Google Play
              </a>
            ) : (
              <div className="w-full bg-[#F0F4FA] text-[#6B7A8D] text-xs font-bold py-2.5 rounded-xl text-center border border-[#E2E8F0]">
                Próximamente en Play Store
              </div>
            )}
          </div>

          {/* Tarjeta 3: Código QR */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between items-center text-center hover:border-[var(--brand-primary)] transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 mx-auto">
                <QrCode size={24} />
              </div>
              <h3 className="text-base font-bold text-[#0B1929] mb-1">Escanear para el Móvil</h3>
              <p className="text-xs text-[#6B7A8D] leading-relaxed mb-3">
                Apunta la cámara de tu celular para abrir FLUX directo en tu teléfono.
              </p>
            </div>
            {/* Visual real del QR Escaneable */}
            <div className="w-24 h-24 bg-[#0B1929] p-1.5 rounded-2xl flex items-center justify-center shadow-xs overflow-hidden">
              <img
                src={qrSrc}
                alt="QR Code"
                className="w-full h-full object-contain rounded-xl bg-white p-0.5"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FOOTER DINÁMICO CON REDES EDITABLES ──
function Footer({ config }) {
  const whatsAppNumber = config?.whatsapp_soporte || config?.whatsapp_ventas || "7751016733";
  const whatsAppUrl = formatWhatsAppUrl(whatsAppNumber, "Hola FLUX, tengo una consulta sobre la plataforma.");
  const emailContact = config?.email_contacto || "Flux.Sport.C@gmail.com";

  return (
    <footer className="bg-[#04080F] text-[#9BA5B0] py-16 border-t border-[#1E293B]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/flux_logo.jpeg" alt="Flux" className="w-8 h-8 rounded-xl object-cover" />
              <span className="font-bold text-white text-lg tracking-tight" style={{ fontFamily: "DM Sans, sans-serif" }}>FLUX</span>
            </div>
            <p className="text-xs text-[#6B7A8D] mb-6 leading-relaxed">
              La plataforma integral definitiva para atletas, entrenadores y profesionales de la salud.
            </p>

            {/* Redes Sociales Dinámicas */}
            <div className="flex items-center gap-3">
              {/* WhatsApp */}
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors"
                title="WhatsApp Oficial"
              >
                <MessageCircle size={16} />
              </a>

              {/* Instagram */}
              {config?.instagram_url && (
                <a
                  href={config.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-pink-600 hover:text-white flex items-center justify-center transition-colors"
                  title="Instagram"
                >
                  <Share2 size={16} />
                </a>
              )}

              {/* TikTok */}
              {config?.tiktok_url && (
                <a
                  href={config.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white hover:text-black flex items-center justify-center transition-colors font-bold text-xs"
                  title="TikTok"
                >
                  TT
                </a>
              )}

              {/* YouTube */}
              {config?.youtube_url && (
                <a
                  href={config.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors"
                  title="YouTube"
                >
                  <Play size={16} />
                </a>
              )}

              {/* Correo */}
              <a
                href={`mailto:${emailContact}`}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-[var(--brand-primary)] hover:text-white flex items-center justify-center transition-colors"
                title="Correo de Contacto"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-4">Plataforma</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/app" className="hover:text-white transition-colors">Abrir App Web (PWA)</Link></li>
              <li><Link to="/login" onClick={() => sessionStorage.setItem('flux_login_mode', 'login')} className="hover:text-white transition-colors">Iniciar Sesión</Link></li>
              <li><Link to="/login" onClick={() => sessionStorage.setItem('flux_login_mode', 'signup_type')} className="hover:text-white transition-colors">Crear Cuenta Gratis</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-4">Ecosistema</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#app-showcase" className="hover:text-white transition-colors">Entrenamiento &amp; Nutrición</a></li>
              <li><a href="#suplementos" className="hover:text-white transition-colors">Suplementación</a></li>
              <li><a href="#ropa" className="hover:text-white transition-colors">Ropa Deportiva</a></li>
              <li><a href="#nutriologos" className="hover:text-white transition-colors">Directorio de Nutriólogos</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-4">Soporte &amp; Contacto</h4>
            <ul className="space-y-2 text-xs">
              <li><a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp de Soporte</a></li>
              <li><a href={`mailto:${emailContact}`} className="hover:text-white transition-colors">{emailContact}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1E293B] flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} FLUX Sports &amp; Health System. Todos los derechos reservados.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacidad" className="hover:text-white transition-colors">Aviso de Privacidad</Link>
            <Link to="/terminos" className="hover:text-white transition-colors">Términos y Condiciones</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── COMPONENTE PRINCIPAL LANDING ──
export default function Landing({ session, onLogout }) {
  const [dbSupplements, setDbSupplements] = useState([]);
  const [dbApparel, setDbApparel] = useState([]);
  const [dbNutritionists, setDbNutritionists] = useState([]);
  const [config, setConfig] = useState(() => peekLandingConfig());

  useEffect(() => {
    // 1. Cargar Configuración de Landing / Tienda
    fetchLandingConfig().then(cfg => {
      if (cfg) setConfig(cfg);
    });

    const onConfigUpdated = (ev) => {
      if (ev?.detail) setConfig(ev.detail);
    };
    window.addEventListener("flux:landing-config-updated", onConfigUpdated);

    // 2. Cargar Catálogo de Productos y Nutriólogos
    const loadData = async () => {
      try {
        const prod = await dbGet('productos?activo=eq.true');
        if (Array.isArray(prod) && prod.length > 0) {
          const mappedProd = prod.map(p => ({
            id: p.id,
            name: p.nombre,
            subtitle: p.subtitulo,
            price: p.precio,
            rating: p.rating,
            reviews: p.num_reviews,
            tag: p.badge,
            img: p.imagen_url || '/flux_logo.jpeg',
            flavors: Array.isArray(p.variantes) ? p.variantes : [],
            sizes: Array.isArray(p.variantes) ? p.variantes : [],
            categoria: p.categoria,
            badge: p.badge ? 'bg-blue-100 text-blue-700' : ''
          }));
          setDbSupplements(mappedProd.filter(p => p.categoria === 'suplemento'));
          setDbApparel(mappedProd.filter(p => p.categoria === 'ropa'));
        } else {
          setDbSupplements([]);
          setDbApparel([]);
        }
      } catch (e) {
        console.error('Error cargando productos', e);
        setDbSupplements([]);
        setDbApparel([]);
      }

      try {
        let nutris = await dbGet('profiles?select=id,nombre,role,nombre_marca,especialidad,ubicacion_texto,mapa_url,verificado,logo_url,telefono,email&role=in.(nutriologo,nutriologo_estudiante)');
        if (!Array.isArray(nutris) || nutris.length === 0) {
          nutris = await dbGet('directorio_nutriologos_publicos?select=*');
        }
        const allRatings = await dbGet('citas_ratings?select=nutriologo_id,puntuacion') || [];

        const ratingsMap = {};
        allRatings.forEach(r => {
          if (!ratingsMap[r.nutriologo_id]) ratingsMap[r.nutriologo_id] = { sum: 0, count: 0 };
          ratingsMap[r.nutriologo_id].sum += r.puntuacion;
          ratingsMap[r.nutriologo_id].count += 1;
        });

        if (Array.isArray(nutris) && nutris.length > 0) {
          const formattedNutris = nutris.map(n => {
            const rawLogo = (n.logo_url || '').trim();
            const validImg = rawLogo && !rawLogo.startsWith('photo-') ? rawLogo : '/flux_logo.jpeg';
            return {
              id: n.id,
              name: n.nombre_marca || n.nombre || 'Especialista',
              role: n.role || 'nutriologo',
              specialty: (n.especialidad || '').trim(),
              location: (n.ubicacion_texto || '').trim(),
              rating: ratingsMap[n.id] ? (ratingsMap[n.id].sum / ratingsMap[n.id].count) : 0,
              reviewCount: ratingsMap[n.id] ? ratingsMap[n.id].count : 0,
              patients: 0,
              available: true,
              img: validImg,
              verified: n.verificado || false,
              mapa_url: n.mapa_url || '',
              telefono: n.telefono || '',
              email: n.email || ''
            };
          });
          setDbNutritionists(formattedNutris);
        }
      } catch (e) {
        console.error('Error cargando nutris', e);
      }
    };

    loadData();

    const onCacheUpdated = (ev) => {
      const tbl = ev?.detail?.table;
      if (!tbl || ["*", "profiles", "productos", "citas_ratings", "directorio_nutriologos_publicos"].includes(tbl)) {
        loadData();
      }
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("focus", loadData);

    return () => {
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:landing-config-updated", onConfigUpdated);
      window.removeEventListener("focus", loadData);
    };
  }, []);

  const activeSupplements = dbSupplements;
  const activeApparel = dbApparel;

  return (
    <div className="min-h-screen bg-white text-[#0B1929] font-['Inter',sans-serif]">
      <Navbar session={session} onLogout={onLogout} />
      <Hero config={config} />
      <Features />
      <SupplementsSection supplements={activeSupplements} config={config} />
      <ApparelSection apparel={activeApparel} config={config} />
      <NutritionistsSection nutritionists={dbNutritionists} />
      <Downloads config={config} />
      <Footer config={config} />
    </div>
  );
}
