import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { AppLayout } from "../components/ui/AppLayout";
import { dbPeek, dbGet, dbGetFresh, dbUpsert, getPendingMutations } from "../lib/supabase";
import { useBackButton } from "../lib/backButtonHandler";
import { getAll } from "../lib/offlineQueue";
import { useBrand } from "../components/BrandContext";
import { getCurrentCycleWeekInfo } from "../utils/helpers";
import BloqueadoPaciente from "../components/BloqueadoPaciente";
import { UtensilsCrossed, Dumbbell, User, CalendarDays, Camera, ShoppingBag, MapPin, Trophy, Activity, ClipboardList, X } from "lucide-react";
import { ListSkeleton } from "../components/ui/Skeleton";

import { CitasCliente } from "../components/CitasCliente";
import Nutrition from "../components/cliente/Nutrition";
import Training from "../components/cliente/Training";
import Progreso from "../components/cliente/Progreso";
import UserProfile from "../components/UserProfile";
import PerfilNutriologo from "../components/admin/PerfilNutriologo";
import NuevoExpedienteForms from "../components/clinical/NuevoExpedienteForms";
import { peekClinicalRecord, fetchClinicalRecord } from "../lib/clinicalRecord";

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

export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, onRolesUpdated, multiRoles, isEmbedded, embeddedTab }) {
  const { data: cliente } = session;
  const brand = useBrand();

  useBackButton(isAtletaMode && typeof onBackToAdmin === "function", onBackToAdmin, 5);
  
  const [tabState, setTab] = useState(() => {
    const saved = sessionStorage.getItem("flux_cliente_tab");
    return saved ? saved : "perfil";
  });

  const tab = isEmbedded ? embeddedTab : tabState;

  const [visitedTabs, setVisitedTabs] = useState(() => new Set([tab]));

  useEffect(() => {
    if (tab) {
      sessionStorage.setItem("flux_cliente_tab", tab);
      setVisitedTabs(prev => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    }
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

  const _peekCiclos = cliente?.id ? dbPeek(`ciclos?cliente_id=eq.${cliente.id}&activo=eq.true&limit=1`) : null;
  const _peekCiclo = Array.isArray(_peekCiclos) && _peekCiclos.length ? _peekCiclos[0] : null;
  const _peekCicloFilter = _peekCiclo ? `ciclo_id=eq.${_peekCiclo.id}` : `ciclo_id=is.null`;
  const _peekNs = cliente?.id ? dbPeek(`nutricion?cliente_id=eq.${cliente.id}&${_peekCicloFilter}`) : null;
  const _peekNutri = Array.isArray(_peekNs) && _peekNs.length ? _peekNs[0] : null;
  const _peekDs = _peekNutri ? dbPeek(`nutricion_dias?nutricion_id=eq.${_peekNutri.id}&select=*,comidas(*)&order=orden.asc`) : null;
  const _peekRs = cliente?.id ? dbPeek(`rutinas?cliente_id=eq.${cliente.id}&${_peekCicloFilter}&select=*,ejercicios(*)&order=orden.asc`) : null;

  const [nutri, setNutri] = useState(() => _peekNutri);
  const [dias, setDias] = useState(() =>
    Array.isArray(_peekDs)
      ? _peekDs.map(d => ({ ...d, comidas: (d.comidas || []).sort((a, b) => a.orden - b.orden) }))
      : []
  );
  const [rutinas, setRutinas] = useState(() =>
    Array.isArray(_peekRs)
      ? _peekRs.map(r => ({ ...r, ejercicios: (r.ejercicios || []).sort((a, b) => a.orden - b.orden) }))
      : []
  );
  const [progreso, setProgreso] = useState({});
  const [nutriProgreso, setNutriProgreso] = useState(() => {
    const npRows = cliente?.id ? dbPeek(`nutricion_progreso?cliente_id=eq.${cliente.id}&limit=1000`) : null;
    if (!Array.isArray(npRows)) return {};
    const npMap = {};
    npRows.forEach(r => {
      if (r?.dia_id && r?.semana != null) npMap[`${r.dia_id}-${r.semana}`] = r;
    });
    return npMap;
  });
  const [loading, setLoading] = useState(() => !(_peekCiclos !== null || _peekRs !== null || _peekNs !== null));
  const [cicloActivo, setCicloActivo] = useState(() => _peekCiclo);
  const [syncStatus, setSyncStatus] = useState("synced");
  const [nutriologoBloqueado, setNutriologoBloqueado] = useState(false);
  const [ultimoPeso, setUltimoPeso] = useState(() => {
    const met = cliente?.id ? dbPeek(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc&limit=1`) : null;
    return Array.isArray(met) && met.length > 0 && met[0].peso ? parseFloat(met[0].peso) : null;
  });
  
  
  const [biblioteca, setBiblioteca] = useState(() => dbPeek("biblioteca_ejercicios?order=nombre.asc") || []);
  const [clinicalRec, setClinicalRec] = useState(() =>
    cliente?.id && cliente?.nutriologo_id ? peekClinicalRecord(cliente.id) : null
  );
  const [showIntakeForms, setShowIntakeForms] = useState(false);

  const loadData = async ({ silent = false, forceFresh = false } = {}) => {
    if (!silent && dias.length === 0 && rutinas.length === 0 && _peekCiclos === null) {
      setLoading(true);
    }
    const fetcher = forceFresh ? dbGetFresh : dbGet;
    try {
      if (!isEmbedded && cliente?.nutriologo_id) {
        fetchClinicalRecord(cliente.id).then((rec) => {
          if (rec) setClinicalRec(rec);
        }).catch(() => {});

        const nutriProfile = await fetcher(`profiles?id=eq.${cliente.nutriologo_id}&select=bloqueado`);
        if (nutriProfile && nutriProfile[0]?.bloqueado) {
          setNutriologoBloqueado(true);
          setLoading(false);
          return;
        }
      }

      // Consultas paralelas iniciales
      const [cs, met, npRows] = await Promise.all([
        fetcher(`ciclos?cliente_id=eq.${cliente.id}&activo=eq.true&limit=1`).catch(() => []),
        fetcher(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc&limit=1`).catch(() => []),
        fetcher(`nutricion_progreso?cliente_id=eq.${cliente.id}&limit=1000`).catch(() => [])
      ]);

      const ciclo = cs.length ? cs[0] : null;
      setCicloActivo(ciclo);

      if (met && met.length > 0 && met[0].peso) {
        setUltimoPeso(parseFloat(met[0].peso));
      }

      if (Array.isArray(npRows)) {
        const npMap = {};
        npRows.forEach(r => {
          if (r?.dia_id && r?.semana != null) {
            npMap[`${r.dia_id}-${r.semana}`] = r;
          }
        });
        setNutriProgreso(npMap);
      }

      const cicloFilter = ciclo ? `ciclo_id=eq.${ciclo.id}` : `ciclo_id=is.null`;

      // Consultas paralelas de nutrición y rutinas
      const [ns, rs] = await Promise.all([
        fetcher(`nutricion?cliente_id=eq.${cliente.id}&${cicloFilter}`).catch(() => []),
        fetcher(`rutinas?cliente_id=eq.${cliente.id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`).catch(() => [])
      ]);

      if (ns && ns.length) {
        setNutri(ns[0]);
        const ds = await fetcher(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`).catch(() => []);
        if (ds) {
          setDias(ds.map(d => ({ 
            ...d, 
            comidas: (d.comidas || []).sort((a, b) => a.orden - b.orden) 
          })));
        }
      } else {
        setNutri(null);
        setDias([]);
      }

      const rsFull = (rs || []).map(r => ({ 
        ...r, 
        ejercicios: (r.ejercicios || []).sort((a, b) => a.orden - b.orden) 
      }));
      setRutinas(rsFull);

      const allIds = rsFull.flatMap(r => r.ejercicios.map(e => e.id));
      if (allIds.length) {
        const ps = await fetcher(`progreso?cliente_id=eq.${cliente.id}&ejercicio_id=in.(${allIds.join(",")})&limit=3000`).catch(() => []);
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
    } catch (e) {
      console.error("Error cargando datos del cliente:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData({ silent: !loading });
    let cacheTimer = null;

    const onFocus = () => {
      if (document.visibilityState === 'visible') loadData({ silent: true, forceFresh: true });
    };

    const onCacheUpdated = () => {
      if (cacheTimer) clearTimeout(cacheTimer);
      cacheTimer = setTimeout(() => {
        if (
          Object.keys(pendingSavesRef.current || {}).length === 0 &&
          Object.keys(pendingNutriSavesRef.current || {}).length === 0
        ) {
          loadData({ silent: true, forceFresh: true });
        }
      }, 200);
    };

    const onPlanUpdated = (e) => {
      const targetId = e?.detail?.clienteId;
      if (!targetId || targetId === cliente?.id) {
        loadData({ silent: true, forceFresh: true });
      }
    };

    const onExpedienteUpdated = (e) => {
      const targetId = e?.detail?.clienteId;
      if (!targetId || targetId === cliente?.id) {
        if (e?.detail?.record) setClinicalRec(e.detail.record);
        else if (cliente?.id) fetchClinicalRecord(cliente.id).then(rec => rec && setClinicalRec(rec)).catch(() => {});
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    window.addEventListener("flux:plan-updated", onPlanUpdated);
    window.addEventListener("flux:expediente-updated", onExpedienteUpdated);
    
    return () => {
      if (cacheTimer) clearTimeout(cacheTimer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
      window.removeEventListener("flux:plan-updated", onPlanUpdated);
      window.removeEventListener("flux:expediente-updated", onExpedienteUpdated);
    };
  }, [cliente?.id]);

  // Si está embebido en el panel de Admin (nutriólogo viendo sus pestañas de atleta),
  // recargar inmediatamente al alternar a Nutrición o Entrenamiento
  useEffect(() => {
    if (isEmbedded && (embeddedTab === "nutricion" || embeddedTab === "deporte" || embeddedTab === "progreso")) {
      loadData({ silent: true, forceFresh: true });
    }
  }, [isEmbedded, embeddedTab]);

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

  const hasNutriService = isActuallyCivil || isAtletaMode || isEmbedded || (clinicalRec?.servicios_activos?.nutricion !== false);
  const hasEntrenamientoService = isActuallyCivil || isAtletaMode || isEmbedded || (clinicalRec?.servicios_activos?.entrenamiento !== false);

  const SIDEBAR_ITEMS = [
    ...(hasNutriService ? [{ id:"nutricion",label:"Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> }] : []),
    ...(hasEntrenamientoService ? [{ id:"deporte",  label:"Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> }] : []),
    { id:"progreso", label:"Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    ...((!isActuallyCivil && cliente?.objetivo !=="Mi entrenamiento personal") ? [
      { id:"citas",    label:"Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> }
    ] : [])
  ];

  // Si el servicio activo desactiva la pestaña actual, redirigir a una pestaña activa
  useEffect(() => {
    if (tab === "nutricion" && !hasNutriService) {
      setTab(hasEntrenamientoService ? "deporte" : "progreso");
    } else if (tab === "deporte" && !hasEntrenamientoService) {
      setTab(hasNutriService ? "nutricion" : "progreso");
    }
  }, [tab, hasNutriService, hasEntrenamientoService]);

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

  // Resumen automático de adherencia nutricional para el check-in
  const adherenciaSummary = (() => {
    const entries = Object.values(nutriProgreso || {}).filter(
      (r) => Number(r.semana) === Number(currentCycleWeek)
    );
    if (entries.length === 0) return null;
    const totalComidasDone = entries.reduce(
      (s, r) => s + (Array.isArray(r.comidas_completadas) ? r.comidas_completadas.length : 0),
      0
    );
    const avgComidasPerDay =
      dias.length > 0
        ? dias.reduce((s, d) => s + ((d.comidas || []).length || 0), 0) / dias.length
        : 4;
    const expectedTotal = Math.max(1, Math.round(avgComidasPerDay * entries.length));
    const comidasPct = Math.min(100, Math.round((totalComidasDone / expectedTotal) * 100));
    const aguaEntries = entries.filter((r) => Number(r.agua_ml) > 0);
    const aguaPromedioL =
      aguaEntries.length > 0
        ? (
            aguaEntries.reduce((s, r) => s + Number(r.agua_ml || 0), 0) /
            aguaEntries.length /
            1000
          ).toFixed(1)
        : null;
    return { comidasPct, aguaPromedioL };
  })();

  const hasActiveClinicalRequest =
    !isEmbedded &&
    !isAtletaMode &&
    Boolean(cliente?.nutriologo_id) &&
    clinicalRec?.solicitud_activa === "historia_inicial";

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
      {hasActiveClinicalRequest && (
        <div className="px-4 md:px-8 pt-4 max-w-5xl w-full mx-auto">
          <div className="bg-white border border-[var(--brand-primary)]/25 rounded-2xl p-3.5 sm:px-5 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                <ClipboardList size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-[#0B1929] truncate">
                  Historia clínica inicial solicitada
                </p>
                <p className="text-[11px] text-[#6B7A8D] truncate">
                  Completa tus antecedentes y hábitos para tu especialista.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIntakeForms(true)}
              className="px-3.5 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-95 transition-opacity shrink-0 shadow-sm cursor-pointer"
            >
              Completar
            </button>
          </div>
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
              {(tab === "nutricion" || visitedTabs.has("nutricion")) && (
                <div className={tab === "nutricion" ? "flex-1 flex flex-col" : "hidden"}>
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
                </div>
              )}

              {(tab === "deporte" || visitedTabs.has("deporte")) && (
                <div className={tab === "deporte" ? "flex-1 flex flex-col" : "hidden"}>
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
                </div>
              )}
            </>
          )}

          {(tab === "progreso" || visitedTabs.has("progreso")) && (
            <div className={tab === "progreso" ? "flex-1 flex flex-col" : "hidden"}>
              <Progreso cliente={cliente} isSelfManaged={cliente?.nutriologo_id === null || isAtletaMode || isEmbedded} />
            </div>
          )}

          {(tab === "citas" || visitedTabs.has("citas")) && (
            <div className={tab === "citas" ? "flex-1 flex flex-col" : "hidden"}>
              <CitasCliente cliente={cliente} />
            </div>
          )}

          {(tab === "perfil" || visitedTabs.has("perfil")) && (
            <div className={tab === "perfil" ? "flex-1 flex flex-col" : "hidden"}>
              {isAtletaMode ? (
                <PerfilNutriologo profileId={session.profileId} onLogout={onLogout} role={session.adminRole} />
              ) : (
                <UserProfile session={session} onLogout={onLogout} onChangeRole={onChangeRole} onRolesUpdated={onRolesUpdated} multiRoles={multiRoles} />
              )}
            </div>
          )}
        </Suspense>
      )}
      {showIntakeForms && (
        <div className="fixed inset-0 z-[120] bg-[#F7F9FC] overflow-y-auto flex flex-col p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl mx-auto flex justify-end mb-1">
            <button
              type="button"
              onClick={() => setShowIntakeForms(false)}
              className="p-2 rounded-xl text-[#6B7A8D] hover:text-[#0B1929] hover:bg-white transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <X size={16} />
              <span>Cerrar</span>
            </button>
          </div>
          <NuevoExpedienteForms
            cliente={cliente}
            mode="paciente"
            onFinished={(savedRec) => {
              if (savedRec) setClinicalRec(savedRec);
              setShowIntakeForms(false);
            }}
            onBackToList={() => setShowIntakeForms(false)}
          />
        </div>
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
