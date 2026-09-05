import { useState } from "react";
import { Link } from "react-router-dom";
import { dbGet } from "../lib/supabase";
import { useEffect } from "react";
import {
  ShoppingCart, Star, MapPin, ChevronRight, Monitor, Smartphone,
  Globe, LogIn, Search, Filter, Phone, Mail, Share2,
  CheckCircle, Leaf, Zap, Shield, Users, X, Menu,
} from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const MOCK_SUPPLEMENTS = [
  { id: 1, name: "Proteína Whey Flux", subtitle: "Aislada + Concentrada", price: 899, rating: 4.9, reviews: 218, tag: "Más vendido", img: "photo-1593095948071-474c5cc2989d", flavors: ["Chocolate", "Vainilla", "Fresa"], badge: "bg-blue-100 text-blue-700" },
  { id: 2, name: "Creatina Monohidratada", subtitle: "Fuerza y recuperación", price: 449, rating: 4.8, reviews: 143, tag: "Nuevo", img: "photo-1584308666744-24d5c474f2ae", flavors: ["Sin sabor"], badge: "bg-green-100 text-green-700" },
  { id: 3, name: "Pre-Entreno Flux Rush", subtitle: "Energía sostenida · Sin crash", price: 649, rating: 4.7, reviews: 97, tag: null, img: "photo-1571019614242-c5c5dee9f50b", flavors: ["Sandía", "Blue Raspberry"], badge: "" },
  { id: 4, name: "BCAA + Electrolitos", subtitle: "Recuperación muscular", price: 549, rating: 4.8, reviews: 185, tag: null, img: "photo-1593095948071-474c5cc2989d", flavors: ["Limón", "Mango"], badge: "" },
  { id: 5, name: "Colágeno Marino", subtitle: "Articulaciones y piel", price: 499, rating: 4.6, reviews: 76, tag: null, img: "photo-1584308666744-24d5c474f2ae", flavors: ["Sin sabor", "Naranja"], badge: "" },
  { id: 6, name: "Omega 3 Premium", subtitle: "2000 mg EPA/DHA · Corazón", price: 379, rating: 4.9, reviews: 201, tag: "Bestseller", img: "photo-1584308666744-24d5c474f2ae", flavors: ["Cápsula"], badge: "bg-amber-100 text-amber-700" },
];

const MOCK_APPAREL = [
  { id: 1, name: "Playera Compression Pro", subtitle: "Tejido técnico anti-sudor", price: 699, rating: 4.9, reviews: 132, img: "photo-1521572163474-6864f9cf17ab", sizes: ["S","M","L","XL"], color: "#1A6FD4" },
  { id: 2, name: "Shorts Training Flux", subtitle: "Ergonómico · 4-way stretch", price: 549, rating: 4.7, reviews: 88, img: "photo-1605296867304-46d5465a13f1", sizes: ["S","M","L","XL","XXL"], color: "#0B1929" },
  { id: 3, name: "Leggings Performance", subtitle: "Compresión graduada", price: 799, rating: 4.8, reviews: 164, img: "photo-1518611012118-696072aa579a", sizes: ["XS","S","M","L","XL"], color: "#1A6FD4" },
  { id: 4, name: "Hoodie Flux Essential", subtitle: "Algodón premium · Oversized", price: 949, rating: 4.9, reviews: 209, img: "photo-1556821840-3a63f15732ce", sizes: ["S","M","L","XL"], color: "#F0F2F5" },
  { id: 5, name: "Sports Bra Define", subtitle: "Alto impacto · Secado rápido", price: 599, rating: 4.8, reviews: 91, img: "photo-1518611012118-696072aa579a", sizes: ["XS","S","M","L"], color: "#38BDF8" },
  { id: 6, name: "Gorra Flux Logo", subtitle: "5 paneles · Ajustable", price: 349, rating: 4.6, reviews: 55, img: "photo-1521572163474-6864f9cf17ab", sizes: ["Única"], color: "#0B1929" },
];

