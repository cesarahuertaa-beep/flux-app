import { useState, useEffect } from "react";
import { AppLayout } from "../components/ui/AppLayout";
import { dbGet, dbUpsert } from "../lib/supabase";
import { enqueue, getAll } from "../lib/offlineQueue";
import { useBrand } from "../components/BrandContext";
import { CitasCliente } from "../components/CitasCliente";
import Nutrition from "../components/cliente/Nutrition";
import Training from "../components/cliente/Training";
import Progreso from "../components/cliente/Progreso";
import UserProfile from "../components/UserProfile";
import { BarChart2, UtensilsCrossed, Dumbbell, CalendarDays, Camera, ShoppingBag, MapPin, Search } from "lucide-react";

const offlineAwareUpsert = async (records) => {
  if (navigator.onLine) {
    await dbUpsert('progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo', records);
  } else {
    const items = Array.isArray(records) ? records : [records];
    for (const item of items) await enqueue(item);
  }
};

export default function ClienteView({ session, onLogout }) {
  const { data: cliente } = session;
  const brand = useBrand();
  
  const [tab, setTab] = useState("inicio");
  const [nutri, setNutri] = useState(null);
  const [dias, setDias] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [progreso, setProgreso] = useState({});
  const [loading, setLoading] = useState(true);
  const [cicloActivo, setCicloActivo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const cs = await dbGet(`ciclos?cliente_id=eq.${cliente.id}&activo=eq.true&limit=1`);
        const ciclo = cs.length ? cs[0] : null;
        setCicloActivo(ciclo);

        const cicloFilter = ciclo ? `ciclo_id=eq.${ciclo.id}` : `ciclo_id=is.null`;

        const ns = await dbGet(`nutricion?cliente_id=eq.${cliente.id}&${cicloFilter}`);
        if (ns.length) {
          setNutri(ns[0]);
          const ds = await dbGet(`nutricion_dias?nutricion_id=eq.${ns[0].id}&order=orden.asc`);
          setDias(await Promise.all(ds.map(async d => ({ 
            ...d, 
            comidas: await dbGet(`comidas?dia_id=eq.${d.id}&order=orden.asc`) 
          }))));
        }

        const rs = await dbGet(`rutinas?cliente_id=eq.${cliente.id}&${cicloFilter}&order=orden.asc`);
        const rsFull = await Promise.all(rs.map(async r => ({ 
          ...r, 
          ejercicios: await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`) 
        })));
        setRutinas(rsFull);

        const allIds = rsFull.flatMap(r => r.ejercicios.map(e => e.id));
        if (allIds.length) {
          const ps = await dbGet(`progreso?cliente_id=eq.${cliente.id}&ejercicio_id=in.(${allIds.join(",")})`);
          const pm = {};
          ps.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}`] = p.valor; });
          
          try {
            const pending = await getAll();
            pending
              .filter(p => p.cliente_id === cliente.id)
              .forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}`] = p.valor; });
          } catch { /* if IndexedDB fails, just use Supabase data */ }
          
          setProgreso(pm);
        }
      } catch (e) { 
        console.error(e); 
      }
      setLoading(false);
    })();
  }, [cliente.id]);

  const handleProgressChange = async (ejId, wi, si, tipo, val) => {
    const key = `${ejId}-${wi}-${si}-${tipo}`;
    setProgreso(p => ({ ...p, [key]: val }));
    try {
      await offlineAwareUpsert({ 
        ejercicio_id: ejId, 
        cliente_id: cliente.id, 
        semana: parseInt(wi), 
        serie: parseInt(si), 
        tipo, 
        valor: val, 
        updated_at: new Date().toISOString() 
      });
    } catch(e) {
      console.error("Error guardando progreso:", e);
    }
  };

  const isLibre = !cliente.nutriologo_id;
  const SIDEBAR_ITEMS = isLibre ? [
    { id: "inicio", label: "Inicio", icon: <BarChart2 size={18} strokeWidth={1.5} /> },
    { id: "tienda", label: "Tienda Oficial", icon: <ShoppingBag size={18} strokeWidth={1.5} /> },
    { id: "directorio", label: "Especialistas", icon: <MapPin size={18} strokeWidth={1.5} /> },
  ] : [
    { id: "inicio",   label: "Inicio",          icon: <BarChart2 size={18} strokeWidth={1.5} /> },
    { id: "nutricion",label: "Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "deporte",  label: "Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    { id: "citas",    label: "Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> },
  ];

  const currentCycleWeek = (() => {
    if (!cicloActivo?.fecha_inicio) return 0;
    const t0 = new Date(cicloActivo.fecha_inicio).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - t0) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.floor(diffDays / 7));
  })();

  return (
    <AppLayout 
      nav={SIDEBAR_ITEMS}
      active={tab}
      setActive={setTab}
      brand={brand}
      session={session}
      onLogout={onLogout}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-[#6B7A8D]">Cargando información...</div>
      ) : (
        <>
          {tab === "inicio" && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              {isLibre ? (
                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-[#E2E8F0] max-w-2xl w-full">
                  <div className="w-16 h-16 bg-blue-50 text-[var(--brand-primary)] rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <MapPin size={32} />
                  </div>
                  <h2 className="text-3xl font-extrabold text-[#0B1929] mb-4 font-['Space_Grotesk',sans-serif]">
                    ¡Bienvenido a Flux, {cliente.nombre.split(" ")[0]}!
                  </h2>
                  <p className="text-[#6B7A8D] mb-8 text-lg">
                    Aún no tienes un plan clínico asignado. Explora nuestra tienda o lleva tus resultados al siguiente nivel contratando a un especialista.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => setTab("directorio")} className="bg-[var(--brand-primary)] hover:opacity-90 text-white px-8 py-3.5 rounded-2xl text-[15px] font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                      <Search size={18} /> Ver Directorio Médico
                    </button>
                    <button onClick={() => setTab("tienda")} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-8 py-3.5 rounded-2xl text-[15px] font-bold transition-all flex items-center justify-center gap-2">
                      <ShoppingBag size={18} /> Ir a la Tienda
                    </button>
                  </div>
                </div>
              ) : (
                <div className="opacity-60">
                  <img src={brand?.logo_url || "/logo.png"} alt="Flux Logo" style={{ width: 140, marginBottom: 20, opacity: 0.4, filter: "grayscale(100%) brightness(1.5)" }} />
                  <h2 className="text-2xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Hola, {cliente.nombre.split(" ")[0]}
                  </h2>
                  <p className="text-sm text-[#6B7A8D]">Selecciona una opción en el menú para comenzar.</p>
                </div>
              )}
            </div>
          )}

          {tab === "tienda" && (
            <div className="flex flex-col h-full items-center justify-center text-[#6B7A8D]">
              <ShoppingBag size={48} className="mb-4 opacity-50" />
              <p>Módulo de E-Commerce en construcción...</p>
            </div>
          )}

          {tab === "directorio" && (
            <div className="flex flex-col h-full items-center justify-center text-[#6B7A8D]">
              <MapPin size={48} className="mb-4 opacity-50" />
              <p>Módulo de Directorio Médico en construcción...</p>
            </div>
          )}

          {tab === "nutricion" && !isLibre && (
            <Nutrition dias={dias} cliente={cliente} nutri={nutri} />
          )}

          {tab === "deporte" && !isLibre && (
            <Training 
              rutinas={rutinas} 
              progreso={progreso}
              progresoSemanaAnterior={progreso}
              clienteNombre={cliente.nombre}
              onSaveExercise={async () => {}}
              onProgressChange={handleProgressChange}
              semanaActualCiclo={currentCycleWeek}
            />
          )}

          {tab === "progreso" && !isLibre && (
            <Progreso cliente={cliente} />
          )}

          {tab === "citas" && !isLibre && (
            <CitasCliente cliente={cliente} />
          )}

          {tab === "perfil" && (
            <UserProfile session={session} />
          )}
        </>
      )}
    </AppLayout>
  );
}
