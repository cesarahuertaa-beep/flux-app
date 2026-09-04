import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag, MapPin, Smartphone, Monitor, Globe, User } from "lucide-react";

export default function Landing({ session }) {
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1929] flex flex-col font-['Inter',sans-serif]">
      
      {/* Navbar */}
      <nav className="w-full bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Flux Logo" className="h-8" />
          <span className="font-['Space_Grotesk',sans-serif] font-bold text-xl tracking-tight">FLUX</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/#tienda" className="hidden md:block text-sm font-semibold text-[#6B7A8D] hover:text-[#0B1929] transition-colors">
            Tienda
          </Link>
          <Link to="/#directorio" className="hidden md:block text-sm font-semibold text-[#6B7A8D] hover:text-[#0B1929] transition-colors mr-2">
            Nutriólogos
          </Link>
          
          {session ? (
            <Link to="/app" className="bg-[var(--brand-primary)] hover:opacity-90 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition-opacity flex items-center gap-2">
              <User size={16} /> Mi Panel
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-[#6B7A8D] hover:text-[#0B1929] transition-colors">
                Iniciar Sesión
              </Link>
              <Link to="/login" className="bg-[var(--brand-primary)] hover:opacity-90 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition-opacity flex items-center gap-2">
                Entrar <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-8 md:mt-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-blue-50 text-[var(--brand-primary)] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-blue-100 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Plataforma Multi-dispositivo
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 font-['Space_Grotesk',sans-serif] text-[#0B1929]">
          Evoluciona tu <span className="text-[var(--brand-primary)]">Entrenamiento</span>
        </h1>
        
        <p className="text-lg md:text-xl text-[#6B7A8D] max-w-2xl mb-12">
          La plataforma definitiva que conecta pacientes con los mejores nutriólogos. Accede desde cualquier lugar, compra suplementos y lleva tu progreso al siguiente nivel.
        </p>
        
        {/* Call To Actions - Hub */}
        <div className="flex flex-col md:flex-row items-center gap-4 w-full max-w-3xl justify-center mb-20">
          <Link to={session ? "/app" : "/login"} className="w-full md:w-auto bg-[var(--brand-primary)] hover:opacity-90 text-white px-8 py-4 rounded-2xl text-[15px] font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3 hover:-translate-y-1">
            <Globe size={20} />
            Abrir Web App
          </Link>
          
          <button onClick={() => alert("La descarga del APK estará disponible muy pronto.")} className="w-full md:w-auto bg-white hover:bg-gray-50 text-[#0B1929] border border-[#E2E8F0] px-8 py-4 rounded-2xl text-[15px] font-bold shadow-sm transition-all flex items-center justify-center gap-3 hover:-translate-y-1">
            <Smartphone size={20} className="text-emerald-500" />
            Descargar Celular
          </button>
          
          <button onClick={() => alert("La versión de escritorio estará disponible muy pronto.")} className="w-full md:w-auto bg-white hover:bg-gray-50 text-[#0B1929] border border-[#E2E8F0] px-8 py-4 rounded-2xl text-[15px] font-bold shadow-sm transition-all flex items-center justify-center gap-3 hover:-translate-y-1">
            <Monitor size={20} className="text-indigo-500" />
            Descargar PC
          </button>
        </div>
        
        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl text-left">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E2E8F0] flex gap-5 items-start hover:shadow-md transition-shadow">
            <div className="w-14 h-14 shrink-0 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center">
              <ShoppingBag size={28} />
            </div>
            <div>
              <h3 className="font-bold text-xl mb-2 text-[#0B1929] font-['Space_Grotesk',sans-serif]">Tienda Oficial Flux</h3>
              <p className="text-[#6B7A8D] leading-relaxed">Explora nuestro catálogo de ropa deportiva, suplementos y equipo de entrenamiento con envío directo a tu domicilio.</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E2E8F0] flex gap-5 items-start hover:shadow-md transition-shadow">
            <div className="w-14 h-14 shrink-0 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
              <MapPin size={28} />
            </div>
            <div>
              <h3 className="font-bold text-xl mb-2 text-[#0B1929] font-['Space_Grotesk',sans-serif]">Directorio Médico</h3>
              <p className="text-[#6B7A8D] leading-relaxed">Encuentra nutriólogos y especialistas del deporte verificados cerca de ti. Agenda consultas y mejora tu salud.</p>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer simple */}
      <footer className="w-full text-center p-8 text-[#6B7A8D] text-sm border-t border-[#E2E8F0] mt-12 bg-white">
        © {new Date().getFullYear()} Flux Health System. Todos los derechos reservados.
      </footer>
    </div>
  );
}
