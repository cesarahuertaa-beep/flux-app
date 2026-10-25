import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { AppLayout } from "../components/ui/AppLayout";
import { dbGet, dbUpsert, getPendingMutations } from "../lib/supabase";
import { useBackButton } from "../lib/backButtonHandler";
import { getAll } from "../lib/offlineQueue";
import { useBrand } from "../components/BrandContext";
import { getCurrentCycleWeekInfo } from "../utils/helpers";
import BloqueadoPaciente from "../components/BloqueadoPaciente";
import { UtensilsCrossed, Dumbbell, User, CalendarDays, Camera, ShoppingBag, MapPin, Trophy, Activity } from "lucide-react";
import { ListSkeleton } from "../components/ui/Skeleton";

const CitasCliente = lazy(() => import("../components/CitasCliente").then(m => ({ default: m.CitasCliente })));
const Nutrition = lazy(() => import("../components/cliente/Nutrition"));
const Training = lazy(() => import("../components/cliente/Training"));
const Progreso = lazy(() => import("../components/cliente/Progreso"));
const UserProfile = lazy(() => import("../components/UserProfile"));
const PerfilNutriologo = lazy(() => import("../components/admin/PerfilNutriologo"));

// dbUpsert ya guarda offline (cola + copia local) y envía al volver la conexión con retorno mínimo para máxima velocidad
const offlineAwareUpsert = async (records) => {
  const recordsClean = (Array.isArray(records) ? records : [records]).map((r) => ({
    ...r,
    variante_id: r.variante_id || "original",
  }));

  try {
    return await dbUpsert(
      "progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo,variante_id",
      recordsClean,
      { headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }
    );
  } catch (err) {
    const errStr = String(err?.message || err || "");
    if (
      errStr.includes("57014") ||
      errStr.includes("statement timeout") ||
      errStr.includes("on_conflict") ||
      errStr.includes("constraint")
    ) {
      // Fallback al índice único base de 5 columnas
      return await dbUpsert(
        "progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo",
        recordsClean,
        { headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }
      );
    }
    throw err;
  }
};

const offlineAwareNutriUpsert = (records) =>
  dbUpsert("nutricion_progreso?on_conflict=cliente_id,dia_id,semana", records, {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });

