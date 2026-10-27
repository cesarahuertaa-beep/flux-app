import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { ListSkeleton } from "../ui/Skeleton";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableItem } from "../SortableItem";
import { RefreshCw, ChevronDown, Trash2, Calendar, Activity, CheckCircle2, AlertCircle, Save, Edit2, Plus, Search, FileText, Download, Lock, X, Utensils, Dumbbell, BarChart2, Camera, Image as ImageIcon, Bookmark, Calculator } from "lucide-react";
import { EjercicioSelector } from "./EjercicioSelector";
import { ConfirmModal } from "../ui/ConfirmModal";
import { CustomSelect } from "../ui/CustomSelect";
import { generateNutriPDF } from "../../utils/pdf";
import { dbPeek, dbGet, dbGetFresh, dbPost, dbPatch, dbDel, dbUpsert, storageUpload, updateQueryCache, invalidateCache } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { useBackButton } from "../../lib/backButtonHandler";
import { CachedImage } from "../../lib/mediaCache";

import { ProgresoCliente } from "./ProgresoCliente";
import TemplatesManagerModal from "../ui/TemplatesManagerModal";
import MacroCalculatorModal from "../clinical/MacroCalculatorModal";

const isOfflineError = (e) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!e) return false;
  const m = (e.message || String(e)).toLowerCase();
  return m.includes("offline") || m.includes("failed to fetch") || m.includes("network") || m.includes("aborted");
};