const MOCK_NUTRITIONISTS = [
  { id: 1, name: "Dra. Andrea Torres", specialty: "Nutrición deportiva · Pérdida de grasa", location: "CDMX · Colonia Nápoles", rating: 4.9, patients: 312, available: true, img: "photo-1559839734-2b71ea197ec2", verified: true },
  { id: 2, name: "Dr. Miguel Sánchez", specialty: "Nutrición clínica · Masa muscular", location: "CDMX · Polanco", rating: 4.8, patients: 187, available: true, img: "photo-1612349317150-e413f6a5b16d", verified: true },
  { id: 3, name: "Dra. Laura Vega", specialty: "Nutrición holística · Vegana", location: "Guadalajara · Zapopan", rating: 4.9, patients: 245, available: false, img: "photo-1551836022-d5d88e9218df", verified: true },
  { id: 4, name: "Dr. Carlos Ríos", specialty: "Rendimiento atlético · Suplementación", location: "Monterrey · San Pedro", rating: 4.7, patients: 198, available: true, img: "photo-1582750433449-648ed127bb54", verified: true },
  { id: 5, name: "Dra. Sofía Morales", specialty: "Nutrición pediátrica y familiar", location: "CDMX · Santa Fe", rating: 4.8, patients: 156, available: true, img: "photo-1559839734-2b71ea197ec2", verified: false },
  { id: 6, name: "Dr. Javier Luna", specialty: "Nutrición oncológica · Metabólica", location: "Puebla · Centro", rating: 4.6, patients: 134, available: false, img: "photo-1612349317150-e413f6a5b16d", verified: true },
];

