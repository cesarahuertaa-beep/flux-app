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
import Directorio from "../components/cliente/Directorio";
import { UtensilsCrossed, Dumbbell, CalendarDays, Camera, ShoppingBag, MapPin } from "lucide-react";

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
  
  const [tab, setTab] = useState("perfil");
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
    { id: "tienda", label: "Tienda Oficial", icon: <ShoppingBag size={18} strokeWidth={1.5} /> },
    { id: "directorio", label: "Especialistas", icon: <MapPin size={18} strokeWidth={1.5} /> },
  ] : [
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
          {tab === "tienda" && (
            <div className="flex flex-col h-full items-center justify-center text-[#6B7A8D]">
              <ShoppingBag size={48} className="mb-4 opacity-50" />
              <p>Módulo de E-Commerce en construcción...</p>
            </div>
          )}

          {tab === "directorio" && (
            <Directorio />
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
            <UserProfile session={session} onLogout={onLogout} />
          )}
        </>
      )}
    </AppLayout>
  );
}
