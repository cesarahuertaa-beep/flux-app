import { useState } from "react";
import { Link } from "react-router-dom";
import { dbGet } from "../lib/supabase";
import { useEffect } from "react";
import { version } from "../../package.json";
import {
  ShoppingCart, Star, MapPin, ChevronRight, Monitor, Smartphone,
  Globe, LogIn, Search, Filter, Phone, Mail, Share2,
  CheckCircle, Leaf, Zap, Shield, Users, User, X, Menu,
} from "lucide-react";

const MOCK_SUPPLEMENTS = [
  { id: 1, name: "Proteína Whey Flux", subtitle: "Aislada + Concentrada", price: 899, rating: 4.9, reviews: 218, tag: "Más vendido", img: "photo-1593095948071-474c5cc2989d", flavors: ["Chocolate", "Vainilla", "Fresa"], badge: "bg-blue-100 text-blue-700" },
  { id: 2, name: "Creatina Monohidratada", subtitle: "Fuerza y recuperación", price: 449, rating: 4.8, reviews: 143, tag: "Nuevo", img: "photo-1584308666744-24d5c474f2ae", flavors: ["Sin sabor"], badge: "bg-green-100 text-green-700" },
  { id: 3, name: "Pre-Entreno Flux Rush", subtitle: "Energía sostenida | Sin crash", price: 649, rating: 4.7, reviews: 97, tag: null, img: "photo-1571019614242-c5c5dee9f50b", flavors: ["Sandía", "Blue Raspberry"], badge: "" },
  { id: 4, name: "BCAA + Electrolitos", subtitle: "Recuperación muscular", price: 549, rating: 4.8, reviews: 185, tag: null, img: "photo-1593095948071-474c5cc2989d", flavors: ["Limón", "Mango"], badge: "" },
];

const MOCK_APPAREL = [
  { id: 1, name: "Playera Compression Pro", subtitle: "Tejido técnico anti-sudor", price: 699, rating: 4.9, reviews: 132, img: "photo-1521572163474-6864f9cf17ab", sizes: ["S","M","L","XL"], color: "#1A6FD4" },
  { id: 2, name: "Shorts Training Flux", subtitle: "Ergonómico | 4-way stretch", price: 549, rating: 4.7, reviews: 88, img: "photo-1605296867304-46d5465a13f1", sizes: ["S","M","L","XL","XXL"], color: "#0B1929" },
];

const MOCK_NUTRITIONISTS = [
  { id: 1, name: "Dra. Andrea Torres", specialty: "Nutrición deportiva | Pérdida de grasa", location: "CDMX | Colonia Nápoles", rating: 4.9, patients: 312, available: true, img: "photo-1559839734-2b71ea197ec2", verified: true },
  { id: 2, name: "Dr. Miguel Sánchez", specialty: "Nutrición clínica | Masa muscular", location: "CDMX | Polanco", rating: 4.8, patients: 187, available: true, img: "photo-1612349317150-e413f6a5b16d", verified: true },
];

const MOCK_MAPPINS = [
  { top: "28%", left: "38%", name: "Dra. Andrea Torres", available: true },
  { top: "32%", left: "52%", name: "Dr. Miguel Sánchez", available: true },
];

function Stars({ n }) {
  const safeN = typeof n === 'number' && !isNaN(n) ? n : 5;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} size={11} fill={i <= Math.round(safeN) ? "#1A6FD4" : "none"} stroke={i <= Math.round(safeN) ? "#1A6FD4" : "#CBD5E1"} />
      ))}
    </div>
  );
}

