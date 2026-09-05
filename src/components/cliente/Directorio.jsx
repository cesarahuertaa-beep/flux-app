import { useState, useEffect } from "react";
import { dbGet } from "../../lib/supabase";
import { Search, MapPin, Star, MessageCircle, ChevronRight, UserCircle } from "lucide-react";

export default function Directorio() {
  const [nutriologos, setNutriologos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadDirectorio = async () => {
      try {
        const data = await dbGet("profiles?role=eq.nutriologo&activo=eq.true&select=id,nombre,nombre_marca,email,telefono,color_primario,logo_url&order=nombre.asc");
        setNutriologos(data);
      } catch (error) {
        console.error("Error cargando directorio:", error);
      }
      setLoading(false);
    };
    loadDirectorio();
  }, []);

  const filtered = nutriologos.filter(n => 
    n.nombre?.toLowerCase().includes(search.toLowerCase()) || 
    n.nombre_marca?.toLowerCase().includes(search.toLowerCase())
  );

  const handleContactar = (telefono, email) => {
    if (telefono) {
      const cleanPhone = telefono.replace(/\D/g, '');
      const msg = encodeURIComponent("¡Hola! Encontré tu perfil en Flux y me gustaría agendar una consulta.");
      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
    } else if (email) {
      window.location.href = `mailto:${email}?subject=Consulta nutricional vía Flux`;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Header */}
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-extrabold text-[#0B1929] tracking-tight font-['Space_Grotesk',sans-serif]">Directorio Médico</h1>
        <p className="text-[#6B7A8D] mt-2">Encuentra a tu especialista ideal y lleva tus resultados al siguiente nivel.</p>
      </div>

      {/* Buscador */}
      <div className="mb-8 relative max-w-md mx-auto md:mx-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9BA5B0]" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nombre o clínica..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-[#E2E8F0] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/10 rounded-2xl pl-12 pr-4 py-3.5 text-[#0B1929] outline-none transition-all shadow-sm"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#6B7A8D]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)] mr-3"></div>
          Cargando especialistas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#E2E8F0] shadow-sm">
          <MapPin size={48} className="mx-auto text-[#9BA5B0] mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-[#0B1929]">No se encontraron resultados</h3>
          <p className="text-[#6B7A8D] mt-1">Intenta con otros términos de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(nutri => (
            <div key={nutri.id} className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
              {/* Banner/Color superior */}
              <div 
                className="h-20 w-full relative" 
                style={{ backgroundColor: nutri.color_primario || "var(--brand-primary)" }}
              >
                {/* Logo superpuesto */}
                <div className="absolute -bottom-8 left-6">
                  {nutri.logo_url ? (
                    <img 
                      src={nutri.logo_url} 
                      alt={nutri.nombre} 
                      className="w-16 h-16 rounded-2xl object-cover border-4 border-white bg-white shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl border-4 border-white bg-[#F0F4FA] text-[#6B7A8D] flex items-center justify-center shadow-sm">
                      <UserCircle size={32} />
                    </div>
                  )}
                </div>
              </div>

              {/* Contenido */}
              <div className="pt-10 px-6 pb-6 flex-1 flex flex-col">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#0B1929] mb-1 line-clamp-1">
                    {nutri.nombre_marca || nutri.nombre}
                  </h3>
                  {nutri.nombre_marca && (
                    <p className="text-sm font-medium text-[#6B7A8D] mb-3 line-clamp-1">
                      Dr(a). {nutri.nombre}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-1 text-[13px] font-semibold text-amber-500 mb-4 bg-amber-50 w-fit px-2 py-1 rounded-lg">
                    <Star size={14} className="fill-amber-500" />
                    <span>Especialista Verificado</span>
                  </div>
                </div>

                {/* Botón Acción */}
                <button 
                  onClick={() => handleContactar(nutri.telefono, nutri.email)}
                  className="w-full mt-4 bg-[#F7F9FC] hover:bg-[var(--brand-primary)] text-[#0B1929] hover:text-white border border-[#E2E8F0] hover:border-transparent px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-[var(--brand-primary)]/20"
                >
                  {nutri.telefono ? (
                    <><MessageCircle size={18} /> Contactar por WhatsApp</>
                  ) : (
                    <>Contactar <ChevronRight size={18} /></>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