export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles, isEmbedded, embeddedTab }) {
  const { data: cliente } = session;
  const brand = useBrand();

  useBackButton(isAtletaMode && typeof onBackToAdmin === "function", onBackToAdmin, 5);
  
  const [tabState, setTab] = useState(() => {
    const saved = sessionStorage.getItem("flux_cliente_tab");
    return saved ? saved : "perfil";
  });

  const tab = isEmbedded ? embeddedTab : tabState;

  useEffect(() => {
    if (tab) sessionStorage.setItem("flux_cliente_tab", tab);
  }, [tab]);

  useEffect(() => {
    if (isEmbedded) return;
    const onNavigateTab = (e) => {
      const nextTab = e?.detail?.tab;
      if (nextTab) setTab(nextTab);
    };
    window.addEventListener("flux:navigate-tab", onNavigateTab);
    return () => window.removeEventListener("flux:navigate-tab", onNavigateTab);
  }, [isEmbedded]);

  const [nutri, setNutri] = useState(null);
  const [dias, setDias] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [progreso, setProgreso] = useState({});
  const [nutriProgreso, setNutriProgreso] = useState({});
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
        const ds = await dbGet(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`);
        setDias(ds.map(d => ({ 
          ...d, 
          comidas: (d.comidas || []).sort((a, b) => a.orden - b.orden) 
        })));
      } else {
        setNutri(null);
        setDias([]);
      }

      try {
        const npRows = await dbGet(`nutricion_progreso?cliente_id=eq.${cliente.id}&limit=1000`);
        if (Array.isArray(npRows)) {
          const npMap = {};
          npRows.forEach(r => {
            if (r?.dia_id && r?.semana != null) {
              npMap[`${r.dia_id}-${r.semana}`] = r;
            }
          });
          setNutriProgreso(npMap);
        }
      } catch (e) {}

      const rs = await dbGet(`rutinas?cliente_id=eq.${cliente.id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`);
      const rsFull = rs.map(r => ({ 
        ...r, 
        ejercicios: (r.ejercicios || []).sort((a, b) => a.orden - b.orden) 
      }));
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
    let cacheTimer = null;

    const onFocus = () => {
      if (document.visibilityState === 'visible') loadData();
    };

    const onCacheUpdated = () => {
      if (cacheTimer) clearTimeout(cacheTimer);
      cacheTimer = setTimeout(() => {
        if (
          Object.keys(pendingSavesRef.current || {}).length === 0 &&
          Object.keys(pendingNutriSavesRef.current || {}).length === 0
        ) {
          loadData();
        }
      }, 300);
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    
    return () => {
      if (cacheTimer) clearTimeout(cacheTimer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, [cliente.id]);

  const pendingSavesRef = useRef({});
  const globalSaveTimerRef = useRef(null);
  const pendingNutriSavesRef = useRef({});
  const nutriSaveTimerRef = useRef(null);

  const handleNutriProgressChange = (record) => {
    if (!record?.dia_id || !cliente?.id) return;
    const key = `${record.dia_id}-${record.semana}`;
    const fullRecord = {
      ...record,
      cliente_id: cliente.id,
      updated_at: new Date().toISOString(),
    };
    setNutriProgreso((prev) => ({ ...prev, [key]: fullRecord }));
    pendingNutriSavesRef.current[key] = fullRecord;

    if (nutriSaveTimerRef.current) clearTimeout(nutriSaveTimerRef.current);
    nutriSaveTimerRef.current = setTimeout(async () => {
      const batch = Object.values(pendingNutriSavesRef.current);
      if (batch.length === 0) return;
      pendingNutriSavesRef.current = {};
      try {
        await offlineAwareNutriUpsert(batch);
      } catch (e) {
        console.error("Error guardando progreso nutricional:", e);
      }
    }, 500);
  };

  const handleProgressChange = (ejId, wi, si, tipo, val, variante_id ="original") => {
    const key = `${ejId}-${wi}-${si}-${tipo}-${variante_id}`;
    setProgreso(p => ({ ...p, [key]: val }));
    
    pendingSavesRef.current[key] = {
      ejercicio_id: ejId, 
      cliente_id: cliente.id, 
      semana: parseInt(wi), 
      serie: parseInt(si), 
      tipo, 
      valor: val,
      variante_id,
      updated_at: new Date().toISOString() 
    };
    
    setSyncStatus("saving");
    
    if (globalSaveTimerRef.current) {
      clearTimeout(globalSaveTimerRef.current);
    }
    
    globalSaveTimerRef.current = setTimeout(async () => {
      const recordsToSave = Object.values(pendingSavesRef.current);
      if (recordsToSave.length === 0) return;
      
      // Limpiar cola para el próximo lote
      pendingSavesRef.current = {};
      
      try {
        // Enviar todo el paquete en una sola petición
        await offlineAwareUpsert(recordsToSave);
        setSyncStatus(navigator.onLine && (await getPendingMutations()) === 0 ? "synced" : "local");
      } catch(e) {
        console.error("Error guardando progreso en lote:", e);
        setSyncStatus("local");
      }
    }, 1000); // 1 segundo global debounce
  };

    // Ocultar pestaña de citas si es usuario civil (no tiene nutriólogo)
  const isActuallyCivil = cliente?.nutriologo_id === null;

  const SIDEBAR_ITEMS = [
    { id:"nutricion",label:"Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id:"deporte",  label:"Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id:"progreso", label:"Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    ...((!isActuallyCivil && cliente?.objetivo !=="Mi entrenamiento personal") ? [
      { id:"citas",    label:"Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> }
    ] : [])
  ];

  // Cálculo de semana actual en zona horaria local del dispositivo (sin desfase UTC)
  const startStr = cicloActivo?.fecha_inicio || cicloActivo?.created_at || (rutinas.length > 0 ? rutinas[0].created_at : (nutri?.updated_at || null));
  const { currentCycleWeek, isFuture } = getCurrentCycleWeekInfo(startStr);

  const cycleWeeksFromName = cicloActivo?.nombre?.includes("|") ? parseInt(cicloActivo.nombre.split("|")[1]) : 0;
  const cycleDuration = rutinas.length > 0
    ? Math.max(cycleWeeksFromName || 0, ...rutinas.map(r => parseInt(r.semanas) || 4))
    : (cycleWeeksFromName || 4);
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
              <Dumbbell size={16} /> {cliente?.nutriologo_id === null || isAtletaMode ?"Entrenando" :"Estás en Modo Atleta"}
            </span>
            <span className="text-[#047857] text-xs md:text-sm hidden sm:block">
              {cliente?.nutriologo_id === null ?"Modo de ejecución de rutina." :"Previsualiza tu app exactamente como lo verían tus pacientes."}
            </span>
          </div>
          <button onClick={onBackToAdmin} className="bg-[#10B981] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors shadow-sm whitespace-nowrap">
            {cliente?.nutriologo_id === null ?"Volver al Editor" :"Volver al Panel"}
          </button>
        </div>
      )}
      {loading ? (
        <div className="p-6 md:p-8 max-w-5xl w-full mx-auto">
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <Suspense fallback={<div className="p-6 md:p-8 max-w-5xl w-full mx-auto"><ListSkeleton rows={4} /></div>}>
          {isFinished && (tab ==="nutricion" || tab ==="deporte") ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
              <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center shadow-sm mb-4">
                <Trophy size={32} className="text-[#10B981]" />
              </div>
              <h3 className="text-[#0B1929] font-bold text-xl mb-2" style={{ fontFamily:"DM Sans" }}>
                ¡Felicidades, terminaste!
              </h3>
              <p className="text-[#6B7A8D] text-sm max-w-[280px]">
                {cliente?.nutriologo_id === null || isEmbedded ?"Has completado exitosamente todas las semanas de este ciclo. ¡Es momento de ir al editor y diseñar tu próximo plan!" :"Has completado exitosamente todas las semanas de este ciclo. Contacta a tu nutriólogo para agendar tu próxima evaluación y recibir tu nuevo plan."}
              </p>
            </div>
          ) : (
            <>
              
              {tab ==="nutricion" && (
                <Nutrition
                  dias={dias}
                  cliente={cliente}
                  nutri={nutri}
                  semanaActualCiclo={currentCycleWeek}
                  ultimoPeso={ultimoPeso}
                  nutriProgreso={nutriProgreso}
                  onNutriProgressChange={handleNutriProgressChange}
                  isSelfManaged={cliente?.nutriologo_id === null || isAtletaMode || isEmbedded}
                />
              )}

              {tab ==="deporte" && (
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
                  isSelfManaged={cliente?.nutriologo_id === null || isAtletaMode || isEmbedded}
                />
              )}
            </>
          )}

          {tab ==="progreso" && (
            <Progreso cliente={cliente} isSelfManaged={cliente?.nutriologo_id === null || isAtletaMode || isEmbedded} />
          )}

          {tab ==="citas" && (
            <CitasCliente cliente={cliente} />
          )}

          {tab ==="perfil" && (
            isAtletaMode ? (
              <PerfilNutriologo profileId={session.profileId} onLogout={onLogout} role={session.adminRole} />
            ) : (
              <UserProfile session={session} onLogout={onLogout} onChangeRole={onChangeRole} multiRoles={multiRoles} />
            )
          )}
        </Suspense>
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