function Navbar({ session, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = ["Suplementos", "Ropa", "Nutriólogos"];
  const hasAppAccess = session && (session.role !== 'client' || !!session.data?.nutriologo_id);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <img src="/flux_logo.jpeg" alt="Flux" className="w-8 h-8 rounded-xl object-cover" />
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>FLUX</p>
            <p className="text-[8px] font-semibold tracking-widest text-[#1A6FD4] uppercase -mt-0.5">Health System</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 ml-8 flex-1">
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} className="text-sm text-[#6B7A8D] hover:text-[#1A6FD4] transition-colors font-medium">{l}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2 ml-auto flex-shrink-0">
          {!session ? (
            <Link to="/login" className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#1A6FD4] font-medium transition-colors"><LogIn size={15} strokeWidth={1.5} /> Iniciar sesión</Link>
          ) : (
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] font-medium"><User size={15} strokeWidth={1.5}/> Hola, {session.data?.nombre || "Usuario"}</span>
              <button onClick={onLogout} className="text-sm text-red-500 hover:text-red-600 font-medium">Salir</button>
            </div>
          )}
          
          {hasAppAccess && (
            <>
              <div className="w-px h-5 bg-[#E2E5EA] ml-2" />
              <a
                href={`https://github.com/cesarahuertaa-beep/flux-app/releases/download/v${version}/FLUX.Setup.${version}.exe`}
                download
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#0B1929] font-medium transition-colors"
              >
                <Monitor size={14} strokeWidth={1.5} /> Windows (v{version})
              </a>
              <a
                href="/FLUX.apk"
                download
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#0B1929] font-medium transition-colors"
              >
                <Smartphone size={14} strokeWidth={1.5} /> Android (v{version})
              </a>
              <Link to="/app" className="flex items-center gap-1.5 px-4 py-2 bg-[#1A6FD4] text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-blue-200">
                <Globe size={14} strokeWidth={2} /> Ir a tu App
              </Link>
            </>
          )}
        </div>
        <button className="md:hidden ml-auto text-[#0B1929]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-[#E2E5EA] shadow-xl p-4 flex flex-col gap-4">
          <nav className="flex flex-col gap-3 pb-4 border-b border-[#E2E5EA]">
            {links.map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileOpen(false)} className="text-sm font-semibold text-[#0B1929]">{l}</a>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            {!session ? (
              <Link to="/login" className="flex items-center gap-2 text-sm font-semibold text-[#6B7A8D]">
                <LogIn size={16} /> Iniciar sesión
              </Link>
            ) : (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#6B7A8D]"><User size={16}/> Mi Cuenta</span>
                <button onClick={onLogout} className="text-sm text-red-500 font-medium">Salir</button>
              </div>
            )}
            
            {hasAppAccess && (
              <Link to="/app" className="flex items-center gap-2 text-sm font-semibold text-[#1A6FD4] mt-2">
                <Globe size={16} /> Ir a tu App
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
      <div className="flex-1 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold tracking-widest uppercase mb-6">
          <Zap size={12} className="fill-blue-600" /> Nuevo Ecosistema Flux
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-[#0B1929] leading-[1.05] mb-6 tracking-tight" style={{ fontFamily: "DM Sans, sans-serif" }}>
          Revoluciona tu <span className="text-[#1A6FD4] bg-clip-text">entrenamiento</span>
        </h1>
        <p className="text-[#6B7A8D] text-lg md:text-xl mb-10 leading-relaxed max-w-lg">
          La plataforma definitiva que unifica suplementación premium, ropa deportiva de alto rendimiento y la mejor red de especialistas.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a href="#suplementos" className="bg-[#0B1929] hover:bg-[#1A2D45] text-white px-8 py-4 rounded-xl font-bold transition-colors shadow-lg shadow-black/10">
            Ver tienda
          </a>
          <a href="#nutriólogos" className="bg-white hover:bg-gray-50 text-[#0B1929] border border-[#E2E5EA] px-8 py-4 rounded-xl font-bold transition-all hover:border-[#1A6FD4]/30 shadow-sm flex items-center gap-2">
            Encontrar especialista <ChevronRight size={16} />
          </a>
        </div>
        {/* Botones de descarga de la App */}
        <div className="flex flex-wrap items-center gap-3 mt-6">
          <p className="text-xs text-[#9BA5B0] w-full font-medium uppercase tracking-widest">Descarga la app:</p>
          <a
            href="/FLUX.apk"
            download
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1A6FD4]/10 border border-[#1A6FD4]/20 text-[#1A6FD4] text-sm font-semibold hover:bg-[#1A6FD4]/20 transition-all"
          >
            <Smartphone size={16} /> Android (v{version})
          </a>
          <a
            href={`https://github.com/cesarahuertaa-beep/flux-app/releases/download/v${version}/FLUX.Setup.${version}.exe`}
            download
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 border border-[#E2E5EA] text-[#0B1929] text-sm font-semibold hover:bg-gray-200 transition-all"
          >
            <Monitor size={16} /> Windows (v{version})
          </a>
        </div>
      </div>
      <div className="flex-1 w-full relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-transparent rounded-[3rem] -z-10 transform rotate-3 scale-105 opacity-50" />
        <img
          src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&fit=crop"
          alt="Athlete training"
          className="rounded-[2.5rem] shadow-2xl object-cover w-full h-[500px]"
        />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="py-20 bg-white border-y border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-[#1A6FD4]">
            <CheckCircle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#0B1929] mb-1.5">Calidad Premium</h3>
            <p className="text-sm text-[#6B7A8D] leading-relaxed">Fórmulas aprobadas por especialistas y materiales de grado competitivo.</p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 text-emerald-600">
            <Users size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#0B1929] mb-1.5">Red Verificada</h3>
            <p className="text-sm text-[#6B7A8D] leading-relaxed">Conecta solo con nutriólogos y entrenadores certificados por Flux.</p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 text-amber-600">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#0B1929] mb-1.5">Garantía Total</h3>
            <p className="text-sm text-[#6B7A8D] leading-relaxed">Si no te adaptas a tu plan o equipo, lo resolvemos sin costo adicional.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SupplementsSection({ supplements }) {
  const [cart, setCart] = useState([]);
  const safeSupplements = Array.isArray(supplements) ? supplements : [];
  
  return (
    <section id="suplementos" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#1A6FD4] uppercase mb-2">Suplementación</p>
            <h2 className="text-4xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>Suplementos Flux</h2>
            <p className="text-[#6B7A8D] mt-2 text-sm">Formulados con tu nutriólogo. Respaldados por ciencia.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {safeSupplements.map((s) => {
            const inCart = cart.includes(s.id);
            const flavors = Array.isArray(s.flavors) ? s.flavors : [];
            return (
              <div key={s.id} className="group bg-white rounded-2xl border border-[#E2E5EA] overflow-hidden hover:shadow-md hover:border-[#1A6FD4]/30 transition-all">
                <div className="relative h-48 bg-[#F0F4FB]">
                  <img
                    src={s.img.startsWith('photo-') ? `https://images.unsplash.com/${s.img}?w=500&h=300&fit=crop&auto=format` : s.img}
                    alt={s.name || 'Producto'}
                    className="w-full h-full object-cover"
                  />
                  {s.tag && (
                    <span className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full ${s.badge || 'bg-gray-100'}`}>{s.tag}</span>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-[10px] text-[#6B7A8D] font-mono mb-1">{s.subtitle}</p>
                  <h3 className="text-base font-semibold text-[#0B1929] mb-2">{s.name}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Stars n={s.rating} />
                    <span className="text-xs text-[#6B7A8D] font-mono">{s.rating || 5} ({s.reviews || 0})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {flavors.map((f, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-[#F0F2F5] text-[#6B7A8D] rounded">{String(f)}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>${s.price || 0} <span className="text-xs font-normal text-[#6B7A8D]">MXN</span></span>
                    <button
                      onClick={() => setCart(inCart ? cart.filter((x) => x !== s.id) : [...cart, s.id])}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${inCart ? "bg-green-50 text-green-600 border border-green-200" : "bg-[#1A6FD4] text-white hover:bg-blue-600"}`}
                    >
                      {inCart ? <><CheckCircle size={13} /> Agregado</> : <><ShoppingCart size={13} /> Agregar</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ApparelSection({ apparel }) {
  const [cart, setCart] = useState([]);
  const safeApparel = Array.isArray(apparel) ? apparel : [];

  return (
    <section id="ropa" className="py-24 bg-[#F7F9FC] border-t border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#1A6FD4] uppercase mb-2">Ropa Deportiva</p>
            <h2 className="text-4xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>Colección Flux</h2>
            <p className="text-[#6B7A8D] mt-2 text-sm">Diseñado para rendir. Hecho para durar.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {safeApparel.map((a) => {
            const inCart = cart.includes(a.id);
            const sizes = Array.isArray(a.sizes) ? a.sizes : [];
            return (
              <div key={a.id} className="group bg-white rounded-2xl border border-[#E2E5EA] overflow-hidden hover:shadow-md hover:border-[#1A6FD4]/30 transition-all">
                <div className="relative h-64 bg-[#E8ECF2]">
                  <img
                    src={a.img && a.img.startsWith('photo-') ? `https://images.unsplash.com/${a.img}?w=500&h=600&fit=crop&auto=format` : (a.img || '')}
                    alt={a.name}
                    className="w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4 border-t border-[#E2E5EA]">
                  <h3 className="text-sm font-semibold text-[#0B1929] mb-1 truncate">{a.name}</h3>
                  <div className="flex flex-wrap gap-1 mb-4 mt-2">
                    {sizes.map((sz, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 border border-[#E2E5EA] text-[#6B7A8D] rounded font-mono">{String(sz)}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-[#0B1929]">${a.price}</span>
                    <button
                      onClick={() => setCart(inCart ? cart.filter((x) => x !== a.id) : [...cart, a.id])}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${inCart ? "bg-green-50 text-green-600 border border-green-200" : "bg-[#0B1929] text-white hover:bg-[#1A2D45]"}`}
                    >
                      {inCart ? "Agregado" : "Agregar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function NutritionistsSection({ nutritionists }) {
  const [search, setSearch] = useState("");
  const safeNutris = Array.isArray(nutritionists) ? nutritionists : [];
  const filtered = safeNutris.filter(
    (n) => (n.name || '').toLowerCase().includes(search.toLowerCase()) || 
           (n.specialty || '').toLowerCase().includes(search.toLowerCase()) || 
           (n.location || '').toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <section id="nutriólogos" className="py-24 bg-white border-t border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest text-[#1A6FD4] uppercase mb-2">Red Flux</p>
          <h2 className="text-4xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans, sans-serif" }}>Nutriólogos certificados</h2>
          <div className="flex gap-3 mt-4">
            <div className="flex items-center gap-2 flex-1 max-w-sm bg-[#F7F9FC] rounded-xl border border-[#E2E5EA] px-4 h-11 focus-within:border-[#1A6FD4] transition-colors">
              <Search size={15} className="text-[#6B7A8D] flex-shrink-0" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar por nombre, especialidad o zona..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-sm text-[#0B1929]"
              />
            </div>
            <button className="h-11 px-4 rounded-xl border border-[#E2E5EA] text-[#0B1929] flex items-center gap-2 hover:bg-gray-50 transition-colors">
              <Filter size={15} /> <span className="hidden sm:inline text-sm font-medium">Filtros</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((n) => (
            <div key={n.id} className="bg-white rounded-2xl border border-[#E2E5EA] p-5 hover:shadow-md hover:border-[#1A6FD4]/30 transition-all">
              <div className="flex items-start gap-4 mb-4">
                <div className="relative flex-shrink-0">
                  <img
                    src={n.img && n.img.startsWith('photo-') ? `https://images.unsplash.com/${n.img}?w=80&h=80&fit=crop&auto=format&face` : (n.img || '')}
                    alt={n.name}
                    className="w-14 h-14 rounded-2xl object-cover bg-[#E8ECF2]"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${n.available ? "bg-green-400" : "bg-[#CBD5E1]"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-[#0B1929] leading-tight">{n.name}</h3>
                    {n.verified && <CheckCircle size={13} className="text-[#1A6FD4] flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-[#6B7A8D] mt-1 line-clamp-1">{n.specialty}</p>
                  <p className="text-[11px] font-mono text-[#9BA5B0] mt-1 flex items-center gap-1"><MapPin size={10} /> {n.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-[#6B7A8D] bg-[#F0F4FB] p-2.5 rounded-xl">
                <div className="flex items-center gap-1">
                  <Star size={12} className="fill-[#1A6FD4] text-[#1A6FD4]" /> {n.rating || 5.0}
                </div>
              </div>
              {n.mapa_url ? (
                <a href={n.mapa_url} target="_blank" rel="noopener noreferrer" className="w-full mt-4 bg-white border border-[#E2E5EA] text-[#0B1929] hover:border-[#1A6FD4] hover:text-[#1A6FD4] h-10 rounded-xl text-sm font-semibold transition-all flex items-center justify-center">
                  Ver ubicación en Google Maps
                </a>
              ) : (
                <button className="w-full mt-4 bg-white border border-[#E2E5EA] text-[#0B1929] hover:border-[#1A6FD4] hover:text-[#1A6FD4] h-10 rounded-xl text-sm font-semibold transition-all">
                  Contacto (Próximamente)
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MapSection({ mapPins }) {
  const [activePin, setActivePin] = useState(null);
  const safeMapPins = Array.isArray(mapPins) ? mapPins : [];
  
  return (
    <section id="mapa" className="py-24 bg-[#F7F9FC] border-t border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 relative rounded-3xl overflow-hidden border border-[#E2E5EA] shadow-sm" style={{ height: 420 }}>
            <iframe
              title="Map"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-99.2131%2C19.3879%2C-99.1415%2C19.4449&amp;layer=mapnik"
              className="w-full h-full border-0 opacity-50"
            />
            <div className="absolute inset-0 pointer-events-none">
              {safeMapPins.map((pin, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{ top: pin.top || '50%', left: pin.left || '50%', transform: "translate(-50%,-50%)" }}
                  onClick={() => setActivePin(activePin === i ? null : i)}
                >
                  <div className={`w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-transform hover:scale-110 ${pin.available ? "bg-[#1A6FD4]" : "bg-[#9BA5B0]"}`}>
                    <MapPin size={14} strokeWidth={2} className="text-white" />
                  </div>
                  {activePin === i && (
                    <div className="absolute left-1/2 bottom-10 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-[#E2E5EA] px-3 py-2 text-xs whitespace-nowrap z-10">
                      <p className="font-semibold text-[#0B1929]">{pin.name || 'Especialista'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Downloads() {
  return (
    <section className="py-24 bg-white border-t border-[#E2E5EA]">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold text-[#0B1929] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Lleva Flux contigo</h2>
        <p className="text-[#6B7A8D] text-lg mb-10 max-w-xl mx-auto">
          Gestiona tus entrenamientos, dieta y consultas desde nuestra app nativa o plataforma de escritorio.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#04080F] text-[#9BA5B0] py-16 border-t border-[#1E293B]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5 mb-6">
            <img src="/flux_logo.jpeg" alt="Flux" className="w-8 h-8 rounded-xl object-cover grayscale brightness-200" />
            <span className="font-bold text-white text-lg tracking-tight" style={{ fontFamily: "DM Sans, sans-serif" }}>FLUX</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Landing({ session, onLogout }) {
  const [dbSupplements, setDbSupplements] = useState([]);
  const [dbApparel, setDbApparel] = useState([]);
  const [dbNutritionists, setDbNutritionists] = useState([]);
  const [dbMapPins, setDbMapPins] = useState([]);

  useEffect(() => {
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
            img: p.imagen_url || 'photo-1593095948071-474c5cc2989d',
            flavors: Array.isArray(p.variantes) ? p.variantes : [],
            sizes: Array.isArray(p.variantes) ? p.variantes : [],
            categoria: p.categoria,
            badge: p.badge ? 'bg-blue-100 text-blue-700' : ''
          }));
          setDbSupplements(mappedProd.filter(p => p.categoria === 'suplemento'));
          setDbApparel(mappedProd.filter(p => p.categoria === 'ropa'));
        }
      } catch (e) { console.error('Error cargando productos', e); }

      try {
        const nutris = await dbGet('profiles?activo=eq.true&role=in.(nutriologo,superadmin,admin)&select=id,nombre,nombre_marca,especialidad,ubicacion_texto,mapa_url,verificado,logo_url');
        if (Array.isArray(nutris) && nutris.length > 0) {
          const formattedNutris = nutris.map(n => ({
            id: n.id,
            name: n.nombre_marca || n.nombre || 'Especialista',
            specialty: n.especialidad || 'Nutrición Integral',
            location: n.ubicacion_texto || 'Consulta Online',
            rating: n.rating || 5.0,
            patients: 0,
            available: true,
            img: n.logo_url || 'photo-1559839734-2b71ea197ec2',
            verified: n.verificado || false,
            mapa_url: n.mapa_url || ''
          }));
          setDbNutritionists(formattedNutris);

          const pins = nutris.filter(n => n.pin_top && n.pin_left).map(n => ({
            top: n.pin_top,
            left: n.pin_left,
            name: n.nombre_marca || n.nombre || 'Especialista',
            available: true
          }));
          setDbMapPins(pins);
        }
      } catch (e) { console.error('Error cargando nutris', e); }
    };
    loadData();
  }, []);

  const activeSupplements = dbSupplements.length > 0 ? dbSupplements : MOCK_SUPPLEMENTS;
  const activeApparel = dbApparel.length > 0 ? dbApparel : MOCK_APPAREL;
  const activeNutritionists = dbNutritionists.length > 0 ? dbNutritionists : MOCK_NUTRITIONISTS;
  const activeMapPins = dbMapPins.length > 0 ? dbMapPins : MOCK_MAPPINS;

  return (
    <div className="min-h-screen bg-white text-[#0B1929] font-['Inter',sans-serif]">
      <Navbar session={session} onLogout={onLogout} />
      <Hero />
      <Features />
      <SupplementsSection supplements={activeSupplements} />
      <ApparelSection apparel={activeApparel} />
      <NutritionistsSection nutritionists={activeNutritionists} />
      {/* <MapSection mapPins={activeMapPins} /> */}
      <Downloads />
      <Footer />
    </div>
  );
}