export function ProgramarCliente({ clientes, selected, setSelected, setMsg, biblioteca, isMiPlan, onModoAtleta }) {
  const brand = useBrand();
  const [subtab, setSubtab] = useState(() => {
    const s = sessionStorage.getItem("flux_programar_subtab");
    return s ? s : "nutri";
  });

  useEffect(() => {
    if (subtab) sessionStorage.setItem("flux_programar_subtab", subtab);
  }, [subtab]);

  const [searchProg, setSearchProg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const _peekCiclos = selected?.id ? dbPeek(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`) : null;
  const _peekActiveCiclo = Array.isArray(_peekCiclos) ? (_peekCiclos.find(c => c.activo) || _peekCiclos[0] || null) : null;
  const _peekFilter = _peekActiveCiclo ? `ciclo_id=eq.${_peekActiveCiclo.id}` : `ciclo_id=is.null`;
  const _peekNs = selected?.id ? dbPeek(`nutricion?cliente_id=eq.${selected.id}&${_peekFilter}`) : null;
  const _peekNutri = Array.isArray(_peekNs) && _peekNs.length ? _peekNs[0] : null;
  const _peekDs = _peekNutri ? dbPeek(`nutricion_dias?nutricion_id=eq.${_peekNutri.id}&select=*,comidas(*)&order=orden.asc`) : null;
  const _peekRs = selected?.id ? dbPeek(`rutinas?cliente_id=eq.${selected.id}&${_peekFilter}&select=*,ejercicios(*)&order=orden.asc`) : null;

  // ── Ciclos ──
  const [ciclos, setCiclos] = useState(() => Array.isArray(_peekCiclos) ? _peekCiclos : []);
  const [cicloSel, setCicloSel] = useState(() => _peekActiveCiclo);
  const [showPastCycles, setShowPastCycles] = useState(false);
  useEffect(() => { 
    if (cicloSel && !cicloSel.activo) setShowPastCycles(true); 
    if (cicloSel && selected?.id) sessionStorage.setItem(`flux_programar_ciclo_${selected.id}`, cicloSel.id);
  }, [cicloSel, selected?.id]); // ciclo seleccionado para ver/editar

  // ── Datos del ciclo seleccionado ──
  const [nutri, setNutri] = useState(() => _peekNutri);
  const [dias, setDias] = useState(() =>
    Array.isArray(_peekDs)
      ? _peekDs.map(d => ({ ...d, comidas: (d.comidas || []).sort((a,b) => a.orden - b.orden) }))
      : []
  );
  const [rutinas, setRutinas] = useState(() =>
    Array.isArray(_peekRs)
      ? _peekRs.map(r => ({ ...r, ejercicios: (r.ejercicios || []).sort((a,b) => a.orden - b.orden) }))
      : []
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [macros, setMacros] = useState(() => ({
    calorias: _peekNutri?.calorias || "",
    proteina: _peekNutri?.proteina || "",
    carbohidratos: _peekNutri?.carbohidratos || "",
    grasas: _peekNutri?.grasas || ""
  }));
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({ fecha_inicio: new Date().toISOString().split("T")[0], semanas: 4 });
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [editDia, setEditDia] = useState(null);
  const [diaForm, setDiaForm] = useState({ dia:"", orden:0, comidas:[] });
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editRutina, setEditRutina] = useState(null);
  const [rutinaForm, setRutinaForm] = useState({ nombre:"", ejercicios:[] });
  const [activeAltSlot, setActiveAltSlot] = useState(null);
  const [templateModal, setTemplateModal] = useState(null); // 'nutri' | 'rutina' | null
  const [showMacroCalc, setShowMacroCalc] = useState(false);
  const [latestMetrica, setLatestMetrica] = useState(() => {
    const ms = selected?.id ? dbPeek(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc`) : null;
    return Array.isArray(ms) && ms.length > 0 ? ms[0] : null;
  });

  const ORDINALES = ["Primer","Segundo","Tercer","Cuarto","Quinto","Sexto","Séptimo","Octavo","Noveno","Décimo"];

  const isReadOnly = cicloSel && !cicloSel.activo;
  const isEstandar = localStorage.getItem("flux_role") === "civil" && selected && !selected.nutriologo_id && selected.plan_tipo !== 'premium' && selected.objetivo !== 'Mi entrenamiento personal';

  // ── Historial para Plantillas ──
  const [historialRutinas, setHistorialRutinas] = useState([]);
  const [historialDias, setHistorialDias] = useState([]);
  const historialLoadedRef = useRef(false);

  // ── Crop de foto de comida y subidas en segundo plano ──
  const [cropModal, setCropModal] = useState(null); // { objectUrl, mealIndex }
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgCropRef = useRef(null);
  const pendingPhotoUploadsRef = useRef({});

  useBackButton(!!cropModal, () => {
    if (cropModal?.objectUrl) {
      try { URL.revokeObjectURL(cropModal.objectUrl); } catch (e) {}
    }
    setCropModal(null);
  }, 50);
  useBackButton(!!templateModal, () => setTemplateModal(null), 40);
  useBackButton(!!showDiaModal, () => setShowDiaModal(false), 20);
  useBackButton(!!showRutinaModal, () => setShowRutinaModal(false), 20);
  useBackButton(!!showPlanModal, () => setShowPlanModal(false), 20);
  
  const getClientName = (id) => clientes?.find(c => c.id === id)?.nombre ||"Desconocido";

  const notifyPlanUpdate = (table) => {
    if (table) invalidateCache(table);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("flux:plan-updated", {
        detail: { clienteId: selected?.id, table }
      }));
    }
  };

  const loadHistorial = useCallback(async () => {
    if (!clientes || clientes.length === 0 || historialLoadedRef.current) return;
    historialLoadedRef.current = true;
    try {
      const ids = clientes.map(c => c.id).join(",");
      const [hr, hn] = await Promise.all([
        dbGet(`rutinas?cliente_id=eq.${selected?.id || clientes[0].id}`).catch(() => []),
        dbGet(`nutricion?cliente_id=in.(${ids})`).catch(() => []),
      ]);
      // Cargar todas las rutinas en segundo plano sin bloquear
      dbGet(`rutinas?cliente_id=in.(${ids})`).then(allHr => {
        if (allHr) setHistorialRutinas(allHr);
      }).catch(() => {});
      if (hr) setHistorialRutinas(hr);
      
      if (hn && hn.length > 0) {
        const nids = hn.map(n => n.id).join(",");
        const hd = await dbGet(`nutricion_dias?nutricion_id=in.(${nids})`).catch(() => []);
        if (hd) {
          const hdMapped = hd.map(d => {
            const nut = hn.find(n => n.id === d.nutricion_id);
            return { ...d, cliente_id: nut?.cliente_id };
          });
          setHistorialDias(hdMapped);
        }
      }
    } catch(e) { 
      historialLoadedRef.current = false;
    }
  }, [clientes, selected?.id]);

  const onSelectHistorialRutina = async (e) => {
    const rid = e?.target ? e.target.value : (e || "");
    if (!rid) return;
    if (e?.target) e.target.value = "";
    const r = historialRutinas.find(x => String(x.id) === String(rid));
    if (!r) return;
    try {
      const ejs = await dbGet(`ejercicios?rutina_id=eq.${rid}&order=orden.asc`);
      setRutinaForm(p => ({
        ...p,
        nombre: r.nombre + " (Copia)",
        semanas: r.semanas,
        ejercicios: ejs.map(x => {
           const copy = {...x, _dndId: Math.random().toString(36).slice(2,9)};
           delete copy.id;
           delete copy.rutina_id;
           return copy;
        })
      }));
      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Rutina cargada del historial</div>);
    } catch(err) { 
      if (!isOfflineError(err)) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error cargando rutina</div>);
      }
    }
  };

  const onSelectHistorialDia = async (e) => {
    const did = e?.target ? e.target.value : (e || "");
    if (!did) return;
    if (e?.target) e.target.value = "";
    const d = historialDias.find(x => String(x.id) === String(did));
    if (!d) return;
    try {
      const coms = await dbGet(`comidas?dia_id=eq.${did}&order=orden.asc`);
      setDiaForm(p => ({
        ...p,
        dia: d.dia + " (Copia)",
        comidas: coms.map(x => {
           const copy = {...x, _dndId: Math.random().toString(36).slice(2,9)};
           delete copy.id;
           delete copy.dia_id;
           return copy;
        })
      }));
      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Día cargado del historial</div>);
    } catch(err) { 
      if (!isOfflineError(err)) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error cargando día</div>);
      }
    }
  };

  // ── Cargar ciclos del cliente ──
  const loadCiclos = useCallback(async (preferCycleId = null) => {
    if (!selected) return null;
    try {
      const cs = await dbGet(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`).catch(() => []);
      setCiclos(cs || []);
      
      const activeCycle = (cs || []).find(c => c.activo);
      let chosen = null;

      // 1. Si se pasa un ciclo preferido explícitamente (ej: recién creado o recién aplicado)
      if (preferCycleId) {
        chosen = (cs || []).find(c => c.id === preferCycleId);
      }

      // 2. Si no, en "Mi Plan", SIEMPRE priorizar el ciclo activo
      if (!chosen && isMiPlan && activeCycle) {
        chosen = activeCycle;
      }

      // 3. Si no, revisar si había un ciclo guardado para este cliente específico
      if (!chosen) {
        const savedCycleId = sessionStorage.getItem(`flux_programar_ciclo_${selected.id}`);
        if (savedCycleId) {
          const found = (cs || []).find(c => c.id === savedCycleId);
          // Si el cliente tiene ciclo activo pero el guardado es inactivo, preferir el activo
          if (found && (found.activo || !activeCycle)) {
            chosen = found;
          }
        }
      }

      // 4. Fallback al ciclo activo o al más reciente
      if (!chosen) {
        chosen = activeCycle || (cs && cs[0]) || null;
      }

      setCicloSel(chosen);
      return chosen;
    } catch(e) { 
      if (!isOfflineError(e)) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); 
      }
      return null;
    }
  }, [selected, isMiPlan]);

  // ── Cargar datos del ciclo seleccionado ──
  const loadData = useCallback(async (targetCiclo = cicloSel, opts = {}) => {
    if (!selected) return;
    const { silent = false, forceFresh = false } = opts;
    const currentCiclo = targetCiclo !== undefined ? targetCiclo : cicloSel;
    const cicloFilter = currentCiclo
      ? `ciclo_id=eq.${currentCiclo.id}`
      : `ciclo_id=is.null`;
    const hasCached = dbPeek(`nutricion?cliente_id=eq.${selected.id}&${cicloFilter}`) !== null ||
                      dbPeek(`rutinas?cliente_id=eq.${selected.id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`) !== null;
    if (!silent && !hasCached && dias.length === 0 && rutinas.length === 0) setLoading(true);
    try {

      const fetchFn = forceFresh ? dbGetFresh : dbGet;

      const [ns, rs, ms] = await Promise.all([
        fetchFn(`nutricion?cliente_id=eq.${selected.id}&${cicloFilter}`).catch(() => []),
        fetchFn(`rutinas?cliente_id=eq.${selected.id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`).catch(() => []),
        fetchFn(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc&limit=1`).catch(() => []),
      ]);

      if (Array.isArray(ms) && ms.length > 0) {
        setLatestMetrica(ms[0]);
      } else {
        setLatestMetrica(null);
      }

      if (rs) {
        setRutinas(rs.map(r => ({ ...r, ejercicios: (r.ejercicios || []).sort((a,b) => a.orden - b.orden) })));
      }

      if (ns && ns.length) {
        setNutri(ns[0]);
        setMacros({ calorias:ns[0].calorias||"", proteina:ns[0].proteina||"", carbohidratos:ns[0].carbohidratos||"", grasas:ns[0].grasas||"" });
        const ds = await fetchFn(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`).catch(() => []);
        if (ds) {
          setDias(ds.map(d => ({ ...d, comidas: (d.comidas || []).sort((a,b) => a.orden - b.orden) })));
        }
      } else { setNutri(null); setMacros({ calorias:"", proteina:"", carbohidratos:"", grasas:"" }); setDias([]); }
    } catch(e) { 
      if (!isOfflineError(e)) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); 
      }
    }
    if (!silent) setLoading(false);
  }, [selected, cicloSel]);

  const handleApplyPrescribedMacros = async ({ calorias, proteinas, carbohidratos, grasas }) => {
    if (!selected) return;
    if (interceptNoPlan()) return;
    const nextMacros = {
      calorias: Number(calorias) || 0,
      proteina: Number(proteinas) || 0,
      carbohidratos: Number(carbohidratos) || 0,
      grasas: Number(grasas) || 0,
    };
    setMacros(nextMacros);
    try {
      if (nutri?.id) {
        setNutri(prev => ({ ...prev, ...nextMacros }));
        await dbPatch(`nutricion?id=eq.${nutri.id}`, nextMacros);
      } else {
        const payload = {
          cliente_id: selected.id,
          ...nextMacros,
          ...(cicloSel ? { ciclo_id: cicloSel.id } : {}),
        };
        const res = await dbPost("nutricion", payload);
        if (res && res[0]) setNutri(res[0]);
      }
      notifyPlanUpdate("nutricion");
      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Prescripción energética aplicada al plan</div>);
    } catch (e) {
      if (!isOfflineError(e)) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
      }
    }
  };

  useEffect(() => { loadCiclos(); }, [loadCiclos]);
  useEffect(() => { if (cicloSel !== undefined) loadData(); }, [loadData]);

  useEffect(() => {
    let timer = null;
    const onCacheUpdated = (ev) => {
      if (saving || showDiaModal || showRutinaModal || showPlanModal) return;
      const table = ev?.detail?.table;
      if (table && !["ciclos", "nutricion", "nutricion_dias", "comidas", "rutinas", "ejercicios"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (table === "ciclos") loadCiclos();
        else if (cicloSel !== undefined) loadData(cicloSel, { silent: true });
      }, 400);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, [saving, showDiaModal, showRutinaModal, showPlanModal, loadCiclos, loadData, cicloSel]);

  // ── (Ciclos se crean ahora desde los modales de Día/Rutina) ──

  // ── Eliminar ciclo ──
  const eliminarCiclo = async (ciclo, e) => {
    e.stopPropagation(); // no seleccionar el ciclo al dar clic en borrar
    try {
      // Verificar si tiene datos en paralelo
      const [nutris, ruts] = await Promise.all([
        dbGet(`nutricion?ciclo_id=eq.${ciclo.id}`).catch(() => []),
        dbGet(`rutinas?ciclo_id=eq.${ciclo.id}`).catch(() => []),
      ]);

      const doDelete = async () => {
        // Cierre y actualización optimista en 0ms
        setConfirmDelete(null);
        const prevCiclos = ciclos;
        const remainingCiclos = ciclos.filter(c => c.id !== ciclo.id);
        setCiclos(remainingCiclos);

        if (ciclo.activo) {
          const anterior = remainingCiclos.find(c => !c.activo) || remainingCiclos[0] || null;
          if (anterior) {
            setCicloSel(anterior);
            setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> {`Ciclo eliminado. Se restauró: "${anterior.nombre}"`}</div>);
            dbPatch(`ciclos?id=eq.${anterior.id}`, { activo: true }).catch(() => {});
          } else {
            setCicloSel(null);
            setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Ciclo eliminado.</div>);
          }
        } else {
          setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Ciclo eliminado.</div>);
        }

        try {
          const delPromises = [];
          if (nutris?.length > 0) {
            delPromises.push(dbDel(`nutricion?id=in.(${nutris.map(n => n.id).join(",")})`));
          }
          if (ruts?.length > 0) {
            delPromises.push(dbDel(`rutinas?id=in.(${ruts.map(r => r.id).join(",")})`));
          }
          delPromises.push(dbDel(`ciclos?id=eq.${ciclo.id}`));
          await Promise.all(delPromises);
          loadCiclos();
          loadData(undefined, { silent: true, forceFresh: true });
          notifyPlanUpdate("ciclos");
        } catch(err) {
          if (!isOfflineError(err)) {
            setCiclos(prevCiclos);
            setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { err.message }</div>); 
          }
        }
      };

      if ((nutris?.length || 0) > 0 || (ruts?.length || 0) > 0) {
        setConfirmDelete({
          title: "¡Cuidado! Eliminar ciclo completo",
          description: `Este ciclo contiene ${ruts?.length || 0} rutina(s) y ${nutris?.length || 0} plan(es) de nutrición. Si continúas, se destruirá todo su contenido permanentemente.`,
          confirmText: "Eliminar todo",
          danger: true,
          icon: "alert",
          onConfirm: doDelete
        });
      } else {
        setConfirmDelete({
          title: `¿Eliminar "${ciclo.nombre}"?`,
          description: "Esta acción no se puede deshacer.",
          confirmText: "Eliminar",
          danger: true,
          icon: "trash",
          onConfirm: doDelete
        });
      }
    } catch(e) { 
      if (!isOfflineError(e)) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); 
      }
    }
  };

  // ── Operaciones de Planes (Ciclos) ──
  const getCycleWeeks = (c) => c?.nombre.includes("|") ? parseInt(c.nombre.split("|")[1]) : 4;

  const savePlan = async () => {
    setSaving(true);
    try {
      const start = new Date(planForm.fecha_inicio +"T12:00:00");
      const end = new Date(start);
      end.setDate(end.getDate() + (parseInt(planForm.semanas) * 7) - 1);
      const options = { day: 'numeric', month: 'short' };
      const rangeStr = `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}`;
      
      const idx = ciclos.length;
      const ordinal = ORDINALES[idx] || `${idx + 1}º`;
      const finalName = `${ordinal} Plan (${rangeStr})|${planForm.semanas}`;

      if (ciclos.some(c => c.activo)) {
        await dbPatch(`ciclos?cliente_id=eq.${selected.id}&activo=eq.true`, { activo: false });
      }
      const cRes = await dbPost("ciclos", { cliente_id: selected.id, nombre: finalName, fecha_inicio: planForm.fecha_inicio, activo: true });
      setShowPlanModal(false);
      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Plan creado exitosamente</div>);
      await loadCiclos(cRes[0].id);
      setCicloSel(cRes[0]);
      if (selected?.id) sessionStorage.setItem(`flux_programar_ciclo_${selected.id}`, cRes[0].id);
      await loadData(cRes[0], { silent: true, forceFresh: true });
      notifyPlanUpdate("ciclos");
      
      // Notify the patient (non-blocking)
      if (!isMiPlan && selected.auth_id) {
        dbPost("notificaciones", {
          profile_id: selected.auth_id,
          titulo: "Nuevo plan disponible",
          mensaje: "Tu nutriólogo ha creado un nuevo ciclo para ti.",
          tipo: "plan",
          link_url: "mi_plan",
          entidad_id: cRes[0].id
        }, { headers: { Prefer: "return=minimal" } }).catch(() => {});
      }
    } catch(e) { 
      setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); 
    }
    setSaving(false);
  };

  const handleApplyNutriTemplate = async (tpl) => {
    if (!selected) return;
    setSaving(true);
    try {
      let activeCiclo = cicloSel;
      if (!activeCiclo || (!activeCiclo.activo && ciclos.some((c) => c.activo))) {
        activeCiclo = ciclos.find((c) => c.activo) || activeCiclo;
      }
      if (!activeCiclo) {
        const start = new Date(planForm.fecha_inicio + "T12:00:00");
        const end = new Date(start);
        end.setDate(end.getDate() + 27);
        const options = { day: "numeric", month: "short" };
        const rangeStr = `${start.toLocaleDateString("es-ES", options)} - ${end.toLocaleDateString("es-ES", options)}`;
        const idx = ciclos.length;
        const ordinal = ORDINALES[idx] || `${idx + 1}º`;
        const finalName = `${ordinal} Plan (${rangeStr})|4`;
        if (ciclos.some((c) => c.activo)) {
          await dbPatch(`ciclos?cliente_id=eq.${selected.id}&activo=eq.true`, { activo: false });
        }
        const cRes = await dbPost("ciclos", {
          cliente_id: selected.id,
          nombre: finalName,
          fecha_inicio: planForm.fecha_inicio,
          activo: true
        });
        activeCiclo = cRes[0];
        await loadCiclos(activeCiclo.id);
      }

      setCicloSel(activeCiclo);
      if (selected?.id) sessionStorage.setItem(`flux_programar_ciclo_${selected.id}`, activeCiclo.id);

      let currentNutri = nutri;
      if (!currentNutri) {
        const payload = {
          cliente_id: selected.id,
          calorias: tpl.macros?.calorias || 0,
          proteina: tpl.macros?.proteina || 0,
          carbohidratos: tpl.macros?.carbohidratos || 0,
          grasas: tpl.macros?.grasas || 0,
          ciclo_id: activeCiclo.id
        };
        const res = await dbPost("nutricion", payload);
        currentNutri = res[0];
        setNutri(currentNutri);
      } else if (tpl.macros) {
        await dbPatch(`nutricion?id=eq.${currentNutri.id}`, tpl.macros);
        setMacros(tpl.macros);
      }

      for (let i = 0; i < (tpl.dias || []).length; i++) {
        const d = tpl.dias[i];
        const dRes = await dbPost("nutricion_dias", {
          nutricion_id: currentNutri.id,
          dia: d.dia || `Día ${dias.length + i + 1}`,
          orden: dias.length + i
        });
        const newDia = dRes[0];
        if (newDia && d.comidas?.length > 0) {
          const comsData = d.comidas.map((c, cIdx) => ({
            dia_id: newDia.id,
            hora: c.hora || "",
            nombre: c.nombre || `Comida ${cIdx + 1}`,
            opcion1: c.opcion1 || "",
            opcion2: c.opcion2 || "",
            calorias: +c.calorias || 0,
            proteina: +c.proteina || 0,
            carbohidratos: +c.carbohidratos || 0,
            grasas: +c.grasas || 0,
            foto_url: c.foto_url || "",
            orden: cIdx
          }));
          await dbPost("comidas", comsData);
        }
      }

      await loadData(activeCiclo, { silent: true, forceFresh: true });
      notifyPlanUpdate("nutricion");
      setMsg(
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-green-500" /> Plantilla "{tpl.nombre}" aplicada con éxito
        </div>
      );
    } catch (e) {
      setMsg(
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-red-500" /> Error aplicando plantilla: {e.message}
        </div>
      );
    }
    setSaving(false);
  };

  const handleApplyRutinaTemplate = async (tpl) => {
    if (!selected) return;
    setSaving(true);
    try {
      let activeCiclo = cicloSel;
      if (!activeCiclo || (!activeCiclo.activo && ciclos.some((c) => c.activo))) {
        activeCiclo = ciclos.find((c) => c.activo) || activeCiclo;
      }
      if (!activeCiclo) {
        const start = new Date(planForm.fecha_inicio + "T12:00:00");
        const end = new Date(start);
        end.setDate(end.getDate() + 27);
        const options = { day: "numeric", month: "short" };
        const rangeStr = `${start.toLocaleDateString("es-ES", options)} - ${end.toLocaleDateString("es-ES", options)}`;
        const idx = ciclos.length;
        const ordinal = ORDINALES[idx] || `${idx + 1}º`;
        const finalName = `${ordinal} Plan (${rangeStr})|4`;
        if (ciclos.some((c) => c.activo)) {
          await dbPatch(`ciclos?cliente_id=eq.${selected.id}&activo=eq.true`, { activo: false });
        }
        const cRes = await dbPost("ciclos", {
          cliente_id: selected.id,
          nombre: finalName,
          fecha_inicio: planForm.fecha_inicio,
          activo: true
        });
        activeCiclo = cRes[0];
        await loadCiclos(activeCiclo.id);
      }

      // Limpiar rutinas fantasma vacías (0 ejercicios) en este ciclo si existían
      const existingEmpty = rutinas.filter(r => (r.ejercicios || []).length === 0 && r.ciclo_id === activeCiclo.id);
      for (const er of existingEmpty) {
        try { await dbDel(`rutinas?id=eq.${er.id}`); } catch(_) {}
      }

      const currentValidCount = rutinas.filter(r => (r.ejercicios || []).length > 0 && r.ciclo_id === activeCiclo.id).length;

      for (let i = 0; i < (tpl.rutinas || []).length; i++) {
        const r = tpl.rutinas[i];
        const rRes = await dbPost("rutinas", {
          cliente_id: selected.id,
          ciclo_id: activeCiclo.id,
          nombre: r.nombre || `Rutina ${currentValidCount + i + 1}`,
          semanas: r.semanas || 4,
          orden: currentValidCount + i
        });
        const newRutina = rRes[0];
        if (newRutina && r.ejercicios?.length > 0) {
          const ejsData = r.ejercicios.map((e, eIdx) => ({
            rutina_id: newRutina.id,
            biblioteca_id: e.biblioteca_id || null,
            nombre: e.nombre,
            gif_url: e.gif_url || "",
            grupo_muscular: e.grupo_muscular || "",
            tipo_movimiento: e.tipo_movimiento || "",
            num_series: +e.num_series || 4,
            reps_sugeridas: +e.reps_sugeridas || 10,
            peso_sugerido: (e.peso_sugerido !== "" && e.peso_sugerido !== null && e.peso_sugerido !== undefined && !isNaN(e.peso_sugerido)) ? Number(e.peso_sugerido) : null,
            unidad: e.unidad || "kg",
            alternativas: (e.alternativas || []).map(alt => ({
              ...alt,
              peso_sugerido: (alt.peso_sugerido !== "" && alt.peso_sugerido !== null && alt.peso_sugerido !== undefined && !isNaN(alt.peso_sugerido)) ? Number(alt.peso_sugerido) : null
            })),
            orden: eIdx
          }));
          await dbPost("ejercicios", ejsData);
        }
      }

      setCicloSel(activeCiclo);
      if (selected?.id) sessionStorage.setItem(`flux_programar_ciclo_${selected.id}`, activeCiclo.id);
      await loadData(activeCiclo, { silent: true, forceFresh: true });
      notifyPlanUpdate("rutinas");
      if (!isMiPlan && selected?.auth_id) {
        dbPost("notificaciones", {
          profile_id: selected.auth_id,
          titulo: "Nuevo plan asignado",
          mensaje: `Tu especialista te ha asignado el plan "${tpl.nombre}".`,
          tipo: "plan",
          link_url: "nutricion",
          entidad_id: activeCiclo?.id || selected.id
        }, { headers: { Prefer: "return=minimal" } }).catch(() => {});
      }
      setMsg(
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-green-500" /> Plantilla "{tpl.nombre}" aplicada con éxito
        </div>
      );
    } catch (e) {
      setMsg(
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-red-500" /> Error aplicando plantilla: {e.message}
        </div>
      );
    }
    setSaving(false);
  };

  const interceptNoPlan = () => {
    if (!cicloSel) {
      setShowPlanModal(true);
      return true;
    }
    return false;
  };

  const isEstandarLimit = (listLength) => {
    if (isEstandar) {
      if (listLength >= 3) {
        setMsg(
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div>
              <strong>Límite de Plan Estándar.</strong>
              <div className="text-xs opacity-90 mt-0.5">Ve a tu Membresía para adquirir Premium y crear días ilimitados.</div>
            </div>
          </div>
        );
        return true;
      }
    }
    return false;
  };

  const openNewDia  = () => { 
    if (interceptNoPlan()) return; 
    if (isEstandarLimit(dias.length)) return;
    loadHistorial();
    setEditDia(null); 
    setDiaForm({ dia:"", diasSeleccionados:[], tituloPersonalizado:"", orden:dias.length, comidas:[{ _dndId: Math.random().toString(36).slice(2,9), hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"", foto_url:"" }] }); 
    setShowDiaModal(true); 
  };
  const openEditDia = (d) => { 
    const parts = (d.dia ||"").split('|');
    const dayTab = parts.length > 1 ? parts[0] : '';
    const title = parts.length > 1 ? parts[1] : parts[0];

    setEditDia(d); 
    setDiaForm({ 
      dia:d.dia, 
      diasSeleccionados: dayTab ? [dayTab] : [],
      tituloPersonalizado: title,
      orden:d.orden, 
      comidas:d.comidas.map(c=>({...c, _dndId: String(c.id || Math.random().toString(36).slice(2,9))})) 
    }); 
    setShowDiaModal(true); 
  };

  const saveDia = async () => {
    const formSnap = {
      ...diaForm,
      diasSeleccionados: [...(diaForm.diasSeleccionados || [])],
      comidas: (diaForm.comidas || []).map(c => ({ ...c })),
    };
    const editDiaSnap = editDia;
    const prevDias = dias;

    // 1. Actualización Optimista Instantánea en 0ms y cierre de modal inmediato
    if (editDiaSnap) {
      const dayCode = formSnap.diasSeleccionados?.length > 0 ? formSnap.diasSeleccionados[0] : "S/D";
      const finalName = formSnap.tituloPersonalizado ? `${dayCode}|${formSnap.tituloPersonalizado}` : `${dayCode}|`;
      const optimisticComidas = formSnap.comidas.map((c, i) => ({
        ...c,
        id: c.id || `temp_${Date.now()}_${i}`,
        dia_id: editDiaSnap.id,
        hora: c.hora || "",
        nombre: c.nombre || "",
        opcion1: c.opcion1 || "",
        opcion2: c.opcion2 || "",
        calorias: +c.calorias || null,
        proteina: +c.proteina || null,
        carbohidratos: +c.carbohidratos || null,
        grasas: +c.grasas || null,
        foto_url: c.foto_url || "",
        orden: i,
      }));
      const optimisticDia = {
        ...editDiaSnap,
        dia: finalName,
        orden: formSnap.orden,
        comidas: optimisticComidas,
      };
      setDias(prev => prev.map(d => d.id === editDiaSnap.id ? optimisticDia : d));
      updateQueryCache("nutricion_dias", (list) =>
        Array.isArray(list) ? list.map(d => d.id === editDiaSnap.id ? optimisticDia : d) : list
      );
    } else {
      const dSeleccionados = formSnap.diasSeleccionados || [];
      const creationDays = dSeleccionados.length > 0 ? dSeleccionados : ["S/D"];
      let orderCounter = formSnap.orden;
      const optimisticNewDias = creationDays.map((dayCode, idx) => {
        const finalName = formSnap.tituloPersonalizado ? `${dayCode}|${formSnap.tituloPersonalizado}` : `${dayCode}|`;
        const tempDiaId = `temp_dia_${Date.now()}_${idx}`;
        const dObj = {
          id: tempDiaId,
          nutricion_id: nutri?.id || "temp_nutri",
          dia: finalName,
          orden: orderCounter++,
          comidas: formSnap.comidas.map((c, i) => ({
            ...c,
            id: `temp_com_${Date.now()}_${idx}_${i}`,
            dia_id: tempDiaId,
            hora: c.hora || "",
            nombre: c.nombre || `Comida ${i + 1}`,
            opcion1: c.opcion1 || "",
            opcion2: c.opcion2 || "",
            calorias: +c.calorias || 0,
            proteina: +c.proteina || 0,
            carbohidratos: +c.carbohidratos || 0,
            grasas: +c.grasas || 0,
            foto_url: c.foto_url || "",
            orden: i,
          })),
        };
        return dObj;
      });
      setDias(prev => [...prev, ...optimisticNewDias]);
    }

    setShowDiaModal(false);
    setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Día guardado</div>);

    // 2. Persistencia asíncrona en segundo plano (sin bloquear la interfaz)
    try {
      // Esperar subidas de fotos de comidas que sigan en curso
      const resolvedComidas = await Promise.all(
        formSnap.comidas.map(async (c, idx) => {
          let finalFotoUrl = c.foto_url || "";
          if (pendingPhotoUploadsRef.current[idx]) {
            try {
              const uploadedUrl = await pendingPhotoUploadsRef.current[idx];
              if (uploadedUrl) finalFotoUrl = uploadedUrl;
            } catch {}
          }
          return { ...c, foto_url: finalFotoUrl.startsWith("blob:") ? "" : finalFotoUrl };
        })
      );

      let currentNutri = nutri;
      if (!currentNutri) {
        const payload = { cliente_id: selected.id, calorias: 0, proteina: 0, carbohidratos: 0, grasas: 0 };
        if (cicloSel) payload.ciclo_id = cicloSel.id;
        const res = await dbPost("nutricion", payload);
        currentNutri = res[0];
        setNutri(currentNutri);
      }

      if (editDiaSnap && !String(editDiaSnap.id).startsWith("temp_")) {
        const dayCode = formSnap.diasSeleccionados?.length > 0 ? formSnap.diasSeleccionados[0] : "S/D";
        const finalName = formSnap.tituloPersonalizado ? `${dayCode}|${formSnap.tituloPersonalizado}` : `${dayCode}|`;
        const diaId = editDiaSnap.id;

        const oldIds = (editDiaSnap.comidas || []).map(c => c.id).filter(id => id && !String(id).startsWith("temp_"));
        const newIds = resolvedComidas.filter(c => c.id && !String(c.id).startsWith("temp_")).map(c => c.id);
        const toDelete = oldIds.filter(id => !newIds.includes(id));

        const toUpdate = [];
        const toInsert = [];

        resolvedComidas.forEach((c, i) => {
          const data = {
            dia_id: diaId,
            hora: c.hora || "",
            nombre: c.nombre || "",
            opcion1: c.opcion1 || "",
            opcion2: c.opcion2 || "",
            calorias: +c.calorias || null,
            proteina: +c.proteina || null,
            carbohidratos: +c.carbohidratos || null,
            grasas: +c.grasas || null,
            foto_url: c.foto_url || "",
            orden: i,
          };
          if (c.id && !String(c.id).startsWith("temp_")) {
            data.id = c.id;
            toUpdate.push(data);
          } else {
            toInsert.push(data);
          }
        });

        const ops = [
          dbPatch(`nutricion_dias?id=eq.${diaId}`, { dia: finalName, orden: formSnap.orden }),
        ];
        if (toDelete.length > 0) {
          ops.push(dbDel(`comidas?id=in.(${toDelete.join(",")})`));
        }
        if (toUpdate.length > 0) {
          ops.push(
            dbUpsert("comidas?on_conflict=id", toUpdate, {
              headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            })
          );
        }
        if (toInsert.length > 0) {
          ops.push(
            dbPost("comidas", toInsert, {
              headers: { Prefer: "return=minimal" },
            })
          );
        }
        await Promise.all(ops);
      } else {
        const dSeleccionados = formSnap.diasSeleccionados || [];
        const creationDays = dSeleccionados.length > 0 ? dSeleccionados : ["S/D"];
        let orderCounter = formSnap.orden;

        const diasData = creationDays.map(dayCode => {
          const finalName = formSnap.tituloPersonalizado ? `${dayCode}|${formSnap.tituloPersonalizado}` : `${dayCode}|`;
          const d = { nutricion_id: currentNutri.id, dia: finalName, orden: orderCounter };
          orderCounter++;
          return d;
        });

        const creados = await dbPost("nutricion_dias", diasData);

        const comidasData = [];
        (creados || []).forEach(nuevoDia => {
          resolvedComidas.forEach((c, i) => {
            comidasData.push({
              dia_id: nuevoDia.id,
              hora: c.hora || "",
              nombre: c.nombre || `Comida ${i + 1}`,
              opcion1: c.opcion1 || "",
              opcion2: c.opcion2 || "",
              calorias: +c.calorias || 0,
              proteina: +c.proteina || 0,
              carbohidratos: +c.carbohidratos || 0,
              grasas: +c.grasas || 0,
              foto_url: c.foto_url || "",
              orden: i,
            });
          });
        });

        if (comidasData.length > 0) {
          await dbPost("comidas", comidasData, {
            headers: { Prefer: "return=minimal" },
          });
        }
      }

      loadData(cicloSel, { silent: true, forceFresh: true });
      notifyPlanUpdate("nutricion_dias");

      if (!isMiPlan && selected?.auth_id) {
        const throttleKey = `flux_notif_nutri_${selected.id}`;
        const lastSent = Number(sessionStorage.getItem(throttleKey) || 0);
        if (Date.now() - lastSent > 120000) {
          sessionStorage.setItem(throttleKey, String(Date.now()));
          dbPost("notificaciones", {
            profile_id: selected.auth_id,
            titulo: "Plan de Nutrición actualizado",
            mensaje: "Tu nutriólogo ha actualizado tu plan de alimentación.",
            tipo: "plan",
            link_url: "nutricion",
            entidad_id: currentNutri?.id || selected.id
          }, { headers: { Prefer: "return=minimal" } }).catch(() => {});
        }
      }
    } catch (e) {
      if (!isOfflineError(e)) {
        setDias(prevDias);
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
      }
    }
  };

  const deleteDia = (d) => {
    const diaTitulo = (d.dia || "").split('|').filter(Boolean).join(' - ') || "este día";
    setConfirmDelete({
      title: `¿Eliminar "${diaTitulo}"?`,
      description: "Esta acción eliminará el día y todas sus comidas asociadas permanentemente.",
      confirmText: "Eliminar día",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        const prevDias = dias;
        // Eliminación optimista en 0ms
        setConfirmDelete(null);
        setDias(prev => prev.filter(x => x.id !== d.id));
        updateQueryCache("nutricion_dias", (list) =>
          Array.isArray(list) ? list.filter(x => x.id !== d.id) : list
        );
        setMsg(<div className="flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> Día eliminado</div>);
        notifyPlanUpdate("nutricion_dias");
        if (String(d.id).startsWith("temp_")) return;
        try {
          await dbDel(`nutricion_dias?id=eq.${d.id}`);
        } catch(err) {
          if (!isOfflineError(err)) {
            setDias(prevDias);
            setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { err.message }</div>);
          }
        }
      }
    });
  };
  const addComida  = () => setDiaForm(p => ({ ...p, comidas:[...p.comidas, { _dndId: Math.random().toString(36).slice(2,9), hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"", foto_url:"" }] }));
  const updComida  = (i,f,v) => setDiaForm(p => { const cs=[...p.comidas]; if (cs[i]) cs[i]={...cs[i],[f]:v}; return { ...p, comidas:cs }; });
  const remComida  = (i) => setDiaForm(p => ({ ...p, comidas:p.comidas.filter((_,x)=>x!==i) }));
  
  // Abre el modal de recorte en lugar de subir directo
  const handleFileSelect = (i, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCropModal({ objectUrl, mealIndex: i });
    setCrop(undefined);
    setCompletedCrop(null);
    // Reset el input para que se pueda volver a seleccionar el mismo archivo
    e.target.value ="";
  };

  // Cuando la imagen carga en el cropper, centrar el recorte cuadrado automáticamente e inicializar completedCrop en px
  const onCropImageLoad = (e) => {
    const { width, height, naturalWidth, naturalHeight } = e.currentTarget;
    const centeredCrop = centerCrop(
      makeAspectCrop({ unit:"%", width: 80 }, 1, naturalWidth, naturalHeight),
      naturalWidth,
      naturalHeight
    );
    setCrop(centeredCrop);
    if (width && height) {
      setCompletedCrop({
        unit: "px",
        x: (centeredCrop.x / 100) * width,
        y: (centeredCrop.y / 100) * height,
        width: (centeredCrop.width / 100) * width,
        height: (centeredCrop.height / 100) * height,
      });
    } else {
      setCompletedCrop(centeredCrop);
    }
  };

  // Confirmar recorte: canvas → blob → preview instantáneo en 0ms + upload en segundo plano
  const confirmCrop = async () => {
    const activeCrop = completedCrop || crop;
    if (!imgCropRef.current || !activeCrop) return;
    const img = imgCropRef.current;
    const canvas = document.createElement("canvas");
    const OUTPUT = 500;
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");

    let sx, sy, sWidth, sHeight;
    if (activeCrop.unit === "%") {
      sx = (activeCrop.x / 100) * img.naturalWidth;
      sy = (activeCrop.y / 100) * img.naturalHeight;
      sWidth = (activeCrop.width / 100) * img.naturalWidth;
      sHeight = (activeCrop.height / 100) * img.naturalHeight;
    } else {
      const scaleX = img.naturalWidth / (img.width || img.naturalWidth);
      const scaleY = img.naturalHeight / (img.height || img.naturalHeight);
      sx = activeCrop.x * scaleX;
      sy = activeCrop.y * scaleY;
      sWidth = activeCrop.width * scaleX;
      sHeight = activeCrop.height * scaleY;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, OUTPUT, OUTPUT);
    const idx = cropModal.mealIndex;
    const objectUrl = cropModal.objectUrl;
    setCropModal(null);

    try {
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
      try { URL.revokeObjectURL(objectUrl); } catch {}
      if (!blob) return;

      // Mostrar miniatura de inmediato en 0ms
      const localPreviewUrl = URL.createObjectURL(blob);
      updComida(idx, "foto_url", localPreviewUrl);

      const path = `comida_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const uploadPromise = storageUpload("comidas", path, blob)
        .then((remoteUrl) => {
          updComida(idx, "foto_url", remoteUrl);
          try { URL.revokeObjectURL(localPreviewUrl); } catch {}
          delete pendingPhotoUploadsRef.current[idx];
          setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Foto subida</div>);
          return remoteUrl;
        })
        .catch((err) => {
          delete pendingPhotoUploadsRef.current[idx];
          setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {err.message}</div>);
          throw err;
        });

      pendingPhotoUploadsRef.current[idx] = uploadPromise;
    } catch (err) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {err.message}</div>);
    }
  };

  // ── Operaciones de Rutinas ──
  const openNewRutina  = () => { 
    if (interceptNoPlan()) return; 
    if (isEstandarLimit(rutinas.length)) return;
    loadHistorial();
    setEditRutina(null); 
    setRutinaForm({ diasSeleccionados:[], tituloPersonalizado:"", ejercicios:[] }); 
    setShowRutinaModal(true); 
  };
  const openEditRutina = (r) => { 
    const parts = (r.nombre ||"").split('|');
    let dSel = [];
    let tPers = r.nombre ||"";
    if (parts.length > 1) {
      dSel = [parts[0].trim()];
      tPers = parts.slice(1).join('|').trim();
    } else if (["LUN","MAR","MIE","JUE","VIE","SAB","DOM"].includes(r.nombre?.trim())) {
      dSel = [r.nombre.trim()];
      tPers ="";
    }
    setEditRutina(r); 
    setRutinaForm({ 
      diasSeleccionados: dSel,
      tituloPersonalizado: tPers,
      ejercicios: r.ejercicios.map(e => {
        // La BD siempre guarda en kg. Si la unidad es lb, reconvertimos para que el input muestre el valor correcto.
        let pesoDisplay = e.peso_sugerido;
        if ((e.unidad || 'kg') === 'lb' && pesoDisplay && !isNaN(pesoDisplay)) {
          const lb = parseFloat(pesoDisplay) * 2.20462262;
          pesoDisplay = Number(lb.toFixed(1)).toString();
        }
        return { ...e, peso_sugerido: pesoDisplay, _dndId: String(e.id || Math.random().toString(36).slice(2,9)) };
      })
    }); 
    setShowRutinaModal(true); 
  };

  const saveRutina = async () => {
    const toKg = (val, unit) => {
      if (!val && val !== 0) return null;
      const n = parseFloat(val);
      if (isNaN(n)) return null;
      return unit === 'lb' ? parseFloat((n * 0.45359237).toFixed(4)) : n;
    };

    const formSnap = {
      ...rutinaForm,
      diasSeleccionados: [...(rutinaForm.diasSeleccionados || [])],
      ejercicios: (rutinaForm.ejercicios || []).map(e => ({
        ...e,
        alternativas: (e.alternativas || []).map(a => ({ ...a })),
      })),
    };
    const editRutinaSnap = editRutina;
    const prevRutinas = rutinas;
    const activeCiclo = cicloSel;
    const dSeleccionados = formSnap.diasSeleccionados || [];

    // 1. Actualización Optimista Instantánea en 0ms y cierre de modal inmediato
    if (editRutinaSnap) {
      const finalName = dSeleccionados.length > 0 ? `${dSeleccionados[0]}|${formSnap.tituloPersonalizado}` : formSnap.tituloPersonalizado;
      const optimisticEjercicios = formSnap.ejercicios.map((e, i) => ({
        ...e,
        id: e.id || `temp_ej_${Date.now()}_${i}`,
        rutina_id: editRutinaSnap.id,
        biblioteca_id: e.biblioteca_id || null,
        nombre: e.nombre,
        gif_url: e.gif_url || "",
        grupo_muscular: e.grupo_muscular || "",
        tipo_movimiento: e.tipo_movimiento || "",
        num_series: +e.num_series || 4,
        reps_sugeridas: +e.reps_sugeridas || 10,
        peso_sugerido: toKg(e.peso_sugerido, e.unidad || "kg"),
        unidad: e.unidad || "kg",
        alternativas: (e.alternativas || []).map(alt => ({
          ...alt,
          peso_sugerido: toKg(alt.peso_sugerido, alt.unidad || e.unidad || "kg"),
        })),
        orden: i,
      }));
      const optimisticRutina = {
        ...editRutinaSnap,
        nombre: finalName,
        ejercicios: optimisticEjercicios,
      };
      setRutinas(prev => prev.map(r => r.id === editRutinaSnap.id ? optimisticRutina : r));
      updateQueryCache("rutinas", (list) =>
        Array.isArray(list) ? list.map(r => r.id === editRutinaSnap.id ? optimisticRutina : r) : list
      );
    } else {
      const diasToCreate = dSeleccionados.length > 0 ? dSeleccionados : ["S/D"];
      const optimisticNewRutinas = diasToCreate.map((d, idx) => {
        const finalName = d === "S/D" ? formSnap.tituloPersonalizado : `${d}|${formSnap.tituloPersonalizado}`;
        const tempRutId = `temp_rut_${Date.now()}_${idx}`;
        return {
          id: tempRutId,
          cliente_id: selected.id,
          ciclo_id: activeCiclo?.id || null,
          nombre: finalName,
          semanas: activeCiclo ? getCycleWeeks(activeCiclo) : (+formSnap.semanas || 4),
          fecha_inicio: formSnap.fecha_inicio || null,
          orden: prevRutinas.length + idx,
          ejercicios: formSnap.ejercicios.map((e, i) => ({
            ...e,
            id: `temp_ej_${Date.now()}_${idx}_${i}`,
            rutina_id: tempRutId,
            biblioteca_id: e.biblioteca_id || null,
            nombre: e.nombre,
            gif_url: e.gif_url || "",
            grupo_muscular: e.grupo_muscular || "",
            tipo_movimiento: e.tipo_movimiento || "",
            num_series: +e.num_series || 4,
            reps_sugeridas: +e.reps_sugeridas || 10,
            peso_sugerido: toKg(e.peso_sugerido, e.unidad || "kg"),
            unidad: e.unidad || "kg",
            alternativas: (e.alternativas || []).map(alt => ({
              ...alt,
              peso_sugerido: toKg(alt.peso_sugerido, alt.unidad || e.unidad || "kg"),
            })),
            orden: i,
          })),
        };
      });
      setRutinas(prev => [...prev, ...optimisticNewRutinas]);
    }

    setShowRutinaModal(false);
    setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Rutina guardada</div>);

    // 2. Persistencia en segundo plano (con peticiones en paralelo)
    try {
      if (editRutinaSnap && !String(editRutinaSnap.id).startsWith("temp_")) {
        const finalName = dSeleccionados.length > 0 ? `${dSeleccionados[0]}|${formSnap.tituloPersonalizado}` : formSnap.tituloPersonalizado;
        const rid = editRutinaSnap.id;

        const oldIds = (editRutinaSnap.ejercicios || []).map(e => e.id).filter(id => id && !String(id).startsWith("temp_"));
        const newIds = formSnap.ejercicios.filter(e => e.id && !String(e.id).startsWith("temp_")).map(e => e.id);
        const toDelete = oldIds.filter(id => !newIds.includes(id));

        const toUpdate = [];
        const toInsert = [];

        formSnap.ejercicios.forEach((e, i) => {
          const data = {
            rutina_id: rid,
            biblioteca_id: e.biblioteca_id || null,
            nombre: e.nombre,
            gif_url: e.gif_url || "",
            grupo_muscular: e.grupo_muscular || "",
            tipo_movimiento: e.tipo_movimiento || "",
            num_series: +e.num_series || 4,
            reps_sugeridas: +e.reps_sugeridas || 10,
            peso_sugerido: toKg(e.peso_sugerido, e.unidad || "kg"),
            unidad: e.unidad || "kg",
            alternativas: (e.alternativas || []).map(alt => ({
              ...alt,
              peso_sugerido: toKg(alt.peso_sugerido, alt.unidad || e.unidad || "kg"),
            })),
            orden: i,
          };
          if (e.id && !String(e.id).startsWith("temp_")) {
            data.id = e.id;
            toUpdate.push(data);
          } else {
            toInsert.push(data);
          }
        });

        const ops = [
          dbPatch(`rutinas?id=eq.${rid}`, { nombre: finalName }),
        ];
        if (toDelete.length > 0) {
          ops.push(dbDel(`ejercicios?id=in.(${toDelete.join(",")})`));
        }
        if (toUpdate.length > 0) {
          ops.push(
            dbUpsert("ejercicios?on_conflict=id", toUpdate, {
              headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            })
          );
        }
        if (toInsert.length > 0) {
          ops.push(
            dbPost("ejercicios", toInsert, {
              headers: { Prefer: "return=minimal" },
            })
          );
        }
        await Promise.all(ops);
      } else {
        const diasToCreate = dSeleccionados.length > 0 ? dSeleccionados : ["S/D"];
        const rutinasData = diasToCreate.map((d, idx) => {
          const finalName = d === "S/D" ? formSnap.tituloPersonalizado : `${d}|${formSnap.tituloPersonalizado}`;
          return {
            cliente_id: selected.id,
            ciclo_id: activeCiclo?.id || null,
            nombre: finalName,
            semanas: activeCiclo ? getCycleWeeks(activeCiclo) : (+formSnap.semanas || 4),
            fecha_inicio: formSnap.fecha_inicio || null,
            orden: prevRutinas.length + idx,
          };
        });

        const creadas = await dbPost("rutinas", rutinasData);

        const ejerciciosData = [];
        (creadas || []).forEach(nuevaRutina => {
          formSnap.ejercicios.forEach((e, i) => {
            ejerciciosData.push({
              rutina_id: nuevaRutina.id,
              biblioteca_id: e.biblioteca_id || null,
              nombre: e.nombre,
              gif_url: e.gif_url || "",
              grupo_muscular: e.grupo_muscular || "",
              tipo_movimiento: e.tipo_movimiento || "",
              num_series: +e.num_series || 4,
              reps_sugeridas: +e.reps_sugeridas || 10,
              peso_sugerido: toKg(e.peso_sugerido, e.unidad || "kg"),
              unidad: e.unidad || "kg",
              alternativas: (e.alternativas || []).map(alt => ({
                ...alt,
                peso_sugerido: toKg(alt.peso_sugerido, alt.unidad || e.unidad || "kg"),
              })),
              orden: i,
            });
          });
        });

        if (ejerciciosData.length > 0) {
          await dbPost("ejercicios", ejerciciosData, {
            headers: { Prefer: "return=minimal" },
          });
        }
      }

      loadData(activeCiclo, { silent: true, forceFresh: true });
      notifyPlanUpdate("rutinas");

      if (!isMiPlan && selected?.auth_id) {
        const throttleKey = `flux_notif_rutina_${selected.id}`;
        const lastSent = Number(sessionStorage.getItem(throttleKey) || 0);
        if (Date.now() - lastSent > 120000) {
          sessionStorage.setItem(throttleKey, String(Date.now()));
          dbPost("notificaciones", {
            profile_id: selected.auth_id,
            titulo: "Rutina de Entrenamiento actualizada",
            mensaje: "Tu especialista ha actualizado tu rutina de entrenamiento.",
            tipo: "plan",
            link_url: "deporte",
            entidad_id: activeCiclo?.id || selected.id
          }, { headers: { Prefer: "return=minimal" } }).catch(() => {});
        }
      }
    } catch (e) {
      if (!isOfflineError(e)) {
        setRutinas(prevRutinas);
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
      }
    }
  };

  const deleteRutina = (r) => {
    const rutinaTitulo = (r.nombre || "").split('|').filter(Boolean).join(' - ') || "esta rutina";
    setConfirmDelete({
      title: `¿Eliminar "${rutinaTitulo}"?`,
      description: "Esta acción eliminará la rutina y todos sus ejercicios permanentemente.",
      confirmText: "Eliminar rutina",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        const prevRutinas = rutinas;
        // Eliminación optimista en 0ms
        setConfirmDelete(null);
        setRutinas(prev => prev.filter(x => x.id !== r.id));
        updateQueryCache("rutinas", (list) =>
          Array.isArray(list) ? list.filter(x => x.id !== r.id) : list
        );
        setMsg(<div className="flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> Rutina eliminada</div>);
        notifyPlanUpdate("rutinas");
        if (String(r.id).startsWith("temp_")) return;
        try {
          await dbDel(`rutinas?id=eq.${r.id}`);
        } catch(err) {
          if (!isOfflineError(err)) {
            setRutinas(prevRutinas);
            setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { err.message }</div>);
          }
        }
      }
    });
  };
  const addEj = (ej) => {
    if (activeAltSlot === null) {
      if (rutinaForm.ejercicios.find(e=>e.biblioteca_id===ej.id)) return;
      setRutinaForm(p => ({ ...p, ejercicios:[...p.ejercicios, { 
        _dndId: Math.random().toString(36).slice(2,9), 
        biblioteca_id:ej.id, nombre:ej.nombre, grupo_muscular:ej.grupo_muscular, tipo_movimiento:ej.tipo_movimiento, 
        gif_url:ej.gif_url||"", num_series:4, reps_sugeridas:10, peso_sugerido:"", unidad:"kg", alternativas:[] 
      }] }));
    } else {
      setRutinaForm(p => {
        const es = [...p.ejercicios];
        const main = es[activeAltSlot];
        if ((main.alternativas || []).length >= 2) return p;
        if ((main.alternativas || []).find(a => a.biblioteca_id === ej.id)) return p;
        const newAlt = {
          biblioteca_id: ej.id, nombre: ej.nombre, gif_url: ej.gif_url||"",
          reps_sugeridas: main.reps_sugeridas || 10, peso_sugerido: main.peso_sugerido ||"", unidad: main.unidad ||"kg"
        };
        es[activeAltSlot] = { ...main, alternativas: [...(main.alternativas || []), newAlt] };
        return { ...p, ejercicios: es };
      });
      setActiveAltSlot(null);
    }
  };

  const updEj = (i, f, v) => setRutinaForm(p => { const es=[...p.ejercicios]; es[i]={...es[i],[f]:v}; return { ...p, ejercicios:es }; });
  const remEj = (i) => setRutinaForm(p => ({ ...p, ejercicios:p.ejercicios.filter((_,x)=>x!==i) }));
  
  const toggleUnidad = (i) => setRutinaForm(p => { const es=[...p.ejercicios]; es[i]={...es[i], unidad: es[i].unidad ==="lb" ?"kg" :"lb"}; return { ...p, ejercicios:es }; });
  const toggleUnidadAlt = (i, altIdx) => setRutinaForm(p => { const es=[...p.ejercicios]; const alts=[...es[i].alternativas]; alts[altIdx]={...alts[altIdx], unidad: alts[altIdx].unidad ==="lb" ?"kg" :"lb"}; es[i]={...es[i], alternativas: alts}; return { ...p, ejercicios:es }; });
  const updAlt = (i, altIdx, f, v) => setRutinaForm(p => { const es=[...p.ejercicios]; const alts=[...es[i].alternativas]; alts[altIdx]={...alts[altIdx], [f]:v}; es[i]={...es[i], alternativas: alts}; return { ...p, ejercicios:es }; });
  const remAlt = (i, altIdx) => setRutinaForm(p => { const es=[...p.ejercicios]; es[i]={...es[i], alternativas: es[i].alternativas.filter((_,x)=>x!==altIdx)}; return { ...p, ejercicios:es }; });

  // ── Handlers de Drag & Drop ──
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndDias = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDias((items) => {
        const oldIndex = items.findIndex(d => String(d.id) === active.id);
        const newIndex = items.findIndex(d => String(d.id) === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Patch in background
        newItems.forEach((d, idx) => {
          if (d.orden !== idx) {
            dbPatch(`nutricion_dias?id=eq.${d.id}`, { orden: idx }).catch(e=>console.error(e));
            d.orden = idx;
          }
        });
        notifyPlanUpdate("nutricion_dias");
        return newItems;
      });
    }
  };

  const handleDragEndComidas = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDiaForm((p) => {
        const oldIndex = p.comidas.findIndex(c => String(c._dndId) === active.id);
        const newIndex = p.comidas.findIndex(c => String(c._dndId) === over.id);
        return { ...p, comidas: arrayMove(p.comidas, oldIndex, newIndex) };
      });
    }
  };

  const handleDragEndRutinas = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRutinas((items) => {
        const oldIndex = items.findIndex(r => String(r.id) === active.id);
        const newIndex = items.findIndex(r => String(r.id) === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Patch in background
        newItems.forEach((r, idx) => {
          if (r.orden !== idx) {
            dbPatch(`rutinas?id=eq.${r.id}`, { orden: idx }).catch(e=>console.error(e));
            r.orden = idx;
          }
        });
        notifyPlanUpdate("rutinas");
        return newItems;
      });
    }
  };

  const handleDragEndEjercicios = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRutinaForm((p) => {
        const oldIndex = p.ejercicios.findIndex(e => String(e._dndId) === active.id);
        const newIndex = p.ejercicios.findIndex(e => String(e._dndId) === over.id);
        return { ...p, ejercicios: arrayMove(p.ejercicios, oldIndex, newIndex) };
      });
    }
  };

  const fmtFecha = (f) => f ? new Date(f+"T12:00:00").toLocaleDateString("es-MX",{month:"short",year:"numeric"}) :"";

  // ── Sin cliente seleccionado ──
  if (!selected) {
    const filteredClientes = (clientes || []).filter(c =>
      c.objetivo !== 'Mi entrenamiento personal' &&
      ((c.nombre || "").toLowerCase().includes(searchProg.toLowerCase()) ||
       (c.email || "").toLowerCase().includes(searchProg.toLowerCase()))
    );
    return (
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm max-w-2xl">
        <h3 className="text-base font-bold text-[#0B1929] mb-1">Selecciona un paciente para programar</h3>
        <p className="text-xs text-[#6B7A8D] mb-4">Elige a quién deseas asignarle o editarle su plan de alimentación, rutina o evaluación corporal.</p>
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-[#6B7A8D] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchProg}
            onChange={e => setSearchProg(e.target.value)}
            placeholder="Buscar paciente por nombre o correo..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
          />
        </div>
        {filteredClientes.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#6B7A8D]">No se encontraron pacientes.</div>
        ) : (
          <div className="flex flex-col divide-y divide-[#F0F4FA] max-h-80 overflow-y-auto">
            {filteredClientes.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="flex items-center justify-between py-3 px-3 hover:bg-[#F8FAFC] rounded-xl transition-colors text-left"
              >
                <div>
                  <div className="font-bold text-sm text-[#0B1929]">{c.nombre}</div>
                  <div className="text-xs text-[#6B7A8D]">{c.email}</div>
                </div>
                <span className="text-xs font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-3 py-1 rounded-lg">
                  Seleccionar
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col pb-6">
      {/* ── Cabecera cliente ── */}
      
        {/* Cabecera Civil Premium / Mi Plan */}
        {isMiPlan && onModoAtleta && (
          <div className="flex justify-end mb-4">
              <button 
                onClick={onModoAtleta}
                className="bg-[var(--brand-primary)] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:opacity-90 flex items-center gap-2 transition-all"
              >
              <Dumbbell size={18} /> Entrenar (Modo Atleta)
            </button>
          </div>
        )}
        
        {!isMiPlan && (
        <div className="flex items-stretch mb-5 w-max group">
          <div className="bg-[#0B1929]/5 border border-[#0B1929]/20 rounded-l-xl px-4 py-2 flex flex-col justify-center">
            <span className="font-bold text-[var(--brand-primary)] leading-tight">{selected.nombre}</span>
            <span className="text-xs text-[#6B7A8D] leading-tight mt-0.5">{selected.email}</span>
          </div>
          <button 
            title="Cambiar paciente"
            className="px-3 bg-[#0B1929]/5 border border-l-0 border-[#0B1929]/20 rounded-r-xl text-[#6B7A8D] hover:bg-[#0B1929]/10 hover:text-[var(--brand-primary)] transition-colors flex items-center justify-center" 
            onClick={() => setSelected(null)}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Selector de Ciclos ── */}
      <div className="mb-5 bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[13px] font-bold text-[#0B1929] uppercase tracking-[0.8px]">{isMiPlan ? "Mis Planes" : "Planes del Paciente"}</span>
          <div className="flex items-center gap-2">
            {ciclos.filter(c => !c.activo).length > 0 && (
              <button
                onClick={() => setShowPastCycles(p => !p)}
                className="flex items-center justify-center p-2 sm:px-3 sm:py-1.5 border border-[#E2E8F0] rounded-lg text-[#6B7A8D] hover:bg-gray-50 transition-colors"
                title="Ver planes anteriores"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showPastCycles ?"rotate-180" :""}`} />
              </button>
            )}
            <button className="text-xs flex items-center justify-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors font-medium" onClick={() => setShowPlanModal(true)}>
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{ciclos.length === 0 ?"Crear Primer Plan" :"Siguiente Plan"}</span>
            </button>
          </div>
        </div>

        {ciclos.length === 0 ? (
          <div className="text-center py-6 text-[#6B7A8D] text-[13px] border-2 border-dashed border-[#E2E8F0] rounded-xl bg-gray-50/50 mb-3">
            Aún no hay planes configurados. <button onClick={() => setShowPlanModal(true)} className="text-[var(--brand-primary)] font-semibold hover:underline">Haz clic aquí para crear tu primer plan.</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
            {/* Ciclos Activos */}
            {ciclos.filter(c => c.activo).map(c => (
              <div key={c.id} className="flex items-stretch flex-shrink-0 group">
                <button 
                  onClick={() => { setCicloSel(c); setShowPastCycles(false); }}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[13px] transition-colors border ${
                    cicloSel?.id === c.id 
                      ?"bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] font-bold" 
                      :"bg-[#0B1929]/5 border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-[#0B1929]/10 font-medium" 
                  } ${cicloSel?.id === c.id ?"rounded-l-xl border-r-0" :"rounded-xl"}`}
                >
                  {c.nombre.split("|")[0]}
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${cicloSel?.id===c.id ?"bg-white" :"bg-green-400"}`}/>
                </button>
                {cicloSel?.id === c.id && (
                  <button
                    onClick={(e) => eliminarCiclo(c, e)}
                    title="Eliminar este plan"
                    className="flex items-center justify-center px-3 bg-[var(--brand-primary)] text-white/80 hover:text-white border-y border-r border-[var(--brand-primary)] rounded-r-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Ciclos Pasados (Acordeón) */}
            {ciclos.filter(c => !c.activo).length > 0 && (
              <>

                {showPastCycles && isEstandar ? (
                  <div className="flex items-center px-4 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-gray-50/50 relative overflow-hidden group min-w-[200px] cursor-not-allowed">
                    <div className="absolute inset-0 backdrop-blur-[2px] bg-white/40 z-10 flex flex-col items-center justify-center p-2 text-center">
                      <span className="font-bold text-[#0B1929] text-xs">Historial Bloqueado</span>
                      <span className="text-[10px] text-[#6B7A8D] leading-tight">Adquiere Premium</span>
                    </div>
                    {/* Falsos botones de fondo */}
                    <div className="opacity-30 blur-[1px] flex gap-2">
                      <div className="w-20 h-4 bg-gray-300 rounded"></div>
                      <div className="w-16 h-4 bg-gray-300 rounded"></div>
                    </div>
                  </div>
                ) : showPastCycles && !isEstandar ? (
                  ciclos.filter(c => !c.activo).map(c => (
                    <div key={c.id} className="flex items-stretch flex-shrink-0 group animate-in fade-in slide-in-from-left-2">
                      <button 
                        onClick={() => setCicloSel(c)}
                        className={`flex items-center px-4 py-2 text-[13px] transition-colors border ${
                          cicloSel?.id === c.id 
                            ?"bg-[#6B7A8D] text-white border-[#6B7A8D] font-bold" 
                            :"bg-transparent text-[#6B7A8D] border-[#E2E8F0] font-medium hover:bg-gray-50"
                        } ${cicloSel?.id === c.id ?"rounded-l-xl border-r-0" :"rounded-xl"}`}
                      >
                        {c.nombre.split("|")[0]}
                      </button>
                      {cicloSel?.id === c.id && (
                        <button
                          onClick={(e) => eliminarCiclo(c, e)}
                          title="Eliminar este plan"
                          className="flex items-center justify-center px-3 bg-[#6B7A8D] text-white/80 hover:text-white border-y border-r border-[#6B7A8D] rounded-r-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                ) : null}
              </>
            )}
          </div>
          {cicloSel && !cicloSel.activo && (
            <div className="mt-3 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg flex items-center gap-2">
              <Lock className="w-[14px] h-[14px]" /> Estás viendo el historial de <strong className="text-[#0B1929]">{cicloSel.nombre.split("|")[0]}</strong>. Solo lectura — el plan activo es el resaltado.
            </div>
          )}
          </>
        )}
      </div>

      {/* ── 🔴 Sub-tabs 🔴 ── */}
      <div className="flex gap-1 mb-4 bg-[#F0F4FA] rounded-xl p-1 w-full sm:w-max overflow-x-auto scroll-hide">
        {[
          { k:"nutri", ic: <Utensils className="w-4 h-4 shrink-0"/>, lb:"Nutrición" },
          { k:"deporte", ic: <Dumbbell className="w-4 h-4 shrink-0"/>, lb:"Rutinas" },
          { k:"progreso", ic: <BarChart2 className="w-4 h-4 shrink-0"/>, lb:"Progreso" }
        ].map(({ k, ic, lb }) => (
          <button 
            key={k} 
            onClick={() => setSubtab(k)} 
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-[13px] whitespace-nowrap transition-all flex-1 sm:flex-none shrink-0 ${
              subtab === k 
                ?"bg-white shadow-sm text-[var(--brand-primary)] font-bold border border-transparent" 
                :"text-[#6B7A8D] hover:text-[#0B1929] border border-transparent"
            }`}
          >
            {ic} {lb}
          </button>
        ))}
      </div>

      {loading ? <ListSkeleton rows={4} /> : <>

        {/* ── NUTRICIÓN ── */}
        {subtab ==="nutri" && (
          <div>
            {Number(macros.calorias) > 0 && (
              <div
                onClick={() => !isReadOnly && setShowMacroCalc(true)}
                className={`mb-3 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs ${!isReadOnly ? "cursor-pointer hover:border-[var(--brand-primary)]/40 transition-colors" : ""}`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B1929]">
                  <Calculator className="w-4 h-4 text-[var(--brand-primary)]" />
                  <span>Meta diaria prescrita</span>
                </div>
                <div className="flex items-center flex-wrap gap-3 text-xs">
                  <span className="font-extrabold text-[var(--brand-primary)]">{macros.calorias} kcal</span>
                  {Number(macros.proteina) > 0 && <span className="text-[#0B1929] font-semibold">{macros.proteina}g P</span>}
                  {Number(macros.carbohidratos) > 0 && <span className="text-[#0B1929] font-semibold">{macros.carbohidratos}g C</span>}
                  {Number(macros.grasas) > 0 && <span className="text-[#0B1929] font-semibold">{macros.grasas}g G</span>}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center gap-2 mb-2.5">
              <span className="font-semibold">Días del plan <span className="text-[#6B7A8D] font-normal">({dias.length})</span></span>
              <div className="flex items-center flex-wrap gap-2">
                {!isReadOnly && (
                  <button
                    onClick={() => setShowMacroCalc(true)}
                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#0B1929] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                    <span>Calcular Macros</span>
                  </button>
                )}
                {dias.length > 0 && (
                  <button
                    onClick={() => generateNutriPDF(selected, nutri, dias, brand)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#0B1929] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] text-xs font-semibold shadow-sm transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Descargar PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                )}
                {!isReadOnly && (
                  <button
                    onClick={() => setTemplateModal("nutri")}
                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#0B1929] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] font-semibold shadow-sm transition-colors cursor-pointer"
                    title="Biblioteca de Plantillas de Nutrición"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                    <span>Plantillas</span>
                  </button>
                )}
                {!isReadOnly && <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity" onClick={openNewDia}><Plus className="w-3.5 h-3.5" /> Día</button>}
              </div>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndDias}>
              <SortableContext items={dias.map(d => String(d.id))} strategy={verticalListSortingStrategy}>
                {dias.map(d => {
                  const parts = (d.dia ||"").split('|');
                  const tab = parts.length > 1 ? parts[0] : 'S/D';
                  const title = parts.length > 1 ? parts.slice(1).join('|') : parts[0];
                  return (
                      <SortableItem key={d.id} id={d.id}>
                        {({ dragHandle, isDragging }) => (
                          <div className="bg-white rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 mb-2 flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {!isReadOnly && <div className="shrink-0">{dragHandle}</div>}
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center flex-wrap gap-1.5 leading-tight">
                                  {tab !== 'S/D' && (
                                    <span className="font-semibold px-2 py-0.5 bg-[var(--brand-primary)] text-white text-[10px] rounded shrink-0 uppercase">{tab}</span>
                                  )}
                                  <span className="font-semibold text-[14px] text-[#0B1929] break-words line-clamp-2">{title ||"Sin título"}</span>
                                </div>
                                <div className="text-xs text-[#6B7A8D] mt-0.5 shrink-0 flex items-center flex-wrap gap-2">
                                  <span className="font-medium">{d.comidas.length} comidas</span>
                                  <span className="opacity-70">&middot;</span>
                                  <span>{d.comidas.reduce((s,c) => s + (Number(c.calorias)||0), 0)} kcal</span>
                                  <span>{d.comidas.reduce((s,c) => s + (Number(c.proteina)||0), 0)}g P</span>
                                  <span>{d.comidas.reduce((s,c) => s + (Number(c.carbohidratos)||0), 0)}g C</span>
                                  <span>{d.comidas.reduce((s,c) => s + (Number(c.grasas)||0), 0)}g G</span>
                                </div>
                              </div>
                            </div>
                            {!isReadOnly && (
                              <div className="flex gap-1.5 shrink-0">
                                <button className="flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-blue-50 transition-colors" onClick={() => openEditDia(d)}>
                                  <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline text-xs font-medium">Editar</span>
                                </button>
                                <button className="flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" onClick={() => deleteDia(d)}>
                                  <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline text-xs font-medium">Borrar</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </SortableItem>
                  )})}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* ── RUTINAS ── */}
        {subtab ==="deporte" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold">Rutinas <span className="text-[#6B7A8D] font-normal">({rutinas.length})</span></span>
              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={() => setTemplateModal("rutina")}
                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#0B1929] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] font-semibold shadow-sm transition-colors cursor-pointer"
                    title="Biblioteca de Plantillas de Rutinas"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                    <span>Plantillas</span>
                  </button>
                )}
                {!isReadOnly && <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity" onClick={openNewRutina}><Plus className="w-3.5 h-3.5" /> Rutina</button>}
              </div>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndRutinas}>
              <SortableContext items={rutinas.map(r => String(r.id))} strategy={verticalListSortingStrategy}>
                {rutinas.map(r => {
                  const parts = (r.nombre ||"").split('|');
                  const tab = parts.length > 1 ? parts[0] : 'S/D';
                  const title = parts.length > 1 ? parts.slice(1).join('|') : parts[0];
                  return (
                    <SortableItem key={r.id} id={r.id}>
                      {({ dragHandle, isDragging }) => (
                        <div className={`bg-white rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 mb-2 flex justify-between items-center gap-2 ${isReadOnly ? 'opacity-75' : ''}`}>
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {!isReadOnly && <div className="shrink-0">{dragHandle}</div>}
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center flex-wrap gap-1.5 leading-tight">
                                {tab !== 'S/D' && (
                                  <span className="font-semibold px-2 py-0.5 bg-[var(--brand-primary)] text-white text-[10px] rounded shrink-0 uppercase">{tab}</span>
                                )}
                                <span className="font-semibold text-[14px] text-[#0B1929] break-words line-clamp-2">{title ||"Sin título"}</span>
                              </div>
                              <span className="text-xs text-[#6B7A8D] mt-0.5 shrink-0">{r.ejercicios.length} ejercicios • {r.semanas} sem</span>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex gap-1.5 shrink-0">
                              <button className="flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-blue-50 transition-colors" onClick={() => openEditRutina(r)}>
                                <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline text-xs font-medium">Editar</span>
                              </button>
                              <button className="flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" onClick={() => deleteRutina(r)}>
                                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline text-xs font-medium">Borrar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </SortableItem>
                  );
                })}
              </SortableContext>
            </DndContext>
            {rutinas.length === 0 && !isReadOnly && (
              <div className="text-center py-8 text-[#6B7A8D] text-[13px]">Sin rutinas en este ciclo. ¡Agrega la primera!</div>
            )}
          </div>
        )}

        {subtab ==="progreso" && (
          <Suspense fallback={<ListSkeleton rows={4} />}>
            <ProgresoCliente selected={selected} setMsg={setMsg} isMiPlan={isMiPlan} />
          </Suspense>
        )}
      </>}

      {/* ── Modal Nuevo Plan ── */}
      {showPlanModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#0B1929]">Configuración del Plan</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#6B7A8D] mb-5">
                Al iniciar un nuevo plan, se establecerá el rango de tiempo durante el cual la dieta y las rutinas estarán activas.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Fecha de inicio</label>
                  <input type="date" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={planForm.fecha_inicio} onChange={e=>setPlanForm(p=>({...p,fecha_inicio:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Duración (Semanas)</label>
                  <input type="number" min="1" max="52" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={planForm.semanas} onChange={e=>setPlanForm(p=>({...p,semanas:e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-[#E2E8F0] flex justify-end gap-2.5">
              <button onClick={() => setShowPlanModal(false)} className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors text-[14px]">Cancelar</button>
              <button onClick={savePlan} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white font-medium hover:opacity-90 transition-opacity text-[14px] shadow-sm disabled:opacity-50">
                {saving ?"Creando..." :"Iniciar Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nuevo/Editar Día ── */}
      {showDiaModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0] gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1">
                <h3 className="text-lg font-bold text-[#0B1929]">{editDia ? `Editar día` :"Nuevo día"}</h3>
                <div className="bg-[#F0F4FA] text-[#0B1929] px-3 py-1.5 rounded-lg text-xs font-semibold flex gap-3">
                  <span>{diaForm.comidas.reduce((s, c) => s + (Number(c.calorias) || 0), 0)} Kcal</span>
                  <span>{diaForm.comidas.reduce((s, c) => s + (Number(c.proteina) || 0), 0)}g P</span>
                  <span>{diaForm.comidas.reduce((s, c) => s + (Number(c.carbohidratos) || 0), 0)}g C</span>
                  <span>{diaForm.comidas.reduce((s, c) => s + (Number(c.grasas) || 0), 0)}g G</span>
                </div>
              </div>
              <button onClick={() => setShowDiaModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929] shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {!editDia && historialDias.length > 0 && !isEstandar && (
                <div className="mb-4 bg-white rounded-xl p-3 border border-[#E2E8F0]">
                  <div className="mb-3 pb-3 border-b border-[#E2E8F0]">
                    <div className="text-xs font-semibold text-[#6B7A8D] mb-1.5 uppercase tracking-wider">IMPORTAR DESDE HISTORIAL</div>
                    <CustomSelect
                      value=""
                      onChange={onSelectHistorialDia}
                      placeholder="-- Seleccionar día preexistente --"
                      options={[
                        { value: "", label: "-- Seleccionar día preexistente --" },
                        ...historialDias.map(hd => ({
                          value: hd.id,
                          label: `${(hd.dia || "").split('|').length > 1 ? (hd.dia || "").split('|').join(' - ') : (hd.dia || "Sin título")} (de ${getClientName(hd.cliente_id)})`
                        }))
                      ]}
                    />
                  </div>
                </div>
              )}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">Día de la semana</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {["LUN","MAR","MIE","JUE","VIE","SAB","DOM"].map(d => (
                      <button
                        key={d}
                        onClick={() => {
                          setDiaForm(p => ({
                            ...p,
                            diasSeleccionados: editDia ? [d] : (p.diasSeleccionados?.includes(d) 
                              ? p.diasSeleccionados.filter(x => x !== d) 
                              : [...(p.diasSeleccionados || []), d])
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${diaForm.diasSeleccionados?.includes(d) ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm' : 'bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2 mt-4">Título Libre (Subtítulo)</label>
                  <input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]" value={diaForm.tituloPersonalizado ||""} onChange={e=>setDiaForm(p=>({...p,tituloPersonalizado:e.target.value}))} placeholder="Ej. Fase de Volumen, Día de Pierna..." />
                </div>
              <div className="flex justify-between items-center mb-2.5">
                <span className="font-semibold text-[14px]">Comidas</span>
                <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-blue-50 transition-colors font-medium" onClick={addComida}><Plus className="w-3.5 h-3.5" /> Comida</button>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndComidas}>
                <SortableContext items={diaForm.comidas.map(c => String(c._dndId))} strategy={verticalListSortingStrategy}>
                  {diaForm.comidas.map((c, i) => (
                    <SortableItem key={c._dndId} id={c._dndId}>
                      {({ dragHandle, isDragging }) => (
                        <div className="bg-gray-50 rounded-xl border border-[#E2E8F0] p-3 mb-2.5">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              {dragHandle}
                              <span className="text-xs text-[#6B7A8D] font-medium">Comida {i + 1}</span>
                            </div>
                            <button onClick={() => remComida(i)} className="text-red-400 hover:text-red-600 transition-colors border-none bg-transparent">
                              <Trash2 className="w-[18px] h-[18px]" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Hora</label><input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={c.hora} onChange={e=>updComida(i,"hora",e.target.value)} placeholder="7:00 am" /></div>
                            <div><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre</label><input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={c.nombre} onChange={e=>updComida(i,"nombre",e.target.value)} placeholder="Desayuno" /></div>
                          </div>
                          <div className="mb-2"><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Opción 1</label><textarea className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px] min-h-[60px]" value={c.opcion1} onChange={e=>updComida(i,"opcion1",e.target.value)} placeholder="Descripción..." /></div>
                          <div className="mb-2"><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Opción 2</label><textarea className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px] min-h-[60px]" value={c.opcion2} onChange={e=>updComida(i,"opcion2",e.target.value)} placeholder="Descripción..." /></div>
                          
                          {/* Image Upload for Meal */}
                          <div className="mb-2">
                            <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Foto de referencia (opcional)</label>
                            <div className="flex items-center gap-3">
                              {c.foto_url && (
                                <CachedImage src={c.foto_url} alt="referencia" className="w-16 h-16 object-cover rounded-xl border border-[#E2E8F0]" />
                              )}
                              <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-[var(--brand-primary)] rounded-xl text-[var(--brand-primary)] text-xs font-bold cursor-pointer hover:bg-[var(--brand-primary)]/5 transition-colors w-full sm:w-auto">
                                <ImageIcon className="w-4 h-4" />
                                <span>{c.foto_url ?"Cambiar foto" :"Subir foto"}</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(i, e)} disabled={saving} />
                              </label>
                              {c.foto_url && (
                                <button onClick={() => updComida(i,"foto_url","")} className="text-red-400 hover:text-red-600 p-2">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-1.5 mt-2">
                            {[["calorias","Kcal"], ["proteina","Prot g"], ["carbohidratos","Carbs g"], ["grasas","Grasas g"]].map(([f, lb]) => (
                              <div key={f}><label className="block text-[11px] sm:text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1 sm:mb-1.5 truncate">{lb}</label><input type="number" className="w-full px-2 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-[#E2E8F0] bg-white text-[13px] sm:text-[14px] text-center sm:text-left" value={c[f]} onChange={e=>updComida(i,f,e.target.value)} placeholder="0" /></div>
                            ))}
                          </div>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[#E2E8F0]">
                <button className="text-sm px-4 py-2 rounded-lg border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors" onClick={() => setShowDiaModal(false)}>Cancelar</button>
                <button className="text-sm px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50" onClick={saveDia} disabled={saving}>{saving ?"Guardando…" :"Guardar día"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nueva/Editar Rutina ── */}
      {showRutinaModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#0B1929]">{editRutina ? `Editar: ${editRutina.nombre}` :"Nueva rutina"}</h3>
              <button onClick={() => setShowRutinaModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {!editRutina && historialRutinas.length > 0 && !isEstandar && (
                <div className="mb-4 bg-white rounded-xl p-3 border border-[#E2E8F0]">
                  <div className="mb-3 pb-3 border-b border-[#E2E8F0]">
                    <div className="text-xs font-semibold text-[#6B7A8D] mb-1.5 uppercase tracking-wider">IMPORTAR DESDE HISTORIAL</div>
                    <CustomSelect
                      value=""
                      onChange={onSelectHistorialRutina}
                      placeholder="-- Seleccionar rutina preexistente --"
                      options={[
                        { value: "", label: "-- Seleccionar rutina preexistente --" },
                        ...historialRutinas.map(hr => ({
                          value: hr.id,
                          label: `${(hr.nombre || "").split('|').length > 1 ? (hr.nombre || "").split('|').join(' - ') : (hr.nombre || "Sin título")} (de ${getClientName(hr.cliente_id)})`
                        }))
                      ]}
                    />
                  </div>
                </div>
              )}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">Día de la semana</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {["LUN","MAR","MIE","JUE","VIE","SAB","DOM"].map(d => (
                      <button
                        key={d}
                        onClick={() => {
                          setRutinaForm(p => ({
                            ...p,
                            diasSeleccionados: editRutina ? [d] : (p.diasSeleccionados?.includes(d) 
                              ? p.diasSeleccionados.filter(x => x !== d) 
                              : [...(p.diasSeleccionados || []), d])
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${rutinaForm.diasSeleccionados?.includes(d) ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm' : 'bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Título de la Rutina</label>
                  <input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={rutinaForm.tituloPersonalizado ||""} onChange={e=>setRutinaForm(p=>({...p,tituloPersonalizado:e.target.value}))} placeholder="Ej. Upper 1, Pierna, etc." />
                </div>
              <EjercicioSelector biblioteca={biblioteca} onSelect={addEj} selected={rutinaForm.ejercicios}/>
              {rutinaForm.ejercicios.length > 0 && (
                <div className="mt-3">
                    <div className="hidden sm:grid grid-cols-[24px_40px_1fr_65px_65px_80px_70px] gap-1.5 mb-1.5 items-center">
                      <span/><span/><span className="text-[11px] text-[#6B7A8D] font-semibold">EJERCICIO</span>
                      <span className="text-[11px] text-[#6B7A8D] font-semibold text-center">SERIES</span>
                      <span className="text-[11px] text-[#6B7A8D] font-semibold text-center">REPS</span>
                      <span className="text-[11px] text-[#6B7A8D] font-semibold text-center">PESO</span>
                      <span/>
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndEjercicios}>
                      <SortableContext items={rutinaForm.ejercicios.map(e => String(e._dndId))} strategy={verticalListSortingStrategy}>
                        {rutinaForm.ejercicios.map((e, i) => (
                          <SortableItem key={e._dndId} id={e._dndId}>
                            {({ dragHandle, isDragging }) => (
                              <div className={`mb-2 sm:mb-1.5 p-2 sm:p-0 bg-gray-50 sm:bg-transparent rounded-lg sm:rounded-none border sm:border-none ${isDragging ? 'bg-white shadow-sm border-[#E2E8F0] z-10' : 'border-[#E2E8F0]'}`}>
                                {/* MAIN EXERCISE */}
                                <div className={`grid grid-cols-[24px_40px_1fr_32px] sm:grid-cols-[24px_40px_1fr_65px_65px_80px_70px] gap-2 sm:gap-1.5 items-center`}>
                                  <div className="flex items-center justify-center">{dragHandle}</div>
                                  <div className="w-9 h-9 rounded-md overflow-hidden bg-white sm:bg-gray-50 border border-[#E2E8F0] flex items-center justify-center">
                                    {e.gif_url ? <img src={e.gif_url} alt="" className="w-full h-full object-cover"/> : <Dumbbell className="w-[18px] h-[18px] text-[#6B7A8D]" />}
                                  </div>
                                  <div className="text-[13px] font-medium leading-tight">{e.nombre}<br/><span className="text-[10px] text-[#6B7A8D] font-normal">{e.grupo_muscular}</span></div>
                                  
                                  <div className="col-span-4 sm:col-span-3 sm:col-start-4 sm:row-start-1 grid grid-cols-3 gap-2 sm:grid-cols-[65px_65px_80px] sm:gap-1.5 mt-1 sm:mt-0 pt-2 sm:pt-0 border-t border-[#E2E8F0] sm:border-none">
                                    <div className="flex flex-col gap-0.5 sm:block">
                                      <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">SERIES</span>
                                      <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-center" value={e.num_series} onChange={ev=>updEj(i,"num_series",ev.target.value)} placeholder="4" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 sm:block">
                                      <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">REPS</span>
                                      <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-center" value={e.reps_sugeridas} onChange={ev=>updEj(i,"reps_sugeridas",ev.target.value)} placeholder="10" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 sm:block">
                                      <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">PESO</span>
                                      <div className="relative w-full">
                                        <input type="text" inputMode="decimal" className="w-full pl-2 pr-6 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-center" value={e.peso_sugerido||""} onChange={ev=>updEj(i,"peso_sugerido",ev.target.value)} placeholder="-" />
                                        <button onClick={() => toggleUnidad(i)} className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#6B7A8D] uppercase hover:text-[#0B1929]">{e.unidad || 'KG'}</button>
                                      </div>
                                    </div>
                                  </div>
                            
                                  <div className="col-start-4 row-start-1 sm:col-start-7 sm:row-start-1 flex items-center justify-end gap-1 self-start sm:self-auto mt-0.5 sm:mt-0">
                                    {(e.alternativas || []).length < 2 && (
                                      <button onClick={() => setActiveAltSlot(activeAltSlot === i ? null : i)} className={`p-1.5 rounded-md flex items-center justify-center transition-colors border-none ${activeAltSlot === i ? 'bg-blue-50 text-[var(--brand-primary)]' : 'bg-gray-100 text-[#6B7A8D] hover:bg-gray-200'}`} title="Añadir alternativa">
                                        <Plus className="w-[14px] h-[14px]" />
                                      </button>
                                    )}
                                    <button onClick={() => remEj(i)} className="bg-red-50 text-red-500 rounded-md p-1.5 hover:bg-red-100 flex items-center justify-center transition-colors border-none">
                                      <Trash2 className="w-[14px] h-[14px]" />
                                    </button>
                                  </div>
                                </div>
                            
                                {/* ACTIVE ALT SLOT INDICATOR */}
                                {activeAltSlot === i && (
                                  <div className="mt-2 ml-[72px] p-3 border-2 border-dashed border-[var(--brand-primary)] opacity-75 rounded-xl bg-blue-50 flex flex-col items-center justify-center gap-1">
                                    <span className="text-xs font-semibold text-[#0B1929]">Selecciona un ejercicio del catálogo arriba</span>
                                    <span className="text-[10px] text-[#6B7A8D]">Se agregará como alternativa a {e.nombre}</span>
                                  </div>
                                )}
                            
                                {/* ALTERNATIVES */}
                                {(e.alternativas || []).map((alt, altIdx) => (
                                  <div key={`alt-${altIdx}`} className="mt-1.5 ml-[24px] sm:ml-[72px] grid grid-cols-[30px_1fr_32px] sm:grid-cols-[30px_1fr_65px_80px_70px] gap-2 sm:gap-1.5 items-center p-2 sm:p-0 bg-white sm:bg-transparent rounded-lg sm:rounded-none border sm:border-none border-[#E2E8F0] opacity-90">
                                    <div className="w-7 h-7 rounded-md overflow-hidden bg-white sm:bg-gray-50 border border-[#E2E8F0] flex items-center justify-center">
                                      {alt.gif_url ? <img src={alt.gif_url} alt="" className="w-full h-full object-cover"/> : <Dumbbell className="w-[14px] h-[14px] text-[#6B7A8D]" />}
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[9px] font-bold">ALT</span>
                                      <span className="text-[12px] font-medium leading-tight truncate">{alt.nombre}</span>
                                    </div>
                                    
                                    <div className="col-span-3 sm:col-span-2 sm:col-start-3 sm:row-start-1 grid grid-cols-2 gap-2 sm:grid-cols-[65px_80px] sm:gap-1.5 mt-1 sm:mt-0 pt-2 sm:pt-0 border-t border-[#E2E8F0] sm:border-none">
                                      <div className="flex flex-col gap-0.5 sm:block">
                                        <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">REPS</span>
                                        <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-center" value={alt.reps_sugeridas} onChange={ev=>updAlt(i,altIdx,"reps_sugeridas",ev.target.value)} placeholder="10" />
                                      </div>
                                      <div className="flex flex-col gap-0.5 sm:block">
                                        <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">PESO</span>
                                        <div className="relative w-full">
                                          <input type="text" inputMode="decimal" className="w-full pl-2 pr-6 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-center" value={alt.peso_sugerido||""} onChange={ev=>updAlt(i,altIdx,"peso_sugerido",ev.target.value)} placeholder="-" />
                                          <button onClick={() => toggleUnidadAlt(i, altIdx)} className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#6B7A8D] uppercase hover:text-[#0B1929]">{alt.unidad || 'KG'}</button>
                                        </div>
                                      </div>
                                    </div>
                            
                                    <div className="col-start-3 row-start-1 sm:col-start-5 sm:row-start-1 flex items-center justify-end self-start sm:self-auto mt-0.5 sm:mt-0">
                                      <button onClick={() => remAlt(i, altIdx)} className="bg-red-50 text-red-500 rounded-md p-1.5 hover:bg-red-100 flex items-center justify-center transition-colors border-none">
                                        <X className="w-[14px] h-[14px]" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </SortableItem>
                        ))}
                      </SortableContext>
                    </DndContext>
                </div>
              )}
              <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[#E2E8F0]">
                <button className="text-sm px-4 py-2 rounded-lg border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors" onClick={() => setShowRutinaModal(false)}>Cancelar</button>
                <button className="text-sm px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50" onClick={saveRutina} disabled={saving}>{saving ?"Guardando…" :"Guardar rutina"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Se removió el FAB para PDF y se integró en la cabecera ── */}

      {/* ── Modal de recorte de foto ── */}
      {cropModal && (
        <div className="fixed inset-0 z-[200] bg-[#0B1929]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#0B1929]">Recortar foto de referencia</h3>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Arrastra el cuadro para elegir qué parte verá el paciente</p>
              </div>
              <button onClick={() => { URL.revokeObjectURL(cropModal.objectUrl); setCropModal(null); }} className="text-[#6B7A8D] hover:text-[#0B1929] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cropper */}
            <div className="p-5 flex justify-center bg-[#F0F4FA]">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                minWidth={60}
                circularCrop={false}
              >
                <img
                  ref={imgCropRef}
                  src={cropModal.objectUrl}
                  alt="Recortar"
                  onLoad={onCropImageLoad}
                  className="max-h-[50vh] max-w-full object-contain rounded-lg"
                />
              </ReactCrop>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E2E8F0] flex justify-end gap-3">
              <button
                onClick={() => { URL.revokeObjectURL(cropModal.objectUrl); setCropModal(null); }}
                className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCrop}
                disabled={!completedCrop || saving}
                className="px-5 py-2 rounded-xl bg-[var(--brand-primary)] text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar recorte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Plantillas Maestro (Nutrición y Rutinas) ── */}
      {templateModal && (
        <Suspense fallback={null}>
          <TemplatesManagerModal
            type={templateModal}
            currentData={
              templateModal === "nutri"
                ? { macros, dias }
                : { rutinas, semanas: planForm?.semanas || 4 }
            }
            clientes={clientes}
            onApplyTemplate={
              templateModal === "nutri"
                ? handleApplyNutriTemplate
                : handleApplyRutinaTemplate
            }
            onClose={() => setTemplateModal(null)}
            setMsg={setMsg}
          />
        </Suspense>
      )}

      {/* ── Calculadora Metabólica y de Macronutrientes ── */}
      <MacroCalculatorModal
        isOpen={showMacroCalc}
        onClose={() => setShowMacroCalc(false)}
        cliente={selected}
        latestMetrica={latestMetrica}
        onApplyMacros={handleApplyPrescribedMacros}
      />

      {/* ── Modal de Confirmación Estilizado ── */}
      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDelete?.onConfirm}
        title={confirmDelete?.title}
        description={confirmDelete?.description}
        confirmText={confirmDelete?.confirmText || "Eliminar"}
        cancelText={confirmDelete?.cancelText || "Cancelar"}
        danger={confirmDelete?.danger ?? true}
        icon={confirmDelete?.icon || "trash"}
      />
    </div>
  );
}
