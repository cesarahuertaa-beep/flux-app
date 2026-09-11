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
import PerfilNutriologo from "../components/admin/PerfilNutriologo";
import { UtensilsCrossed, Dumbbell, CalendarDays, Camera, ShoppingBag, MapPin } from "lucide-react";

const offlineAwareUpsert = async (records) => {
  if (navigator.onLine) {
    await dbUpsert('progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo,variante_id', records);
  } else {
    const items = Array.isArray(records) ? records : [records];
    for (const item of items) await enqueue(item);
  }
};

export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles }) {
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
          if (ps && Array.isArray(ps)) {
            const pm = {};
            ps.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}-${p.variante_id || 'original'}`] = p.valor; });
            
            try {
              const pending = await getAll();
              pending
                .filter(p => p.cliente_id === cliente.id)
                .forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}-${p.variante_id || 'original'}`] = p.valor; });
            } catch { /* if IndexedDB fails, just use Supabase data */ }
            
            setProgreso(pm);
          }
        }
      } catch (e) { 
        console.error(e); 
      }
      setLoading(false);
    })();
  }, [cliente.id]);

  const handleProgressChange = async (ejId, wi, si, tipo, val, variante_id = "original") => {
    const key = `${ejId}-${wi}-${si}-${tipo}-${variante_id}`;
    setProgreso(p => ({ ...p, [key]: val }));
    try {
      await offlineAwareUpsert({ 
        ejercicio_id: ejId, 
        cliente_id: cliente.id, 
        semana: parseInt(wi), 
        serie: parseInt(si), 
        tipo, 
        valor: val,
        variante_id,
        updated_at: new Date().toISOString() 
      });
    } catch(e) {
      console.error("Error guardando progreso:", e);
    }
  };

  const SIDEBAR_ITEMS = [
    { id: "nutricion",label: "Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "deporte",  label: "Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    ...(cliente?.objetivo !== "Mi entrenamiento personal" ? [
      { id: "citas",    label: "Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> }
    ] : [])
  ];

  const currentCycleWeek = (() => {
    // Si hay un ciclo activo, usamos su fecha. Si no, usamos la fecha de creación de la primera rutina (planes legacy)
    const startStr = cicloActivo?.fecha_inicio || cicloActivo?.created_at || (rutinas.length > 0 ? rutinas[0].created_at : null);
    if (!startStr) return 1;
    
    let t0;
    if (startStr.includes("T")) {
      t0 = new Date(startStr);
    } else {
      const [y, m, d] = startStr.split("-").map(Number);
      t0 = new Date(y, m - 1, d);
    }
    
    t0.setHours(0,0,0,0);
    const now = new Date();
    now.setHours(0,0,0,0);
    
    const diffDays = Math.floor((now.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24));
    const wk = Math.floor(diffDays / 7) + 1;
    return isNaN(wk) ? 1 : Math.max(1, wk);
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
      {isAtletaMode && (
        <div className="bg-[#10B981] bg-opacity-10 border-b border-[#10B981] border-opacity-20 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="font-bold text-[#065F46] text-sm md:text-base flex items-center gap-2">
              <Dumbbell size={16} /> Estás en Modo Atleta
            </span>
            <span className="text-[#047857] text-xs md:text-sm hidden sm:block">Previsualiza tu app exactamente como lo verían tus pacientes.</span>
          </div>
          <button onClick={onBackToAdmin} className="bg-[#10B981] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors shadow-sm whitespace-nowrap">
            Volver al Panel
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex h-full items-center justify-center text-[#6B7A8D]">Cargando información...</div>
      ) : (
        <>
          {tab === "nutricion" && (
            <Nutrition dias={dias} cliente={cliente} nutri={nutri} semanaActualCiclo={currentCycleWeek} />
          )}

          {tab === "deporte" && (
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

          {tab === "progreso" && (
            <Progreso cliente={cliente} />
          )}

          {tab === "citas" && (
            <CitasCliente cliente={cliente} />
          )}

          {tab === "perfil" && (
            isAtletaMode ? (
              <div className="flex-1 overflow-y-auto">
                <PerfilNutriologo profileId={session.profileId} onLogout={onLogout} role={session.adminRole} />
              </div>
            ) : (
              <UserProfile session={session} onLogout={onLogout} onChangeRole={onChangeRole} multiRoles={multiRoles} />
            )
          )}
        </>
      )}
    </AppLayout>
  );
}