const MOCK_MAPPINS = [
  { top: "28%", left: "38%", name: "Dra. Andrea Torres", available: true },
  { top: "32%", left: "52%", name: "Dr. Miguel Sánchez", available: true },
  { top: "55%", left: "22%", name: "Dra. Laura Vega", available: false },
  { top: "22%", left: "65%", name: "Dr. Carlos Ríos", available: true },
  { top: "42%", left: "44%", name: "Dra. Sofía Morales", available: true },
  { top: "68%", left: "58%", name: "Dr. Javier Luna", available: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stars({ n }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} size={11} fill={i <= Math.round(n) ? "#1A6FD4" : "none"} stroke={i <= Math.round(n) ? "#1A6FD4" : "#CBD5E1"} />
      ))}
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function Navbar({ session }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = ["Suplementos", "Ropa", "Nutriólogos", "Mapa"];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <img src="/flux_logo.jpeg" alt="Flux" className="w-8 h-8 rounded-xl object-cover" />
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>FLUX</p>
            <p className="text-[8px] font-semibold tracking-widest text-[#1A6FD4] uppercase -mt-0.5">Health System</p>
          </div>
        </div>

        {/* Nav links desktop */}
        <nav className="hidden md:flex items-center gap-6 ml-8 flex-1">
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} className="text-sm text-[#6B7A8D] hover:text-[#1A6FD4] transition-colors font-medium">{l}</a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-2 ml-auto flex-shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#1A6FD4] font-medium transition-colors">
            <LogIn size={15} strokeWidth={1.5} /> Iniciar sesión
          </button>
          <div className="w-px h-5 bg-[#E2E5EA]" />
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#0B1929] font-medium transition-colors">
            <Monitor size={14} strokeWidth={1.5} /> Escritorio
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#0B1929] font-medium transition-colors">
            <Smartphone size={14} strokeWidth={1.5} /> Android / iOS
          </button>
          <button
            
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1A6FD4] text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-blue-200"
          >
            <Globe size={14} strokeWidth={2} /> Abrir app
          </button>
        </div>

        {/* Mobile burger */}
        <button className="md:hidden ml-auto text-[#6B7A8D]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#E2E5EA] px-6 py-4 space-y-3">
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileOpen(false)} className="block text-sm text-[#0B1929] font-medium py-1">{l}</a>
          ))}
          <div className="pt-3 border-t border-[#E2E5EA] flex flex-col gap-2">
            <button className="flex items-center gap-2 text-sm text-[#6B7A8D] font-medium"><LogIn size={14} /> Iniciar sesión</button>
            <button className="flex items-center gap-2 text-sm text-[#6B7A8D] font-medium"><Monitor size={14} /> Descargar escritorio</button>
            <button className="flex items-center gap-2 text-sm text-[#6B7A8D] font-medium"><Smartphone size={14} /> Android / iOS</button>
            <button  className="flex items-center gap-2 justify-center px-4 py-2 bg-[#1A6FD4] text-white text-sm font-semibold rounded-xl">
              <Globe size={14} /> Abrir app en línea
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-16 min-h-screen flex items-center relative overflow-hidden bg-white">
      {/* BG decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[55%] h-full bg-[#F0F4FB]" style={{ clipPath: "polygon(8% 0, 100% 0, 100% 100%, 0% 100%)" }} />
        <div className="absolute top-1/2 right-[8%] -translate-y-1/2 w-80 h-80 rounded-full bg-[#1A6FD4]/6 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center relative z-10">
        {/* Copy */}
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-[#1A6FD4] uppercase bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 mb-6">
            <Zap size={11} /> Nutrición inteligente
          </span>
          <h1 className="text-5xl md:text-6xl font-bold text-[#0B1929] leading-[1.1] mb-6" style={{ fontFamily: "DM Sans, sans-serif" }}>
            Tu cuerpo,<br />
            <span className="text-[#1A6FD4]">tu sistema.</span>
          </h1>
          <p className="text-lg text-[#6B7A8D] leading-relaxed mb-8 max-w-md">
            Suplementos premium, ropa de alto rendimiento y nutriólogos certificados — todo bajo una sola plataforma diseñada para transformarte.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              
              className="flex items-center gap-2 px-6 py-3.5 bg-[#1A6FD4] text-white font-semibold rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-200 text-sm"
            >
              <Globe size={16} /> Abrir app en línea <ChevronRight size={15} />
            </button>
            <a href="#suplementos" className="flex items-center gap-2 px-6 py-3.5 border border-[#E2E5EA] text-[#0B1929] font-semibold rounded-xl hover:border-[#1A6FD4] hover:text-[#1A6FD4] transition-all text-sm bg-white">
              Ver productos
            </a>
          </div>
          <div className="flex items-center gap-6 mt-10">
            {[["2,400+", "Pacientes activos"], ["98%", "Satisfacción"], ["50+", "Nutriólogos"]].map(([v, l]) => (
              <div key={l}>
                <p className="text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>{v}</p>
                <p className="text-xs text-[#6B7A8D]">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Hero image */}
        <div className="relative flex justify-center">
          <div className="relative w-full max-w-md">
            <img
              src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=700&fit=crop&auto=format"
              alt="Atleta Flux"
              className="w-full rounded-3xl object-cover shadow-2xl"
              style={{ height: 480 }}
            />
            {/* Floating card */}
            <div className="absolute -left-6 bottom-12 bg-white rounded-2xl shadow-xl p-4 border border-[#E2E5EA] flex items-center gap-3 w-52">
              <div className="w-10 h-10 rounded-xl bg-[#E8F1FB] flex items-center justify-center flex-shrink-0">
                <CheckCircle size={18} className="text-[#1A6FD4]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#0B1929]">Plan activo</p>
                <p className="text-[10px] text-[#6B7A8D]">Dra. Andrea Torres</p>
              </div>
            </div>
            <div className="absolute -right-4 top-10 bg-white rounded-2xl shadow-xl p-3 border border-[#E2E5EA]">
              <p className="text-[10px] text-[#6B7A8D] font-mono uppercase tracking-widest">Esta semana</p>
              <p className="text-2xl font-bold text-[#1A6FD4] font-mono">−1.2<span className="text-sm">kg</span></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: <Leaf size={20} strokeWidth={1.5} />, title: "Ingredientes certificados", desc: "Todos nuestros suplementos pasan pruebas de pureza e identidad en laboratorios acreditados." },
    { icon: <Shield size={20} strokeWidth={1.5} />, title: "Nutriólogos verificados", desc: "Cada profesional vinculado a Flux está cédula verificada y en ejercicio activo." },
    { icon: <Zap size={20} strokeWidth={1.5} />, title: "Seguimiento inteligente", desc: "Tu plan de nutrición, entrenamiento y métricas corporales, todo en una app." },
    { icon: <Users size={20} strokeWidth={1.5} />, title: "Comunidad activa", desc: "Más de 2,400 usuarios transformando su estilo de vida bajo el sistema Flux." },
  ];
  return (
    <section className="bg-[#F7F9FC] py-20 border-y border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.title} className="bg-white rounded-2xl p-6 border border-[#E2E5EA] hover:border-[#1A6FD4] transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#E8F1FB] flex items-center justify-center text-[#1A6FD4] mb-4 group-hover:bg-[#1A6FD4] group-hover:text-white transition-all">
                {item.icon}
              </div>
              <h3 className="text-sm font-semibold text-[#0B1929] mb-1.5">{item.title}</h3>
              <p className="text-xs text-[#6B7A8D] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupplementsSection({ supplements }) {
  const [cart, setCart] = useState([]);
  return (
    <section id="suplementos" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#1A6FD4] uppercase mb-2">Suplementación</p>
            <h2 className="text-4xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>Suplementos Flux</h2>
            <p className="text-[#6B7A8D] mt-2 text-sm">Formulados con tu nutriólogo. Respaldados por ciencia.</p>
          </div>
          <button className="hidden md:flex items-center gap-2 text-sm text-[#1A6FD4] font-medium hover:underline">
            Ver todos <ChevronRight size={15} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {supplements.map((s) => {
            const inCart = cart.includes(s.id);
            return (
              <div key={s.id} className="group bg-white rounded-2xl border border-[#E2E5EA] overflow-hidden hover:shadow-md hover:border-[#1A6FD4]/30 transition-all">
                <div className="relative h-48 bg-[#F0F4FB]">
                  <img
                    src={`https://images.unsplash.com/${s.img}?w=500&h=300&fit=crop&auto=format`}
                    alt={s.name}
                    className="w-full h-full object-cover"
                  />
                  {s.tag && (
                    <span className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full ${s.badge}`}>{s.tag}</span>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-[10px] text-[#6B7A8D] font-mono mb-1">{s.subtitle}</p>
                  <h3 className="text-base font-semibold text-[#0B1929] mb-2">{s.name}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Stars n={s.rating} />
                    <span className="text-xs text-[#6B7A8D] font-mono">{s.rating} ({s.reviews})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(s.flavors || []).map((f) => (
                      <span key={f} className="text-[10px] px-2 py-0.5 bg-[#F0F2F5] text-[#6B7A8D] rounded">{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>${s.price} <span className="text-xs font-normal text-[#6B7A8D]">MXN</span></span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {apparel.map((a) => {
            const inCart = cart.includes(a.id);
            return (
              <div key={a.id} className="group bg-white rounded-2xl border border-[#E2E5EA] overflow-hidden hover:shadow-md hover:border-[#1A6FD4]/30 transition-all">
                <div className="relative h-52 bg-[#E8ECF2]">
                  <img
                    src={`https://images.unsplash.com/${a.img}?w=500&h=320&fit=crop&auto=format`}
                    alt={a.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-white shadow" style={{ background: a.color }} />
                </div>
                <div className="p-5">
                  <p className="text-[10px] text-[#6B7A8D] font-mono mb-1">{a.subtitle}</p>
                  <h3 className="text-base font-semibold text-[#0B1929] mb-2">{a.name}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Stars n={a.rating} />
                    <span className="text-xs text-[#6B7A8D] font-mono">{a.rating} ({a.reviews})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(a.sizes || []).map((sz) => (
                      <span key={sz} className="text-[10px] px-2 py-0.5 border border-[#E2E5EA] text-[#6B7A8D] rounded font-mono">{sz}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>${a.price} <span className="text-xs font-normal text-[#6B7A8D]">MXN</span></span>
                    <button
                      onClick={() => setCart(inCart ? cart.filter((x) => x !== a.id) : [...cart, a.id])}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${inCart ? "bg-green-50 text-green-600 border border-green-200" : "bg-[#0B1929] text-white hover:bg-[#1A2D45]"}`}
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

function NutritionistsSection({ nutritionists }) {
  const [search, setSearch] = useState("");
  const filtered = nutritionists.filter(
    (n) => (n.name || '').toLowerCase().includes(search.toLowerCase()) || (n.specialty || '').toLowerCase().includes(search.toLowerCase()) || (n.location || '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <section id="nutriólogos" className="py-24 bg-white border-t border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest text-[#1A6FD4] uppercase mb-2">Red Flux</p>
          <h2 className="text-4xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans, sans-serif" }}>Nutriólogos certificados</h2>
          <p className="text-[#6B7A8D] text-sm mb-6">Profesionales verificados vinculados al sistema Flux. Agenda tu consulta desde la app.</p>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm bg-[#F7F9FC] rounded-xl border border-[#E2E5EA] px-4 h-11 focus-within:border-[#1A6FD4] transition-colors">
              <Search size={15} className="text-[#6B7A8D] flex-shrink-0" strokeWidth={1.5} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nutriólogo o especialidad..."
                className="flex-1 bg-transparent text-sm text-[#0B1929] outline-none placeholder:text-[#9BA5B0]"
              />
            </div>
            <button className="flex items-center gap-2 px-4 h-11 rounded-xl border border-[#E2E5EA] text-sm text-[#6B7A8D] hover:border-[#1A6FD4] hover:text-[#1A6FD4] transition-colors">
              <Filter size={14} strokeWidth={1.5} /> Filtrar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((n) => (
            <div key={n.id} className="bg-white rounded-2xl border border-[#E2E5EA] p-5 hover:shadow-md hover:border-[#1A6FD4]/30 transition-all">
              <div className="flex items-start gap-4 mb-4">
                <div className="relative flex-shrink-0">
                  <img
                    src={`https://images.unsplash.com/${n.img}?w=80&h=80&fit=crop&auto=format&face`}
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
                  <p className="text-[11px] text-[#6B7A8D] mt-0.5 leading-snug">{n.specialty}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-3">
                <MapPin size={11} className="text-[#1A6FD4] flex-shrink-0" strokeWidth={1.5} />
                <span className="text-[11px] text-[#6B7A8D]">{n.location}</span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Stars n={n.rating} />
                <span className="text-xs text-[#6B7A8D] font-mono">{n.rating}</span>
                <span className="text-[10px] text-[#9BA5B0]">·</span>
                <span className="text-[11px] text-[#6B7A8D]">{n.patients} pacientes</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex-1 py-2 bg-[#1A6FD4] text-white text-xs font-semibold rounded-xl hover:bg-blue-600 transition-colors">
                  {n.available ? "Agendar consulta" : "Ver disponibilidad"}
                </button>
                <span className={`text-[10px] px-2 py-1 rounded-lg font-medium ${n.available ? "bg-green-50 text-green-600" : "bg-[#F0F2F5] text-[#9BA5B0]"}`}>
                  {n.available ? "Disponible" : "Ocupado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MapSection({ mapPins }) {
  const [activePin, setActivePin] = useState(null);
  return (
    <section id="mapa" className="py-24 bg-[#F7F9FC] border-t border-[#E2E5EA]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest text-[#1A6FD4] uppercase mb-2">Cerca de ti</p>
          <h2 className="text-4xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans, sans-serif" }}>Nutriólogos en tu zona</h2>
          <p className="text-[#6B7A8D] text-sm">Encuentra al profesional más cercano. Activa tu ubicación desde la app para resultados precisos.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Map */}
          <div className="md:col-span-2 relative rounded-3xl overflow-hidden border border-[#E2E5EA] shadow-sm" style={{ height: 420 }}>
            {/* Map background using OpenStreetMap iframe */}
            <iframe
              title="Mapa nutriólogos Flux"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-99.25%2C19.32%2C-99.07%2C19.48&layer=mapnik"
              className="w-full h-full border-0"
              style={{ filter: "grayscale(25%) contrast(0.95)" }}
            />
            {/* Overlay pins */}
            <div className="absolute inset-0 pointer-events-none">
              {mapPins.map((pin, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{ top: pin.top, left: pin.left, transform: "translate(-50%,-50%)" }}
                  onClick={() => setActivePin(activePin === i ? null : i)}
                >
                  <div className={`w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-transform hover:scale-110 ${pin.available ? "bg-[#1A6FD4]" : "bg-[#9BA5B0]"}`}>
                    <MapPin size={14} strokeWidth={2} className="text-white" />
                  </div>
                  {activePin === i && (
                    <div className="absolute left-1/2 bottom-10 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-[#E2E5EA] px-3 py-2 text-xs whitespace-nowrap z-10">
                      <p className="font-semibold text-[#0B1929]">{pin.name}</p>
                      <p className={`text-[10px] ${pin.available ? "text-green-500" : "text-[#9BA5B0]"}`}>{pin.available ? "● Disponible" : "○ Ocupado"}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* CTA overlay */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-xl px-4 py-3 border border-[#E2E5EA] shadow-sm">
              <p className="text-xs font-semibold text-[#0B1929]">6 nutriólogos en tu área</p>
              <p className="text-[10px] text-[#6B7A8D]">Activa tu ubicación para mejores resultados</p>
            </div>
          </div>

          {/* Nearby list */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-widest text-[#6B7A8D] uppercase">Más cercanos</p>
            {nutritionists.slice(0, 4).map((n, i) => (
              <div key={n.id} className="bg-white rounded-xl border border-[#E2E5EA] p-4 flex items-center gap-3 hover:border-[#1A6FD4] transition-all cursor-pointer" onClick={() => setActivePin(i)}>
                <img
                  src={`https://images.unsplash.com/${n.img}?w=60&h=60&fit=crop&auto=format`}
                  alt={n.name}
                  className="w-10 h-10 rounded-xl object-cover bg-[#E8ECF2] flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0B1929] truncate">{n.name}</p>
                  <p className="text-[10px] text-[#6B7A8D] truncate">{n.location}</p>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${n.available ? "bg-green-400" : "bg-[#CBD5E1]"}`} />
              </div>
            ))}
            <button className="w-full py-2.5 border border-[#E2E5EA] rounded-xl text-xs font-semibold text-[#1A6FD4] hover:bg-[#E8F1FB] transition-colors">
              Ver todos en el mapa
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Downloads() {
  return (
    <section className="py-24 bg-[#0B1929] text-white">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className="text-xs font-semibold tracking-widest text-[#38BDF8] uppercase mb-4">Disponible en todas las plataformas</p>
        <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Empieza hoy, en cualquier dispositivo</h2>
        <p className="text-[#6B7A8D] mb-10 text-sm max-w-xl mx-auto">Descarga la app de escritorio o accede desde tu teléfono. Tu progreso siempre sincronizado.</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button className="flex items-center gap-2.5 px-6 py-3.5 bg-white text-[#0B1929] font-semibold rounded-xl hover:bg-[#F0F4FB] transition-all text-sm">
            <Monitor size={18} strokeWidth={1.5} className="text-[#1A6FD4]" /> Descargar para escritorio
          </button>
          <button className="flex items-center gap-2.5 px-6 py-3.5 bg-white text-[#0B1929] font-semibold rounded-xl hover:bg-[#F0F4FB] transition-all text-sm">
            <Smartphone size={18} strokeWidth={1.5} className="text-[#1A6FD4]" /> Android
          </button>
          <button className="flex items-center gap-2.5 px-6 py-3.5 bg-white text-[#0B1929] font-semibold rounded-xl hover:bg-[#F0F4FB] transition-all text-sm">
            <Smartphone size={18} strokeWidth={1.5} className="text-[#1A6FD4]" /> iOS
          </button>
          <button
            
            className="flex items-center gap-2.5 px-6 py-3.5 bg-[#1A6FD4] text-white font-semibold rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/40 text-sm"
          >
            <Globe size={18} strokeWidth={1.5} /> Abrir app en línea
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0B1929] border-t border-white/8 py-12 text-white/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/flux_logo.jpeg" alt="Flux" className="w-8 h-8 rounded-xl object-cover" />
              <div>
                <p className="text-white font-bold text-sm">FLUX</p>
                <p className="text-[9px] tracking-widest text-[#1A6FD4] uppercase">Health System</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed">Tu sistema integral de nutrición, entrenamiento y bienestar.</p>
          </div>
          {[
            { title: "Productos", links: ["Suplementos", "Ropa deportiva", "Accesorios", "Combos"] },
            { title: "Plataforma", links: ["App en línea", "App escritorio", "Android", "iOS"] },
            { title: "Empresa", links: ["Acerca de Flux", "Nutriólogos", "Trabaja con nosotros", "Contacto"] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-white text-xs font-semibold mb-3 uppercase tracking-widest">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}><a href="#" className="text-xs hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© 2026 Flux Health System. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-xs">
            <a href="#" className="hover:text-white transition-colors">Privacidad</a>
            <a href="#" className="hover:text-white transition-colors">Términos</a>
            <div className="flex items-center gap-3 ml-2">
              <a href="#" className="hover:text-white transition-colors"><Share2 size={15} strokeWidth={1.5} /></a>
              <a href="#" className="hover:text-white transition-colors"><Phone size={15} strokeWidth={1.5} /></a>
              <a href="#" className="hover:text-white transition-colors"><Mail size={15} strokeWidth={1.5} /></a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Landing({ session }) {
  const [dbSupplements, setDbSupplements] = useState([]);
  const [dbApparel, setDbApparel] = useState([]);
  const [dbNutritionists, setDbNutritionists] = useState([]);
  const [dbMapPins, setDbMapPins] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const prod = await dbGet('productos?activo=eq.true');
        if (prod && prod.length > 0) {
          // Format for frontend mapping
          const mappedProd = prod.map(p => ({
            id: p.id,
            name: p.nombre,
            subtitle: p.subtitulo,
            price: p.precio,
            rating: p.rating,
            reviews: p.num_reviews,
            tag: p.badge,
            img: p.imagen_url || 'photo-1593095948071-474c5cc2989d',
            flavors: Array.isArray(p.variantes) ? p.variantes : (typeof p.variantes === 'string' ? JSON.parse(p.variantes || '[]') : []),
            sizes: Array.isArray(p.variantes) ? p.variantes : (typeof p.variantes === 'string' ? JSON.parse(p.variantes || '[]') : []),
            badge: p.badge ? 'bg-blue-100 text-blue-700' : ''
          }));
          setDbSupplements(mappedProd.filter(p => p.categoria === 'suplemento'));
          setDbApparel(mappedProd.filter(p => p.categoria === 'ropa'));
        }
      } catch (e) { console.error('Error cargando productos', e); }

      try {
        const nutris = await dbGet('profiles?role=eq.nutriologo&activo=eq.true&select=id,nombre,nombre_marca,especialidad,ubicacion_texto,pin_top,pin_left,rating,verificado,logo_url');
        if (nutris && nutris.length > 0) {
          const formattedNutris = nutris.map(n => ({
            id: n.id,
            name: n.nombre_marca || n.nombre || 'Especialista',
            specialty: n.especialidad || 'Nutrición Integral',
            location: n.ubicacion_texto || 'Consulta Online',
            rating: n.rating || 5.0,
            patients: 0,
            available: true,
            img: n.logo_url || 'photo-1559839734-2b71ea197ec2',
            verified: n.verificado || false
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
    <div className="min-h-full bg-white">
      <Navbar  />
      <Hero  />
      <Features />
      <SupplementsSection supplements={activeSupplements} />
      <ApparelSection apparel={activeApparel} />
      <NutritionistsSection nutritionists={activeNutritionists} />
      <MapSection mapPins={activeMapPins} />
      <Downloads  />
      <Footer />
    </div>
  );
}
