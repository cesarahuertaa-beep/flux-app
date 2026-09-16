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
import PerfilNutriologo from "../components/admin/PerfilNutriologo";
import BloqueadoPaciente from "../components/BloqueadoPaciente";
import { ProgramarCliente } from "../components/admin/ProgramarCliente";
import { UtensilsCrossed, Dumbbell, User, CalendarDays, Camera, ShoppingBag, MapPin, Trophy, Activity } from "lucide-react";

const offlineAwareUpsert = async (records) => {
  if (navigator.onLine) {
    await dbUpsert('progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo,variante_id', records);
  } else {
    const items = Array.isArray(records) ? records : [records];
    for (const item of items) await enqueue(item);
  }
};

export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles, isEmbedded, embeddedTab }) {
  const { data: cliente } = session;
  const brand = useBrand();
  
  const [tabState, setTab] = useState(() => {
    const saved = localStorage.getItem("flux_cliente_tab");
    return saved ? saved : "perfil";
  });
  const tab = isEmbedded ? embeddedTab : tabState;

  useEffect(() => {
    if (tab) localStorage.setItem("flux_cliente_tab", tab);
  }, [tab]);

  const [nutri, setNutri] = useState(null);
  const [dias, setDias] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [progreso, setProgreso] = useState({});
  const [loading, setLoading] = useState(true);
  const [cicloActivo, setCicloActivo] = useState(null);
  const [syncStatus, setSyncStatus] = useState("synced");
  const [nutriologoBloqueado, setNutriologoBloqueado] = useState(false);
  const [ultimoPeso, setUltimoPeso] = useState(null);
  
  
  const [biblioteca, setBiblioteca] = useState([]);

  const loadData = async () => {
    try {
      if (cliente?.nutriologo_id) {
        const nutriProfile = await dbGet(`profiles?id=eq.${cliente.nutriologo_id}&select=bloqueado`);
        if (nutriProfile && nutriProfile[0]?.bloqueado) {
          setNutriologoBloqueado(true);
          setLoading(false);
          return;
        }
      }

      const cs = await dbGet(`ciclos?cliente_id=eq.${cliente.id}&activo=eq.true&limit=1`);
      const ciclo = cs.length ? cs[0] : null;
      setCicloActivo(ciclo);

      try {
        const met = await dbGet(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc&limit=1`);
        if (met && met.length > 0 && met[0].peso) {
          setUltimoPeso(parseFloat(met[0].peso));
        }
      } catch(e) {}


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
        const ps = await dbGet(`progreso?cliente_id=eq.${cliente.id}&ejercicio_id=in.(${allIds.join(",")})&limit=3000`);
        if (ps && Array.isArray(ps)) {
          const pm = {};
          ps.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}-${p.variante_id || 'original'}`] = p.valor; });
          
          try {
            const pending = await getAll();
            pending.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}-${p.variante_id || 'original'}`] = p.valor; });
          } catch(err){}
          
          setProgreso(pm);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const onFocus = () => {
      if (document.visibilityState === 'visible') loadData();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onFocus);
    
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
    };
  }, [cliente.id]);

  const handleProgressChange = async (ejId, wi, si, tipo, val, variante_id = "original") => {
    const key = `${ejId}-${wi}-${si}-${tipo}-${variante_id}`;
    setProgreso(p => ({ ...p, [key]: val }));
    try {
      setSyncStatus("saving");
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
      setSyncStatus(navigator.onLine ? "synced" : "local");
    } catch(e) {
      console.error("Error guardando progreso:", e);
      setSyncStatus("local");
    }
  };

    // Ocultar pestaña de citas si es usuario civil (no tiene nutriólogo)
  const isActuallyCivil = cliente?.nutriologo_id === null;

  const SIDEBAR_ITEMS = [
    { id: "nutricion",label: "Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "deporte",  label: "Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    ...((!isActuallyCivil && cliente?.objetivo !== "Mi entrenamiento personal") ? [
      { id: "citas",    label: "Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> }
    ] : [])
  ];
  const { currentCycleWeek, isFuture } = (() => {
    const startStr = cicloActivo?.fecha_inicio || cicloActivo?.created_at || (rutinas.length > 0 ? rutinas[0].created_at : null);
    if (!startStr) return { currentCycleWeek: 1, isFuture: false };
    
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
    const isFut = diffDays < 0;
    const wk = isFut ? 1 : Math.floor(diffDays / 7) + 1;
    return { currentCycleWeek: isNaN(wk) ? 1 : Math.max(1, wk), isFuture: isFut };
  })();

  const cycleDuration = rutinas.length > 0 ? Math.max(...rutinas.map(r => parseInt(r.semanas) || 4)) : 4;
  const isFinished = !isFuture && currentCycleWeek > cycleDuration;

  if (nutriologoBloqueado) {
    return <BloqueadoPaciente onLogout={onLogout} />;
  }

  const innerContent = (
    <>
      {isAtletaMode && (
        <div className="bg-[#10B981] bg-opacity-10 border-b border-[#10B981] border-opacity-20 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="font-bold text-[#065F46] text-sm md:text-base flex items-center gap-2">
              <Dumbbell size={16} /> {cliente?.nutriologo_id === null || isAtletaMode ? "Entrenando" : "Estás en Modo Atleta"}
            </span>
            <span className="text-[#047857] text-xs md:text-sm hidden sm:block">
              {cliente?.nutriologo_id === null ? "Modo de ejecución de rutina." : "Previsualiza tu app exactamente como lo verían tus pacientes."}
            </span>
          </div>
          <button onClick={onBackToAdmin} className="bg-[#10B981] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors shadow-sm whitespace-nowrap">
            {cliente?.nutriologo_id === null ? "Volver al Editor" : "Volver al Panel"}
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex h-full items-center justify-center text-[#6B7A8D]">Cargando información...</div>
      ) : (
        <>
          {isFinished && (tab === "nutricion" || tab === "deporte") ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
              <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center shadow-sm mb-4">
                <Trophy size={32} className="text-[#10B981]" />
              </div>
              <h3 className="text-[#0B1929] font-bold text-xl mb-2" style={{ fontFamily: "DM Sans" }}>
                ¡Felicidades, terminaste!
              </h3>
              <p className="text-[#6B7A8D] text-sm max-w-[280px]">
                {cliente?.nutriologo_id === null ? "Has completado exitosamente todas las semanas de este ciclo. ¡Es momento de ir al editor y diseñar tu próximo plan!" : "Has completado exitosamente todas las semanas de este ciclo. Contacta a tu nutriólogo para agendar tu próxima evaluación y recibir tu nuevo plan."}
              </p>
            </div>
          ) : (
            <>
              
              {tab === "nutricion" && (
                <Nutrition dias={dias} cliente={cliente} nutri={nutri} semanaActualCiclo={currentCycleWeek} isSelfManaged={cliente?.nutriologo_id === null || isAtletaMode} />
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
                  syncStatus={syncStatus}
                  isLocked={isFuture}
                  ultimoPeso={ultimoPeso}
                  isSelfManaged={cliente?.nutriologo_id === null || isAtletaMode}
                />
              )}
            </>
          )}

          {tab === "progreso" && (
            <Progreso cliente={cliente} isSelfManaged={cliente?.nutriologo_id === null || isAtletaMode} />
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
        </>
  );

  if (isEmbedded) return innerContent;

  return (
    <AppLayout 
      nav={SIDEBAR_ITEMS}
      active={tab}
      setActive={setTab}
      brand={brand}
      session={session}
      onLogout={onLogout}
    >
      {innerContent}
    </AppLayout>
  );
}
