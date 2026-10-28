import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
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
import { RefreshCw, ChevronDown, Trash2, Calendar, Activity, CheckCircle2, AlertCircle, Save, Edit2, Plus, Search, FileText, Download, Lock, X, Utensils, Dumbbell, BarChart2, Camera, Image as ImageIcon, Bookmark, Calculator, ArrowLeft, User, Check, ClipboardList, RotateCcw, MessageCircle, Copy, TrendingUp } from "lucide-react";
import { EjercicioSelector } from "./EjercicioSelector";
import { ConfirmModal } from "../ui/ConfirmModal";
import { CustomSelect } from "../ui/CustomSelect";
import { generateNutriPDF } from "../../utils/pdf";
import { dbPeek, dbGet, dbGetFresh, dbPost, dbPatch, dbDel, dbUpsert, storageUpload, updateQueryCache, invalidateCache } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { useBackButton } from "../../lib/backButtonHandler";
import { CachedImage } from "../../lib/mediaCache";
import { calcEdadFromBirthdate, normalizeSexo } from "../../lib/bodyComposition";
import { peekClinicalRecord, fetchClinicalRecord, saveClinicalRecord, hasAnamnesisData, EMPTY_ANAMNESIS } from "../../lib/clinicalRecord";

import { ProgresoCliente } from "./ProgresoCliente";
import TemplatesManagerModal from "../ui/TemplatesManagerModal";
import MacroCalculatorModal from "../clinical/MacroCalculatorModal";
import ExpedienteClinicoModal from "../clinical/ExpedienteClinicoModal";
import NuevoExpedienteForms from "../clinical/NuevoExpedienteForms";
import ClinicalAiSummaryCard from "../clinical/ClinicalAiSummaryCard";

const sanitizeWhatsAppPhone = (phone) => {
  if (!phone) return "";
  let clean = String(phone).replace(/\D/g, "");
  if (clean.length === 10) clean = "52" + clean;
  return clean;
};

const isOfflineError = (e) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!e) return false;
  const m = (e.message || String(e)).toLowerCase();
  return m.includes("offline") || m.includes("failed to fetch") || m.includes("network") || m.includes("aborted");
};

// ── Helpers de Tiempos y Ciclos ──
const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDaysToDate = (dateStr, days) => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + Number(days));
  return toDateStr(d);
};

const diffDaysBetween = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  const d1 = new Date(startStr + "T12:00:00");
  const d2 = new Date(endStr + "T12:00:00");
  const diff = d2.getTime() - d1.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
};

const parseCycleData = (cycle, fallbackServicios = { nutricion: true, entrenamiento: true }) => {
  if (!cycle) {
    return {
      nombreBase: "Plan",
      semanas: 4,
      dias: 28,
      servicios: fallbackServicios,
      enfoque: ""
    };
  }
  const parts = (cycle.nombre || "").split("|");
  const nombreBase = parts[0] || "Plan";
  const semanas = parseInt(parts[1], 10) || 4;
  let servicios = { ...fallbackServicios };
  if (parts[2]) {
    const sList = parts[2].split(",");
    servicios = {
      nutricion: sList.includes("nutri"),
      entrenamiento: sList.includes("entreno")
    };
  }
  const dias = parseInt(parts[3], 10) || (semanas * 7);
  const enfoque = (parts[4] || "").trim();

  return { nombreBase, semanas, dias, servicios, enfoque };
};

export function ProgramarCliente({ clientes, selected, setSelected, onBackToList, setMsg, biblioteca, isMiPlan, onModoAtleta }) {
  const brand = useBrand();
  const catalogRef = useRef(null);
  const [subtab, setSubtab] = useState(() => {
    const s = sessionStorage.getItem("flux_programar_subtab");
    return s ? s : "progreso";
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
  const [planModalMode, setPlanModalMode] = useState("create"); // "create" | "edit"
  const [editingCycle, setEditingCycle] = useState(null);
  const [hasPatientData, setHasPatientData] = useState(false);
  const [checkingPatientData, setCheckingPatientData] = useState(false);
  const [planForm, setPlanForm] = useState(() => {
    const start = toDateStr(new Date());
    const dias = 28;
    const semanas = 4;
    const fin = addDaysToDate(start, dias - 1);
    return {
      fecha_inicio: start,
      semanas,
      dias,
      fecha_fin: fin,
      servicios: { nutricion: true, entrenamiento: true },
      enfoque: "",
      clonarAnterior: true,
    };
  });
  const [autoOpenCheckinTrigger, setAutoOpenCheckinTrigger] = useState(0);
  const [nutriView, setNutriView] = useState("programar"); // "programar" | "tracking"
  const [entrenoView, setEntrenoView] = useState("programar"); // "programar" | "tracking"
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [editDia, setEditDia] = useState(null);
  const [diaForm, setDiaForm] = useState({ dia:"", orden:0, comidas:[] });
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editRutina, setEditRutina] = useState(null);
  const [rutinaForm, setRutinaForm] = useState({ nombre:"", ejercicios:[] });
  const [activeAltSlot, setActiveAltSlot] = useState(null);
  const [templateModal, setTemplateModal] = useState(null); // 'nutri' | 'rutina' | null
  const [showMacroCalc, setShowMacroCalc] = useState(false);
  const [showExpediente, setShowExpediente] = useState(false);
  const [latestMetrica, setLatestMetrica] = useState(() => {
    const ms = selected?.id ? dbPeek(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc`) : null;
    return Array.isArray(ms) && ms.length > 0 ? ms[0] : null;
  });
  const [clinicalLoaded, setClinicalLoaded] = useState(false);
  const [clinicalRec, setClinicalRec] = useState(() => {
    return selected?.id ? peekClinicalRecord(selected.id) : null;
  });

  useEffect(() => {
    let active = true;
    if (selected?.id) {
      setClinicalLoaded(false);
      fetchClinicalRecord(selected.id).then(rec => {
        if (active) {
          if (rec) setClinicalRec(rec);
          setClinicalLoaded(true);
        }
      }).catch(() => {
        if (active) setClinicalLoaded(true);
      });

      // Refrescar datos frescos del paciente desde la base de datos (nombre, teléfono, fecha_nacimiento, genero, objetivo)
      dbGetFresh(`clientes?id=eq.${selected.id}`).then(freshRows => {
        if (active && Array.isArray(freshRows) && freshRows.length > 0) {
          setSelected(prev => ({ ...prev, ...freshRows[0] }));
        }
      }).catch(() => {});
    } else {
      setClinicalRec(null);
      setClinicalLoaded(true);
    }
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => {
    const onExpedienteUpdated = (e) => {
      const targetId = e?.detail?.clienteId;
      if (!targetId || targetId === selected?.id) {
        if (e?.detail?.record) setClinicalRec(e.detail.record);
        else if (selected?.id) fetchClinicalRecord(selected.id).then(rec => rec && setClinicalRec(rec)).catch(() => {});
      }
    };
    const onMetricasUpdated = (e) => {
      const targetId = e?.detail?.clienteId;
      if (!targetId || targetId === selected?.id) {
        if (selected?.id) {
          dbGetFresh(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc&limit=1`)
            .then(ms => setLatestMetrica(Array.isArray(ms) && ms.length > 0 ? ms[0] : null))
            .catch(() => {});
        }
      }
    };
    window.addEventListener("flux:expediente-updated", onExpedienteUpdated);
    window.addEventListener("flux:metricas-updated", onMetricasUpdated);
    return () => {
      window.removeEventListener("flux:expediente-updated", onExpedienteUpdated);
      window.removeEventListener("flux:metricas-updated", onMetricasUpdated);
    };
  }, [selected?.id]);

  const parsedActiveCycle = useMemo(() => {
    return parseCycleData(cicloSel, clinicalRec?.servicios_activos);
  }, [cicloSel, clinicalRec?.servicios_activos]);

  const serviciosActivos = parsedActiveCycle.servicios;

  // Reorientar subtab si el servicio seleccionado fue desactivado
  useEffect(() => {
    if (!serviciosActivos.nutricion && subtab === "nutri") {
      setSubtab(serviciosActivos.entrenamiento ? "deporte" : "progreso");
    } else if (!serviciosActivos.entrenamiento && subtab === "deporte") {
      setSubtab(serviciosActivos.nutricion ? "nutri" : "progreso");
    }
  }, [serviciosActivos.nutricion, serviciosActivos.entrenamiento, subtab]);

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
  useBackButton(showExpediente, () => setShowExpediente(false), 25);
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

  const formatWeightForInput = (val, unit) => {
    if ((unit || "kg") === "lb" && val && !isNaN(val)) {
      const lb = parseFloat(val) * 2.20462262;
      return Number(lb.toFixed(1)).toString();
    }
    return val;
  };

  const onSelectHistorialRutina = async (e) => {
    const rid = e?.target ? e.target.value : (e || "");
    if (!rid) return;
    if (e?.target) e.target.value = "";
    const r = historialRutinas.find(x => String(x.id) === String(rid));
    if (!r) return;
    try {
      const ejs = await dbGet(`ejercicios?rutina_id=eq.${rid}&order=orden.asc`);
      const parts = (r.nombre || "").split("|");
      let dSel = [];
      let tPers = r.nombre || "";
      if (parts.length > 1) {
        dSel = [parts[0].trim()].filter(Boolean);
        tPers = parts.slice(1).join("|").trim();
      } else if (["LUN","MAR","MIE","JUE","VIE","SAB","DOM"].includes(r.nombre?.trim())) {
        dSel = [r.nombre.trim()];
        tPers = "";
      }
      setRutinaForm(p => ({
        ...p,
        nombre: (r.nombre || "") + " (Copia)",
        diasSeleccionados: p.diasSeleccionados?.length > 0 ? p.diasSeleccionados : dSel,
        tituloPersonalizado: tPers ? `${tPers} (Copia)` : "Rutina importada",
        semanas: r.semanas,
        ejercicios: (ejs || []).map(x => {
          const copy = {
            ...x,
            peso_sugerido: formatWeightForInput(x.peso_sugerido, x.unidad || "kg"),
            alternativas: (x.alternativas || []).map(alt => ({
              ...alt,
              peso_sugerido: formatWeightForInput(alt.peso_sugerido, alt.unidad || x.unidad || "kg"),
            })),
            _dndId: Math.random().toString(36).slice(2, 9),
          };
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
      const parts = (d.dia || "").split("|");
      const dayTab = parts.length > 1 ? parts[0].trim() : "";
      const title = parts.length > 1 ? parts.slice(1).join("|").trim() : (d.dia || "").trim();
      setDiaForm(p => ({
        ...p,
        dia: (d.dia || "") + " (Copia)",
        diasSeleccionados: p.diasSeleccionados?.length > 0 ? p.diasSeleccionados : (dayTab && dayTab !== "S/D" ? [dayTab] : []),
        tituloPersonalizado: title ? `${title} (Copia)` : "Día importado",
        comidas: (coms || []).map(x => {
          const copy = { ...x, _dndId: Math.random().toString(36).slice(2, 9) };
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
  const loadCiclos = useCallback(async (preferCycleId = null, opts = {}) => {
    if (!selected) return null;
    const { forceFresh = false } = opts;
    try {
      const fetchFn = forceFresh ? dbGetFresh : dbGet;
      const cs = await fetchFn(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`).catch(() => []);
      const finalCycles = Array.isArray(cs) ? cs : [];
      setCiclos(finalCycles);
      
      const activeCycle = finalCycles.find(c => c.activo);
      let chosen = null;

      // 1. Si se pasa un ciclo preferido explícitamente (ej: recién creado o recién aplicado)
      if (preferCycleId) {
        chosen = finalCycles.find(c => c.id === preferCycleId);
      }

      // 2. Si no, en "Mi Plan", SIEMPRE priorizar el ciclo activo
      if (!chosen && isMiPlan && activeCycle) {
        chosen = activeCycle;
      }

      // 3. Si no, revisar si había un ciclo guardado para este cliente específico
      if (!chosen) {
        const savedCycleId = sessionStorage.getItem(`flux_programar_ciclo_${selected.id}`);
        if (savedCycleId) {
          const found = finalCycles.find(c => c.id === savedCycleId);
          // Si el cliente tiene ciclo activo pero el guardado es inactivo, preferir el activo
          if (found && (found.activo || !activeCycle)) {
            chosen = found;
          }
        }
      }

      // 4. Fallback al ciclo activo o al más reciente
      if (!chosen) {
        chosen = activeCycle || finalCycles[0] || null;
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
          invalidateCache("ciclos");
          loadCiclos(null, { forceFresh: true });
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
  const getCycleWeeks = (c) => c?.nombre?.includes("|") ? parseInt(c.nombre.split("|")[1], 10) || 4 : 4;

  const handlePlanStartChange = (newStart) => {
    if (!newStart) return;
    const currentDays = Number(planForm.dias) || 28;
    const newEnd = addDaysToDate(newStart, currentDays - 1);
    setPlanForm(p => ({
      ...p,
      fecha_inicio: newStart,
      fecha_fin: newEnd
    }));
  };

  const handlePlanWeeksChange = (newWeeks) => {
    const w = Math.max(1, parseInt(newWeeks, 10) || 1);
    const d = w * 7;
    const newEnd = addDaysToDate(planForm.fecha_inicio, d - 1);
    setPlanForm(p => ({
      ...p,
      semanas: w,
      dias: d,
      fecha_fin: newEnd
    }));
  };

  const handlePlanDaysChange = (newDays) => {
    const d = Math.max(1, parseInt(newDays, 10) || 1);
    const w = Math.max(1, Math.round(d / 7));
    const newEnd = addDaysToDate(planForm.fecha_inicio, d - 1);
    setPlanForm(p => ({
      ...p,
      dias: d,
      semanas: w,
      fecha_fin: newEnd
    }));
  };

  const handlePlanEndChange = (newEnd) => {
    if (!newEnd) return;
    if (newEnd < planForm.fecha_inicio) return;
    const d = Math.max(1, diffDaysBetween(planForm.fecha_inicio, newEnd));
    const w = Math.max(1, Math.round(d / 7));
    setPlanForm(p => ({
      ...p,
      fecha_fin: newEnd,
      dias: d,
      semanas: w
    }));
  };

  const openCreatePlan = () => {
    setPlanModalMode("create");
    setEditingCycle(null);
    setHasPatientData(false);
    setCheckingPatientData(false);

    let suggestedStart = toDateStr(new Date());
    const activeCycle = ciclos.find(c => c.activo) || ciclos[0];
    if (activeCycle) {
      const parsedOld = parseCycleData(activeCycle);
      const oldEnd = addDaysToDate(activeCycle.fecha_inicio, (parsedOld.dias || (parsedOld.semanas * 7)) - 1);
      const dayAfterOld = addDaysToDate(oldEnd, 1);
      if (dayAfterOld > suggestedStart) suggestedStart = dayAfterOld;
    }

    const defaultDays = 28;
    const defaultWeeks = 4;
    const defaultEnd = addDaysToDate(suggestedStart, defaultDays - 1);
    const prevServices = activeCycle
      ? parseCycleData(activeCycle, clinicalRec?.servicios_activos).servicios
      : (clinicalRec?.servicios_activos || { nutricion: true, entrenamiento: true });

    setPlanForm({
      fecha_inicio: suggestedStart,
      semanas: defaultWeeks,
      dias: defaultDays,
      fecha_fin: defaultEnd,
      servicios: { ...prevServices },
      enfoque: "",
      clonarAnterior: ciclos.length > 0,
    });

    setShowPlanModal(true);
  };

  const openEditPlan = async (ciclo) => {
    setPlanModalMode("edit");
    setEditingCycle(ciclo);
    const parsed = parseCycleData(ciclo, clinicalRec?.servicios_activos);
    const start = ciclo.fecha_inicio || toDateStr(new Date());
    const dias = parsed.dias || (parsed.semanas * 7);
    const fin = addDaysToDate(start, dias - 1);

    setPlanForm({
      fecha_inicio: start,
      semanas: parsed.semanas,
      dias: dias,
      fecha_fin: fin,
      servicios: { ...parsed.servicios },
      enfoque: parsed.enfoque,
      clonarAnterior: false,
    });

    setShowPlanModal(true);
    setHasPatientData(false);
    setCheckingPatientData(true);

    try {
      const hoy = toDateStr(new Date());
      const yaInicio = start <= hoy;
      let tieneDatos = false;

      if (yaInicio && selected?.id) {
        // 1. Verificar registros en nutrición_progreso para días de este ciclo
        const nutris = await dbGet(`nutricion?ciclo_id=eq.${ciclo.id}&select=id,nutricion_dias(id)`).catch(() => []);
        const diaIds = [];
        if (Array.isArray(nutris)) {
          nutris.forEach(n => {
            (n.nutricion_dias || []).forEach(d => { if (d.id) diaIds.push(d.id); });
          });
        }
        if (diaIds.length > 0) {
          const npRows = await dbGet(`nutricion_progreso?cliente_id=eq.${selected.id}&dia_id=in.(${diaIds.join(",")})&limit=1`).catch(() => []);
          if (Array.isArray(npRows) && npRows.length > 0) {
            tieneDatos = true;
          }
        }

        // 2. Si aún no, verificar en rutinas de este ciclo
        if (!tieneDatos) {
          const ruts = await dbGet(`rutinas?ciclo_id=eq.${ciclo.id}&select=id,ejercicios(id)`).catch(() => []);
          const ejIds = [];
          if (Array.isArray(ruts)) {
            ruts.forEach(r => {
              (r.ejercicios || []).forEach(ej => { if (ej.id) ejIds.push(ej.id); });
            });
          }
          if (ejIds.length > 0) {
            const pRows = await dbGet(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=in.(${ejIds.join(",")})&limit=1`).catch(() => []);
            if (Array.isArray(pRows) && pRows.length > 0) {
              tieneDatos = true;
            }
          }
        }
      }

      setHasPatientData(tieneDatos);
    } catch (err) {
      console.warn("Error al verificar datos del ciclo:", err);
    } finally {
      setCheckingPatientData(false);
    }
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const start = new Date(planForm.fecha_inicio + "T12:00:00");
      const end = new Date(planForm.fecha_fin + "T12:00:00");
      const options = { day: "numeric", month: "short" };
      const rangeStr = `${start.toLocaleDateString("es-ES", options)} - ${end.toLocaleDateString("es-ES", options)}`;

      const sList = [];
      if (planForm.servicios.nutricion) sList.push("nutri");
      if (planForm.servicios.entrenamiento) sList.push("entreno");
      const serviciosStr = sList.join(",");

      if (planModalMode === "edit" && editingCycle) {
        // ── EDICIÓN DE PLAN EXISTENTE ──
        const existingParts = (editingCycle.nombre || "").split("|");
        const ordinalMatch = existingParts[0].match(/^([^\(]+)/);
        const prefix = ordinalMatch ? ordinalMatch[1].trim() : `${editingCycle.nombre.split(" ")[0] || "1º"} Plan`;
        const finalName = `${prefix} (${rangeStr})|${planForm.semanas}|${serviciosStr}|${planForm.dias}|${(planForm.enfoque || "").trim()}`;

        await dbPatch(`ciclos?id=eq.${editingCycle.id}`, {
          nombre: finalName,
          fecha_inicio: planForm.fecha_inicio,
        });

        const updatedCycle = {
          ...editingCycle,
          nombre: finalName,
          fecha_inicio: planForm.fecha_inicio,
        };

        // Actualización optimista inmediata en 0ms
        setCiclos(prev => prev.map(c => c.id === updatedCycle.id ? updatedCycle : c));
        if (cicloSel?.id === updatedCycle.id) {
          setCicloSel(updatedCycle);
        }

        invalidateCache("ciclos");
        updateQueryCache(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`, (old) => {
          if (!Array.isArray(old)) return [updatedCycle];
          return old.map(c => (c.id === updatedCycle.id ? updatedCycle : c));
        });

        if (cicloSel?.id === editingCycle.id) {
          const nextRec = {
            ...(clinicalRec || {}),
            servicios_activos: { ...planForm.servicios }
          };
          setClinicalRec(nextRec);
          saveClinicalRecord(selected.id, nextRec).catch(() => {});
        }

        setShowPlanModal(false);
        setMsg(
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Plan actualizado exitosamente
          </div>
        );
        await loadCiclos(editingCycle.id, { forceFresh: true });
        await loadData(updatedCycle, { silent: true, forceFresh: true });
        notifyPlanUpdate("ciclos");
      } else {
        // ── CREACIÓN DE NUEVO PLAN ──
        const idx = ciclos.length;
        const ordinal = ORDINALES[idx] || `${idx + 1}º`;
        const finalName = `${ordinal} Plan (${rangeStr})|${planForm.semanas}|${serviciosStr}|${planForm.dias}|${(planForm.enfoque || "").trim()}`;

        if (ciclos.some((c) => c.activo)) {
          await dbPatch(`ciclos?cliente_id=eq.${selected.id}&activo=eq.true`, { activo: false });
        }
        const cRes = await dbPost("ciclos", {
          cliente_id: selected.id,
          nombre: finalName,
          fecha_inicio: planForm.fecha_inicio,
          activo: true,
        });

        const newCiclo = cRes[0];

        // Actualización optimista inmediata en 0ms para desbloquear herramientas de abajo
        setCiclos(prev => [
          newCiclo,
          ...prev.filter(c => c.id !== newCiclo.id).map(c => ({ ...c, activo: false }))
        ]);
        setCicloSel(newCiclo);
        if (selected?.id) sessionStorage.setItem(`flux_programar_ciclo_${selected.id}`, newCiclo.id);

        invalidateCache("ciclos");
        updateQueryCache(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`, (old) => {
          const prev = Array.isArray(old) ? old : [];
          return [newCiclo, ...prev.filter(c => c.id !== newCiclo.id).map(c => ({ ...c, activo: false }))];
        });

        // Sincronizar servicios en expediente clínico
        const nextRec = {
          ...(clinicalRec || {}),
          servicios_activos: { ...planForm.servicios }
        };
        setClinicalRec(nextRec);
        saveClinicalRecord(selected.id, nextRec).catch(() => {});

        // Clonar plan anterior si fue solicitado
        const cicloAnterior = ciclos.find((c) => c.activo) || ciclos[0];
        if (planForm.clonarAnterior && cicloAnterior) {
          try {
            // 1. Clonar Nutrición
            const oldNutris = await dbGet(`nutricion?ciclo_id=eq.${cicloAnterior.id}`).catch(() => []);
            if (oldNutris && oldNutris.length > 0) {
              const oldN = oldNutris[0];
              const nRes = await dbPost("nutricion", {
                cliente_id: selected.id,
                ciclo_id: newCiclo.id,
                calorias: oldN.calorias || 0,
                proteina: oldN.proteina || 0,
                carbohidratos: oldN.carbohidratos || 0,
                grasas: oldN.grasas || 0,
              });
              const newN = nRes && nRes[0];
              if (newN) {
                const oldDias = await dbGet(`nutricion_dias?nutricion_id=eq.${oldN.id}&select=*,comidas(*)&order=orden.asc`).catch(() => []);
                if (Array.isArray(oldDias)) {
                  for (const od of oldDias) {
                    const dRes = await dbPost("nutricion_dias", {
                      nutricion_id: newN.id,
                      dia: od.dia,
                      orden: od.orden || 0,
                    });
                    const newD = dRes && dRes[0];
                    if (newD && od.comidas && od.comidas.length > 0) {
                      const comsData = od.comidas.map((c, cIdx) => ({
                        dia_id: newD.id,
                        hora: c.hora || "",
                        nombre: c.nombre || `Comida ${cIdx + 1}`,
                        opcion1: c.opcion1 || "",
                        opcion2: c.opcion2 || "",
                        calorias: +c.calorias || 0,
                        proteina: +c.proteina || 0,
                        carbohidratos: +c.carbohidratos || 0,
                        grasas: +c.grasas || 0,
                        foto_url: c.foto_url || "",
                        orden: c.orden != null ? c.orden : cIdx,
                      }));
                      await dbPost("comidas", comsData);
                    }
                  }
                }
              }
            }

            // 2. Clonar Rutinas
            const oldRuts = await dbGet(`rutinas?ciclo_id=eq.${cicloAnterior.id}&select=*,ejercicios(*)&order=orden.asc`).catch(() => []);
            if (Array.isArray(oldRuts) && oldRuts.length > 0) {
              for (const r of oldRuts) {
                const rRes = await dbPost("rutinas", {
                  cliente_id: selected.id,
                  ciclo_id: newCiclo.id,
                  nombre: r.nombre,
                  semanas: r.semanas || planForm.semanas,
                  orden: r.orden || 0,
                });
                const newR = rRes && rRes[0];
                if (newR && r.ejercicios && r.ejercicios.length > 0) {
                  const ejsData = r.ejercicios.map((ej, ejIdx) => ({
                    rutina_id: newR.id,
                    ejercicio: ej.ejercicio || "",
                    series: ej.series || "",
                    repeticiones: ej.repeticiones || "",
                    descanso: ej.descanso || "",
                    rir_rpe: ej.rir_rpe || "",
                    notas: ej.notas || "",
                    superset_id: ej.superset_id || null,
                    grupo_muscular: ej.grupo_muscular || "",
                    tipo_ejercicio: ej.tipo_ejercicio || "",
                    gif_url: ej.gif_url || "",
                    foto_url: ej.foto_url || "",
                    orden: ej.orden != null ? ej.orden : ejIdx,
                  }));
                  await dbPost("ejercicios", ejsData);
                }
              }
            }
          } catch (cloneErr) {
            console.warn("Aviso al clonar plan anterior:", cloneErr);
          }
        }

        setShowPlanModal(false);
        setSubtab("progreso");
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("flux:open-checkin"));
          }
        }, 150);
        setMsg(
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Plan creado exitosamente
          </div>
        );
        await loadCiclos(newCiclo.id, { forceFresh: true });
        await loadData(newCiclo, { silent: true, forceFresh: true });
        notifyPlanUpdate("ciclos");

        if (!isMiPlan && selected.auth_id) {
          dbPost("notificaciones", {
            profile_id: selected.auth_id,
            titulo: "Nuevo plan disponible",
            mensaje: "Tu especialista ha creado un nuevo ciclo para ti.",
            tipo: "plan",
            link_url: "mi_plan",
            entidad_id: newCiclo.id,
          }, { headers: { Prefer: "return=minimal" } }).catch(() => {});
        }
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
        setCiclos(prev => [activeCiclo, ...prev.filter(c => c.id !== activeCiclo.id).map(c => ({ ...c, activo: false }))]);
        setCicloSel(activeCiclo);
        invalidateCache("ciclos");
        await loadCiclos(activeCiclo.id, { forceFresh: true });
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
        setCiclos(prev => [activeCiclo, ...prev.filter(c => c.id !== activeCiclo.id).map(c => ({ ...c, activo: false }))]);
        setCicloSel(activeCiclo);
        invalidateCache("ciclos");
        await loadCiclos(activeCiclo.id, { forceFresh: true });
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
    setActiveAltSlot(null);
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
    setActiveAltSlot(null);
    setRutinaForm({ 
      diasSeleccionados: dSel,
      tituloPersonalizado: tPers,
      ejercicios: r.ejercicios.map(e => ({
        ...e,
        peso_sugerido: formatWeightForInput(e.peso_sugerido, e.unidad || "kg"),
        alternativas: (e.alternativas || []).map(alt => ({
          ...alt,
          peso_sugerido: formatWeightForInput(alt.peso_sugerido, alt.unidad || e.unidad || "kg"),
        })),
        _dndId: String(e.id || Math.random().toString(36).slice(2,9)),
      }))
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

  // ── Verificación de Expediente Inicial para Pacientes Nuevos ──
  // Si aún no termina de cargar el expediente remoto desde Supabase Storage, mostrar loader sutil para evitar parpadeos
  if (!isMiPlan && !clinicalLoaded) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center py-24 gap-3 bg-[#F8FAFC]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-[#6B7A8D]">Verificando expediente del paciente...</span>
      </div>
    );
  }

  const hasExistingPlan = rutinas.length > 0 || dias.length > 0 || (ciclos && ciclos.length > 0);
  const isExpedienteCompletado = Boolean(
    clinicalRec?.anamnesis_completada ||
    clinicalRec?.anamnesis?.completado_por ||
    hasExistingPlan ||
    isMiPlan
  );

  if (!isMiPlan && !isExpedienteCompletado) {
    return (
      <NuevoExpedienteForms
        cliente={selected}
        onFinished={(savedRec, updatedClient) => {
          setClinicalRec(savedRec);
          if (updatedClient) {
            setSelected((prev) => ({ ...prev, ...updatedClient }));
          }
        }}
        onBackToList={() => {
          if (onBackToList) onBackToList();
          else setSelected(null);
        }}
        setMsg={setMsg}
      />
    );
  }

  const birthdate = selected?.fecha_nacimiento || clinicalRec?.anamnesis?.fecha_nacimiento || clinicalRec?.antecedentes?.fecha_nacimiento || null;
  const rawSexo = selected?.genero || selected?.sexo || clinicalRec?.anamnesis?.sexo || clinicalRec?.antecedentes?.sexo || null;
  const edadNum = birthdate ? calcEdadFromBirthdate(birthdate) : null;
  const edadStr = edadNum !== null ? `${edadNum} años` : null;
  const sexoStr = rawSexo ? (normalizeSexo(rawSexo) === "M" ? "Masculino" : "Femenino") : null;
  const pesoStr = latestMetrica?.peso ? `${latestMetrica.peso} kg` : (selected?.peso ? `${selected.peso} kg` : null);

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
          <div className="mb-4 bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
              
              {/* Left: Patient info + Back button */}
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => (onBackToList ? onBackToList() : setSelected(null))}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0F4FA] hover:bg-[#E2E8F0] text-[#0B1929] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Volver a la lista de pacientes"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[#0B1929] truncate max-w-full">{selected.nombre}</h2>
                    {edadStr && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F0F4FA] text-[#6B7A8D] whitespace-nowrap">
                        {edadStr}
                      </span>
                    )}
                    {sexoStr && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F0F4FA] text-[#6B7A8D] whitespace-nowrap">
                        {sexoStr}
                      </span>
                    )}
                    {pesoStr && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                        {pesoStr}
                      </span>
                    )}
                    {selected.objetivo && (
                      <span className="hidden xl:inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-blue-50/70 text-[var(--brand-primary)] truncate max-w-[220px]" title={selected.objetivo}>
                        {selected.objetivo}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#6B7A8D] truncate mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="truncate">{selected.email}</span>
                    {selected.telefono && (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span>•</span>
                        <a
                          href={`https://wa.me/${sanitizeWhatsAppPhone(selected.telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline font-semibold transition-colors"
                          title="Abrir chat de WhatsApp con el paciente"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                          <span>{selected.telefono}</span>
                        </a>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Histórico & Expediente */}
              <div className="flex items-center justify-between sm:justify-start lg:justify-end gap-2 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-[#F0F4FA] flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setSubtab("historico")}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs cursor-pointer shrink-0 ${
                    subtab === "historico"
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                      : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0B1929]"
                  }`}
                  title="Ver gráficas de progreso histórico plan a plan"
                >
                  <TrendingUp className={`w-3.5 h-3.5 ${subtab === "historico" ? "text-white" : "text-[var(--brand-primary)]"}`} />
                  <span>Histórico</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowExpediente(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0B1929] transition-all shadow-2xs cursor-pointer shrink-0"
                  title="Abrir Expediente Clínico Integral"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                  <span>Expediente</span>
                  {clinicalRec?.solicitud_activa && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Solicitud activa de llenado" />
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

      {/* ── Resumen Clínico Inteligente IA ── */}
      {!isMiPlan && (clinicalRec?.anamnesis_completada || hasAnamnesisData(clinicalRec?.anamnesis)) && (
        <ClinicalAiSummaryCard
          cliente={selected}
          clinicalRec={clinicalRec}
          onRecordUpdated={(rec) => setClinicalRec(rec)}
        />
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
            <button className="text-xs flex items-center justify-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors font-medium cursor-pointer" onClick={openCreatePlan}>
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{ciclos.length === 0 ?"Crear Primer Plan" :"Siguiente Plan"}</span>
            </button>
          </div>
        </div>

        {ciclos.length === 0 ? (
          <div className="text-center py-8 px-4 text-[#6B7A8D] text-xs sm:text-[13px] border-2 border-dashed border-[#E2E8F0] rounded-2xl bg-gray-50/50 mb-1 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-[#0B1929] text-sm">Aún no hay planes configurados para este paciente</p>
              <p className="text-[#6B7A8D] mt-0.5">Crea el primer plan para comenzar a estructurar la alimentación y el entrenamiento.</p>
            </div>
            <button
              onClick={openCreatePlan}
              className="mt-1 px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 shadow-sm transition-opacity flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Primer Plan</span>
            </button>
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
                {cicloSel?.id === c.id && !isReadOnly && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditPlan(c); }}
                    title="Editar este plan"
                    className="flex items-center justify-center px-2.5 bg-[var(--brand-primary)] text-white/90 hover:text-white border-y border-r border-white/20 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {cicloSel?.id === c.id && (
                  <button
                    onClick={(e) => eliminarCiclo(c, e)}
                    title="Eliminar este plan"
                    className="flex items-center justify-center px-2.5 bg-[var(--brand-primary)] text-white/80 hover:text-white border-y border-r border-[var(--brand-primary)] rounded-r-xl transition-colors cursor-pointer"
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
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditPlan(c); }}
                            title="Editar este plan"
                            className="flex items-center justify-center px-2.5 bg-[#6B7A8D] text-white/90 hover:text-white border-y border-r border-white/20 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => eliminarCiclo(c, e)}
                            title="Eliminar este plan"
                            className="flex items-center justify-center px-2.5 bg-[#6B7A8D] text-white/80 hover:text-white border-y border-r border-[#6B7A8D] rounded-r-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
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

      {/* ── Solo mostrar herramientas inferiores si existe al menos un plan creado ── */}
      {ciclos.length > 0 && (
        <>
          {/* Subtítulo / Enfoque del plan activo (si existe) */}
          {parsedActiveCycle.enfoque && (
            <div className="mb-4 bg-white rounded-2xl border border-blue-100 p-3.5 sm:px-5 sm:py-3 shadow-2xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand-primary)] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                    Enfoque del {parsedActiveCycle.nombreBase}
                  </span>
                  <h4 className="text-sm font-bold text-[#0B1929] truncate">
                    {parsedActiveCycle.enfoque}
                  </h4>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-[var(--brand-primary)] border border-blue-200/60 shrink-0">
                {parsedActiveCycle.dias} días • {parsedActiveCycle.semanas} sem
              </span>
            </div>
          )}

      {/* ── 🔴 Sub-tabs 🔴 ── */}
      <div className="flex gap-1 mb-4 bg-[#F0F4FA] rounded-xl p-1 w-full sm:w-max overflow-x-auto scroll-hide">
        {[
          { k:"progreso", ic: <BarChart2 className="w-4 h-4 shrink-0"/>, lb:"Evaluación" },
          ...(serviciosActivos.nutricion ? [{ k:"nutri", ic: <Utensils className="w-4 h-4 shrink-0"/>, lb:"Nutrición" }] : []),
          ...(serviciosActivos.entrenamiento ? [{ k:"deporte", ic: <Dumbbell className="w-4 h-4 shrink-0"/>, lb:"Entrenamiento" }] : []),
          { k:"historico", ic: <TrendingUp className="w-4 h-4 shrink-0"/>, lb:"Histórico" },
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
            {/* Sub-pestañas: Programar vs Tracking */}
            <div className="flex gap-1 mb-4 bg-[#F0F4FA] rounded-xl p-1 w-full sm:w-max">
              <button
                type="button"
                onClick={() => setNutriView("programar")}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-[13px] whitespace-nowrap transition-all flex-1 sm:flex-none cursor-pointer ${
                  nutriView === "programar"
                    ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold border border-transparent"
                    : "text-[#6B7A8D] hover:text-[#0B1929] border border-transparent"
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Programar</span>
              </button>
              <button
                type="button"
                onClick={() => setNutriView("tracking")}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-[13px] whitespace-nowrap transition-all flex-1 sm:flex-none cursor-pointer ${
                  nutriView === "tracking"
                    ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold border border-transparent"
                    : "text-[#6B7A8D] hover:text-[#0B1929] border border-transparent"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Tracking</span>
              </button>
            </div>

            {nutriView === "programar" ? (
              <>
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
          </>
        ) : (
          <Suspense fallback={<ListSkeleton rows={4} />}>
            <ProgresoCliente
              selected={selected}
              setMsg={setMsg}
              isMiPlan={isMiPlan}
              mode="nutricion"
              cicloActivo={cicloSel}
              isReadOnly={isReadOnly}
            />
          </Suspense>
        )}
      </div>
    )}

    {/* ── ENTRENAMIENTO ── */}
    {subtab === "deporte" && (
      <div>
        {/* Sub-pestañas: Programar vs Tracking */}
        <div className="flex gap-1 mb-4 bg-[#F0F4FA] rounded-xl p-1 w-full sm:w-max">
          <button
            type="button"
            onClick={() => setEntrenoView("programar")}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-[13px] whitespace-nowrap transition-all flex-1 sm:flex-none cursor-pointer ${
              entrenoView === "programar"
                ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold border border-transparent"
                : "text-[#6B7A8D] hover:text-[#0B1929] border border-transparent"
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Programar</span>
          </button>
          <button
            type="button"
            onClick={() => setEntrenoView("tracking")}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-[13px] whitespace-nowrap transition-all flex-1 sm:flex-none cursor-pointer ${
              entrenoView === "tracking"
                ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold border border-transparent"
                : "text-[#6B7A8D] hover:text-[#0B1929] border border-transparent"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Tracking</span>
          </button>
        </div>

        {entrenoView === "programar" ? (
          <>
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
                  const parts = (r.nombre || "").split('|');
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
                                <span className="font-semibold text-[14px] text-[#0B1929] break-words line-clamp-2">{title || "Sin título"}</span>
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
          </>
        ) : (
          <Suspense fallback={<ListSkeleton rows={4} />}>
            <ProgresoCliente
              selected={selected}
              setMsg={setMsg}
              isMiPlan={isMiPlan}
              mode="rutinas"
              cicloActivo={cicloSel}
              isReadOnly={isReadOnly}
            />
          </Suspense>
        )}
      </div>
    )}

    {subtab === "progreso" && (
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ProgresoCliente
          selected={selected}
          setMsg={setMsg}
          isMiPlan={isMiPlan}
          mode="evaluaciones"
          cicloActivo={cicloSel}
          isReadOnly={isReadOnly}
        />
      </Suspense>
    )}

    {subtab === "historico" && (
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ProgresoCliente
          selected={selected}
          setMsg={setMsg}
          isMiPlan={isMiPlan}
          mode="historico"
          cicloActivo={cicloSel}
          isReadOnly={false}
        />
      </Suspense>
    )}
      </>}
        </>
      )}

      {/* ── Modal Inteligente de Plan (Crear y Editar) ── */}
      {showPlanModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-[#E2E8F0] flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-[#E2E8F0] bg-white">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-[#0B1929] truncate">
                  {planModalMode === "edit"
                    ? `Editar Plan · ${editingCycle?.nombre?.split("|")[0] || ""}`
                    : (ciclos.length === 0 ? "Crear Primer Plan" : "Configuración del Siguiente Plan")}
                </h3>
                <p className="text-xs text-[#6B7A8D] mt-0.5">
                  {planModalMode === "edit"
                    ? "Ajusta la duración, servicios o enfoque de este ciclo."
                    : "Establece el rango de tiempo y servicios para este nuevo ciclo de trabajo."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              
              {/* Aviso de protección de datos si el paciente ya tiene registros en este ciclo */}
              {planModalMode === "edit" && hasPatientData && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-relaxed">
                    <span className="font-bold block text-amber-950">
                      Fecha de inicio bloqueada por seguridad
                    </span>
                    <p className="text-amber-800">
                      Este plan ya inició y tu paciente cuenta con registros de cumplimiento o series registradas. Puedes extender la duración del plan o ajustar servicios, pero la fecha de inicio no se modifica para preservar su historial clínico.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Grid de Fechas y Duración Sincronizada ── */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-[var(--brand-primary)]" />
                  <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                    Temporalidad del Plan
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Fecha de Inicio */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">
                      Fecha de inicio
                    </label>
                    <input
                      type="date"
                      disabled={planModalMode === "edit" && hasPatientData}
                      value={planForm.fecha_inicio}
                      onChange={e => handlePlanStartChange(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-[13px] bg-white transition-all outline-none ${
                        planModalMode === "edit" && hasPatientData
                          ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                          : "border-[#E2E8F0] text-[#0B1929] focus:border-[var(--brand-primary)]"
                      }`}
                    />
                  </div>

                  {/* Fecha de Fin */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">
                      Fecha de fin
                    </label>
                    <input
                      type="date"
                      min={planForm.fecha_inicio}
                      value={planForm.fecha_fin}
                      onChange={e => handlePlanEndChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#0B1929] focus:border-[var(--brand-primary)] outline-none"
                    />
                  </div>

                  {/* Semanas */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">
                      Duración (Semanas)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={planForm.semanas}
                      onChange={e => handlePlanWeeksChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#0B1929] focus:border-[var(--brand-primary)] outline-none font-semibold"
                    />
                  </div>

                  {/* Días */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">
                      Duración (Días totales)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={planForm.dias}
                      onChange={e => handlePlanDaysChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#0B1929] focus:border-[var(--brand-primary)] outline-none font-semibold"
                    />
                  </div>
                </div>

                {/* Resumen de días y semanas */}
                <div className="pt-2 border-t border-gray-200/70 text-xs text-[#6B7A8D] flex items-center justify-between flex-wrap gap-1">
                  <span>
                    Total: <strong className="text-[#0B1929]">{planForm.dias} días</strong> ({planForm.semanas} {planForm.semanas === 1 ? "semana" : "semanas"})
                  </span>
                  <span className="text-[var(--brand-primary)] font-semibold text-[11px]">
                    Rango sincronizado
                  </span>
                </div>
              </div>

              {/* ── Servicios Asignados al Plan ── */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-2">
                  Servicios Activos en este Plan
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Nutrición */}
                  <button
                    type="button"
                    onClick={() => {
                      if (planForm.servicios.nutricion && !planForm.servicios.entrenamiento) return;
                      setPlanForm(p => ({
                        ...p,
                        servicios: { ...p.servicios, nutricion: !p.servicios.nutricion }
                      }));
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                      planForm.servicios.nutricion
                        ? "border-[var(--brand-primary)] bg-blue-50/50 text-[var(--brand-primary)] font-bold shadow-2xs"
                        : "border-[#E2E8F0] bg-white text-[#6B7A8D] hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 shrink-0" />
                      <span className="text-xs">Nutrición</span>
                    </div>
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${
                      planForm.servicios.nutricion
                        ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white"
                        : "border-gray-300 bg-white"
                    }`}>
                      {planForm.servicios.nutricion && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Entrenamiento */}
                  <button
                    type="button"
                    onClick={() => {
                      if (planForm.servicios.entrenamiento && !planForm.servicios.nutricion) return;
                      setPlanForm(p => ({
                        ...p,
                        servicios: { ...p.servicios, entrenamiento: !p.servicios.entrenamiento }
                      }));
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                      planForm.servicios.entrenamiento
                        ? "border-[var(--brand-primary)] bg-blue-50/50 text-[var(--brand-primary)] font-bold shadow-2xs"
                        : "border-[#E2E8F0] bg-white text-[#6B7A8D] hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Dumbbell className="w-4 h-4 shrink-0" />
                      <span className="text-xs">Entrenamiento</span>
                    </div>
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${
                      planForm.servicios.entrenamiento
                        ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white"
                        : "border-gray-300 bg-white"
                    }`}>
                      {planForm.servicios.entrenamiento && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                </div>
                <p className="text-[11px] text-[#6B7A8D] mt-1.5">
                  Define si este ciclo incluirá pauta de comidas, plan de ejercicios o ambos.
                </p>
              </div>

              {/* ── Subtítulo / Enfoque del Plan (Opcional) ── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                    Enfoque o Subtítulo del Plan
                  </label>
                  <span className="text-[10px] text-[#6B7A8D] font-medium lowercase">
                    (opcional)
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Ej. Fase 1: Déficit y Adaptación, Recomposición..."
                  value={planForm.enfoque}
                  onChange={e => setPlanForm(p => ({ ...p, enfoque: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#0B1929] focus:border-[var(--brand-primary)] outline-none placeholder:text-gray-400"
                />
                <p className="text-[11px] text-[#6B7A8D] mt-1">
                  Se mostrará como título destacado de este ciclo arriba de las herramientas.
                </p>
              </div>

              {/* ── Opción de Clonar Plan Anterior (Solo en modo creación si ya existen planes) ── */}
              {planModalMode === "create" && ciclos.length > 0 && (
                <div
                  onClick={() => setPlanForm(p => ({ ...p, clonarAnterior: !p.clonarAnterior }))}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    planForm.clonarAnterior
                      ? "bg-indigo-50/50 border-indigo-200 text-indigo-950 shadow-2xs"
                      : "bg-gray-50/60 border-[#E2E8F0] text-[#6B7A8D]"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center border shrink-0 ${
                    planForm.clonarAnterior
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}>
                    {planForm.clonarAnterior && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block text-[#0B1929]">
                      Clonar comidas y rutinas del plan anterior
                    </span>
                    <span className="text-[11px] text-[#6B7A8D] leading-tight block mt-0.5">
                      Copia la estructura del ciclo previo como base de trabajo para que no tengas que empezar desde cero. Si lo desmarcas, arranca en blanco.
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex justify-end gap-2.5 bg-white">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors text-xs sm:text-[13px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={savePlan}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white font-bold hover:opacity-90 transition-opacity text-xs sm:text-[13px] shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {saving
                  ? (planModalMode === "edit" ? "Guardando..." : "Creando...")
                  : (planModalMode === "edit" ? "Guardar Cambios" : (ciclos.length === 0 ? "Crear Primer Plan" : "Iniciar Siguiente Plan"))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor de Día a Pantalla Completa (Master-Detail) ── */}
      {showDiaModal && (() => {
        const totKcal = diaForm.comidas.reduce((s, c) => s + (Number(c.calorias) || 0), 0);
        const totProt = diaForm.comidas.reduce((s, c) => s + (Number(c.proteina) || 0), 0);
        const totCarbs = diaForm.comidas.reduce((s, c) => s + (Number(c.carbohidratos) || 0), 0);
        const totFat = diaForm.comidas.reduce((s, c) => s + (Number(c.grasas) || 0), 0);
        const metaKcal = Number(macros.calorias) || 0;
        const metaProt = Number(macros.proteina) || 0;
        const metaCarbs = Number(macros.carbohidratos) || 0;
        const metaFat = Number(macros.grasas) || 0;

        return (
          <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col overflow-y-auto animate-in fade-in duration-150">
            {/* Top Sticky Bar */}
            <div className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-3 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <button 
                  type="button"
                  onClick={() => setShowDiaModal(false)}
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6B7A8D] hover:text-[#0B1929] transition-colors py-1.5 px-2.5 sm:px-3 rounded-xl hover:bg-gray-100 shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver</span>
                </button>
                <span className="text-[#CBD5E1] hidden sm:inline">|</span>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-[#0B1929] truncate">
                    {editDia ? `Editar Día: ${diaForm.diasSeleccionados?.join(', ') || diaForm.dia?.split('|')?.[0] || 'Día'}` : "Nuevo Día de Nutrición"}
                  </h2>
                  <div className="text-[11px] text-[#6B7A8D] hidden sm:block truncate">
                    {selected?.nombre} • {cicloSel?.nombre?.split('|')?.[0] || 'Plan'}
                  </div>
                </div>
              </div>

              {/* Live Macros Comparison / Badge in Sticky Bar */}
              <div className="hidden lg:flex items-center gap-3 bg-[#F0F4FA] border border-[#E2E8F0] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0B1929]">
                <span className="text-[#6B7A8D] font-normal">Total acumulado:</span>
                <span className="font-extrabold text-[var(--brand-primary)]">
                  {totKcal} {metaKcal > 0 ? `/ ${metaKcal}` : ''} Kcal
                </span>
                <span>•</span>
                <span>{totProt}g P</span>
                <span>{totCarbs}g C</span>
                <span>{totFat}g G</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowDiaModal(false)}
                  className="hidden sm:inline-flex px-3.5 py-2 rounded-xl border border-[#E2E8F0] text-xs sm:text-sm font-semibold text-[#6B7A8D] hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={saveDia} 
                  disabled={saving}
                  className="px-3.5 sm:px-5 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Guardando…" : "Guardar día"}</span>
                </button>
              </div>
            </div>

            {/* Mobile Sticky Macro Summary Strip */}
            <div className="lg:hidden sticky top-[53px] z-20 bg-[#F0F4FA]/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 py-2 flex items-center justify-between gap-2 text-xs shadow-2xs">
              <span className="font-semibold text-[#6B7A8D]">Acumulado:</span>
              <div className="flex items-center gap-2.5 font-bold text-[#0B1929]">
                <span className="text-[var(--brand-primary)]">{totKcal}{metaKcal > 0 ? `/${metaKcal}` : ''} Kcal</span>
                <span>•</span>
                <span>{totProt}g P</span>
                <span>{totCarbs}g C</span>
                <span>{totFat}g G</span>
              </div>
            </div>

            {/* Main Content Area: 2-Column Split on Desktop */}
            <div className="max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column (Sticky on Desktop): Configuración del Día + Balance de Macros */}
              <div className="lg:col-span-4 lg:sticky lg:top-20 flex flex-col gap-5">
                {/* Card 1: Configuración del Día */}
                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--brand-primary)]" />
                    Programación del Día
                  </h3>

                  {!editDia && historialDias.length > 0 && !isEstandar && (
                    <div className="mb-5 pb-5 border-b border-[#F0F4FA]">
                      <div className="text-xs font-semibold text-[#6B7A8D] mb-1.5 uppercase tracking-wider">Importar desde Historial</div>
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
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">Día(s) de la semana asignado(s)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {["LUN","MAR","MIE","JUE","VIE","SAB","DOM"].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setDiaForm(p => ({
                                ...p,
                                diasSeleccionados: editDia ? [d] : (p.diasSeleccionados?.includes(d) 
                                  ? p.diasSeleccionados.filter(x => x !== d) 
                                  : [...(p.diasSeleccionados || []), d])
                              }));
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                              diaForm.diasSeleccionados?.includes(d) 
                                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm' 
                                : 'bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Título o Nota del Día (Opcional)</label>
                      <input 
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] transition-colors" 
                        value={diaForm.tituloPersonalizado || ""} 
                        onChange={e => setDiaForm(p => ({ ...p, tituloPersonalizado: e.target.value }))} 
                        placeholder="Ej. Día Alto en Carbos, Entreno..." 
                      />
                    </div>
                  </div>
                </div>

                {/* Desktop Live Macro Balance Card */}
                <div className="hidden lg:block bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                      Balance de Macros del Día
                    </h4>
                    <span className="text-[11px] font-semibold text-[#6B7A8D]">{diaForm.comidas.length} tomas</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Calorías", val: totKcal, meta: metaKcal, unit: "kcal", color: "bg-[var(--brand-primary)]" },
                      { label: "Proteína", val: totProt, meta: metaProt, unit: "g", color: "bg-blue-500" },
                      { label: "Carbohidratos", val: totCarbs, meta: metaCarbs, unit: "g", color: "bg-emerald-500" },
                      { label: "Grasas", val: totFat, meta: metaFat, unit: "g", color: "bg-amber-500" },
                    ].map((m) => {
                      const pct = m.meta > 0 ? Math.min(100, Math.round((m.val / m.meta) * 100)) : 0;
                      const over = m.meta > 0 && m.val > m.meta * 1.05;
                      return (
                        <div key={m.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold text-[#6B7A8D]">{m.label}</span>
                            <span className={`font-bold ${over ? 'text-amber-600' : 'text-[#0B1929]'}`}>
                              {m.val}{m.meta > 0 ? ` / ${m.meta}` : ''} {m.unit}
                            </span>
                          </div>
                          {m.meta > 0 && (
                            <div className="w-full h-1.5 bg-[#F0F4FA] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : m.color}`} style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Lista de Comidas */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-[var(--brand-primary)]" />
                      Comidas y Distribución ({diaForm.comidas.length})
                    </h3>
                    <p className="text-xs text-[#6B7A8D] mt-0.5">Arrastra desde el icono izquierdo para reordenar las tomas</p>
                  </div>
                  <button 
                    type="button"
                    onClick={addComida}
                    className="text-xs flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--brand-primary)]/40 bg-blue-50/50 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white transition-all font-bold shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Comida</span>
                  </button>
                </div>

                {diaForm.comidas.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-[#E2E8F0] rounded-2xl bg-gray-50/50">
                    <Utensils className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                    <p className="text-sm font-semibold text-[#0B1929]">No hay comidas en este día</p>
                    <p className="text-xs text-[#6B7A8D] mb-4">Agrega la primera comida para comenzar a diseñar el menú</p>
                    <button 
                      type="button"
                      onClick={addComida}
                      className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      + Agregar Comida
                    </button>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndComidas}>
                    <SortableContext items={diaForm.comidas.map(c => String(c._dndId))} strategy={verticalListSortingStrategy}>
                      <div className="space-y-4">
                        {diaForm.comidas.map((c, i) => (
                          <SortableItem key={c._dndId} id={c._dndId}>
                            {({ dragHandle, isDragging }) => (
                              <div className={`bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 transition-all ${isDragging ? 'shadow-lg ring-2 ring-[var(--brand-primary)]/20 bg-white' : ''}`}>
                                <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-2.5">
                                    {dragHandle}
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-white border border-[#E2E8F0] text-[#0B1929]">
                                      Comida {i + 1}
                                    </span>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => remComida(i)} 
                                    className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                                    title="Eliminar comida"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Hora sugerida</label>
                                    <input 
                                      className="w-full px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]" 
                                      value={c.hora} 
                                      onChange={e => updComida(i, "hora", e.target.value)} 
                                      placeholder="Ej. 8:00 AM" 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre de la toma</label>
                                    <input 
                                      className="w-full px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]" 
                                      value={c.nombre} 
                                      onChange={e => updComida(i, "nombre", e.target.value)} 
                                      placeholder="Ej. Desayuno, Pre-entreno, Cena..." 
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Opción Principal</label>
                                    <textarea 
                                      className="w-full px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] min-h-[76px]" 
                                      value={c.opcion1} 
                                      onChange={e => updComida(i, "opcion1", e.target.value)} 
                                      placeholder="Ingredientes, porciones, preparación..." 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Opción Alternativa (Opcional)</label>
                                    <textarea 
                                      className="w-full px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] min-h-[76px]" 
                                      value={c.opcion2} 
                                      onChange={e => updComida(i, "opcion2", e.target.value)} 
                                      placeholder="Alternativa equivalente..." 
                                    />
                                  </div>
                                </div>

                                {/* Photo upload */}
                                <div className="mb-3.5 p-3 bg-white rounded-xl border border-[#E2E8F0]">
                                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">Foto de referencia visual</label>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    {c.foto_url && (
                                      <CachedImage src={c.foto_url} alt="referencia" className="w-16 h-16 object-cover rounded-xl border border-[#E2E8F0]" />
                                    )}
                                    <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-[var(--brand-primary)] rounded-xl text-[var(--brand-primary)] text-xs font-bold cursor-pointer hover:bg-[var(--brand-primary)]/5 transition-colors">
                                      <ImageIcon className="w-4 h-4" />
                                      <span>{c.foto_url ? "Cambiar foto" : "Subir foto ilustrativa"}</span>
                                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(i, e)} disabled={saving} />
                                    </label>
                                    {c.foto_url && (
                                      <button type="button" onClick={() => updComida(i, "foto_url", "")} className="text-red-400 hover:text-red-600 p-2 text-xs font-semibold flex items-center gap-1">
                                        <Trash2 className="w-3.5 h-3.5" /> Quitar
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Macros per meal */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                  {[["calorias","Calorías (Kcal)"], ["proteina","Proteína (g)"], ["carbohidratos","Carbos (g)"], ["grasas","Grasas (g)"]].map(([f, lb]) => (
                                    <div key={f} className="bg-white p-2.5 rounded-xl border border-[#E2E8F0]">
                                      <label className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1 truncate">{lb}</label>
                                      <input 
                                        type="number" 
                                        className="w-full px-2 py-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-bold text-[#0B1929] text-center focus:outline-none focus:border-[var(--brand-primary)]" 
                                        value={c[f]} 
                                        onChange={e => updComida(i, f, e.target.value)} 
                                        placeholder="0" 
                                      />
                                    </div>
                                  ))}
                                </div>

                              </div>
                            )}
                          </SortableItem>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                {diaForm.comidas.length > 0 && (
                  <div className="mt-5 flex justify-end">
                    <button 
                      type="button"
                      onClick={addComida}
                      className="text-xs flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[#0B1929] hover:bg-gray-50 transition-colors font-bold shadow-2xs"
                    >
                      <Plus className="w-4 h-4 text-[var(--brand-primary)]" />
                      <span>Agregar otra comida</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Editor de Rutina a Pantalla Completa (Master-Detail) ── */}
      {showRutinaModal && (
        <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col overflow-y-auto animate-in fade-in duration-150">
          {/* Top Sticky Bar */}
          <div className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-3 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button 
                type="button"
                onClick={() => { setShowRutinaModal(false); setActiveAltSlot(null); }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6B7A8D] hover:text-[#0B1929] transition-colors py-1.5 px-2.5 sm:px-3 rounded-xl hover:bg-gray-100 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>
              <span className="text-[#CBD5E1] hidden sm:inline">|</span>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-[#0B1929] truncate">
                  {editRutina ? `Editar: ${editRutina.nombre?.split('|')?.slice(1)?.join('|') || editRutina.nombre}` : "Nueva Rutina de Entrenamiento"}
                </h2>
                <div className="text-[11px] text-[#6B7A8D] hidden sm:block truncate">
                  {selected?.nombre} • {cicloSel?.nombre?.split('|')?.[0] || 'Plan'}
                </div>
              </div>
            </div>

            {/* Quick stats in Sticky Bar */}
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-[#6B7A8D]">
              <span className="px-3 py-1 bg-[#F0F4FA] rounded-xl text-[#0B1929] font-bold">
                {rutinaForm.ejercicios.length} ejercicios programados
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={() => { setShowRutinaModal(false); setActiveAltSlot(null); }}
                className="hidden sm:inline-flex px-3.5 py-2 rounded-xl border border-[#E2E8F0] text-xs sm:text-sm font-semibold text-[#6B7A8D] hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={saveRutina} 
                disabled={saving}
                className="px-3.5 sm:px-5 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Guardando…" : "Guardar rutina"}</span>
              </button>
            </div>
          </div>

          {/* Main Content Area: 2-Column Split on Desktop */}
          <div className="max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Left Column (Sticky on Desktop): Configuración + Catálogo de Ejercicios */}
            <div className="lg:col-span-5 lg:sticky lg:top-20 flex flex-col gap-5">
              {/* Card 1: Configuración de la Rutina */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
                <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--brand-primary)]" />
                  Programación de la Rutina
                </h3>

                {!editRutina && historialRutinas.length > 0 && !isEstandar && (
                  <div className="mb-5 pb-5 border-b border-[#F0F4FA]">
                    <div className="text-xs font-semibold text-[#6B7A8D] mb-1.5 uppercase tracking-wider">Importar desde Historial</div>
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
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">Día(s) de la semana asignado(s)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {["LUN","MAR","MIE","JUE","VIE","SAB","DOM"].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setRutinaForm(p => ({
                              ...p,
                              diasSeleccionados: editRutina ? [d] : (p.diasSeleccionados?.includes(d) 
                                ? p.diasSeleccionados.filter(x => x !== d) 
                                : [...(p.diasSeleccionados || []), d])
                            }));
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                            rutinaForm.diasSeleccionados?.includes(d) 
                              ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm' 
                              : 'bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Título de la Rutina</label>
                    <input 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] transition-colors" 
                      value={rutinaForm.tituloPersonalizado || ""} 
                      onChange={e => setRutinaForm(p => ({ ...p, tituloPersonalizado: e.target.value }))} 
                      placeholder="Ej. Torso Pesado, Pierna / Glúteo, Empuje..." 
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Selector del Catálogo */}
              <div ref={catalogRef} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${activeAltSlot !== null ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[#E2E8F0]'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-[var(--brand-primary)]" />
                    Catálogo de Ejercicios
                  </h3>
                  {activeAltSlot !== null && rutinaForm.ejercicios[activeAltSlot] && (
                    <button
                      type="button"
                      onClick={() => setActiveAltSlot(null)}
                      className="text-[11px] font-bold text-red-500 hover:text-red-700 px-2 py-0.5 rounded-lg bg-red-50"
                    >
                      Cancelar alternativa
                    </button>
                  )}
                </div>
                {activeAltSlot !== null && rutinaForm.ejercicios[activeAltSlot] ? (
                  <div className="mb-3 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 flex items-center justify-between gap-2">
                    <span>Elige del catálogo la alternativa para: <strong>{rutinaForm.ejercicios[activeAltSlot].nombre}</strong></span>
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7A8D] mb-3.5">Haz clic en un ejercicio para añadirlo a la rutina</p>
                )}
                <EjercicioSelector biblioteca={biblioteca} onSelect={addEj} selected={rutinaForm.ejercicios}/>
              </div>
            </div>

            {/* Right Column: Ejercicios Programados & Alternativas */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider">
                    Ejercicios Asignados ({rutinaForm.ejercicios.length})
                  </h3>
                  <p className="text-xs text-[#6B7A8D] mt-0.5">Arrastra para reordenar o pulsa (+) en un ejercicio para asignarle hasta 2 alternativas</p>
                </div>
              </div>

              {rutinaForm.ejercicios.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[#E2E8F0] rounded-2xl bg-gray-50/50">
                  <Dumbbell className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#0B1929]">No hay ejercicios seleccionados</p>
                  <p className="text-xs text-[#6B7A8D]">Utiliza el catálogo de ejercicios para armar la sesión</p>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="hidden sm:grid grid-cols-[24px_40px_1fr_65px_65px_80px_70px] gap-1.5 mb-2 items-center px-1">
                    <span/><span/><span className="text-[11px] text-[#6B7A8D] font-bold uppercase tracking-wider">EJERCICIO</span>
                    <span className="text-[11px] text-[#6B7A8D] font-bold uppercase tracking-wider text-center">SERIES</span>
                    <span className="text-[11px] text-[#6B7A8D] font-bold uppercase tracking-wider text-center">REPS</span>
                    <span className="text-[11px] text-[#6B7A8D] font-bold uppercase tracking-wider text-center">PESO</span>
                    <span/>
                  </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndEjercicios}>
                      <SortableContext items={rutinaForm.ejercicios.map(e => String(e._dndId))} strategy={verticalListSortingStrategy}>
                        {rutinaForm.ejercicios.map((e, i) => (
                          <SortableItem key={e._dndId} id={e._dndId}>
                            {({ dragHandle, isDragging }) => (
                              <div className={`mb-2.5 sm:mb-2 p-2.5 sm:p-2 bg-[#F8FAFC] sm:bg-transparent rounded-xl sm:rounded-lg border sm:border-b sm:border-t-0 sm:border-x-0 ${isDragging ? 'bg-white shadow-md border-[#E2E8F0] z-10' : 'border-[#E2E8F0]'}`}>
                                {/* MAIN EXERCISE */}
                                <div className={`grid grid-cols-[24px_40px_1fr_auto] sm:grid-cols-[24px_40px_1fr_65px_65px_80px_70px] gap-2 sm:gap-1.5 items-center`}>
                                  <div className="flex items-center justify-center">{dragHandle}</div>
                                  <div className="w-9 h-9 rounded-md overflow-hidden bg-white sm:bg-gray-50 border border-[#E2E8F0] flex items-center justify-center shrink-0">
                                    {e.gif_url ? <img src={e.gif_url} alt="" className="w-full h-full object-cover"/> : <Dumbbell className="w-[18px] h-[18px] text-[#6B7A8D]" />}
                                  </div>
                                  <div className="text-[13px] font-semibold text-[#0B1929] leading-tight min-w-0 pr-1">
                                    <div className="truncate">{e.nombre}</div>
                                    <span className="text-[10px] text-[#6B7A8D] font-normal">{e.grupo_muscular}</span>
                                  </div>
                                  
                                  <div className="col-span-4 sm:col-span-3 sm:col-start-4 sm:row-start-1 grid grid-cols-3 gap-2 sm:grid-cols-[65px_65px_80px] sm:gap-1.5 mt-1.5 sm:mt-0 pt-2 sm:pt-0 border-t border-[#E2E8F0] sm:border-none">
                                    <div className="flex flex-col gap-0.5 sm:block">
                                      <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">SERIES</span>
                                      <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-semibold text-center" value={e.num_series} onChange={ev=>updEj(i,"num_series",ev.target.value)} placeholder="4" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 sm:block">
                                      <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">REPS</span>
                                      <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-semibold text-center" value={e.reps_sugeridas} onChange={ev=>updEj(i,"reps_sugeridas",ev.target.value)} placeholder="10" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 sm:block">
                                      <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">PESO</span>
                                      <div className="relative w-full">
                                        <input type="text" inputMode="decimal" className="w-full pl-2 pr-6 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-semibold text-center" value={e.peso_sugerido||""} onChange={ev=>updEj(i,"peso_sugerido",ev.target.value)} placeholder="-" />
                                        <button type="button" onClick={() => toggleUnidad(i)} className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#6B7A8D] uppercase hover:text-[#0B1929]">{e.unidad || 'KG'}</button>
                                      </div>
                                    </div>
                                  </div>
                            
                                  <div className="col-start-4 row-start-1 sm:col-start-7 sm:row-start-1 flex items-center justify-end gap-1 self-center">
                                    {(e.alternativas || []).length < 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextSlot = activeAltSlot === i ? null : i;
                                          setActiveAltSlot(nextSlot);
                                          if (nextSlot !== null && typeof window !== "undefined" && window.innerWidth < 1024) {
                                            catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                                          }
                                        }}
                                        className={`p-1.5 rounded-lg flex items-center justify-center transition-colors border-none ${activeAltSlot === i ? 'bg-[var(--brand-primary)] text-white shadow-2xs' : 'bg-gray-100 text-[#6B7A8D] hover:bg-gray-200'}`}
                                        title="Añadir ejercicio alternativo"
                                      >
                                        <Plus className="w-[14px] h-[14px]" />
                                      </button>
                                    )}
                                    <button type="button" onClick={() => remEj(i)} className="bg-red-50 text-red-500 rounded-lg p-1.5 hover:bg-red-100 flex items-center justify-center transition-colors border-none" title="Eliminar ejercicio">
                                      <Trash2 className="w-[14px] h-[14px]" />
                                    </button>
                                  </div>
                                </div>
                            
                                {/* ACTIVE ALT SLOT INDICATOR */}
                                {activeAltSlot === i && (
                                  <div className="mt-2 sm:ml-[64px] p-2.5 border-2 border-dashed border-[var(--brand-primary)] rounded-xl bg-blue-50/70 flex items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-[#0B1929]">
                                      Selecciona un ejercicio del catálogo para añadirlo como alternativa de <span className="text-[var(--brand-primary)]">{e.nombre}</span>
                                    </div>
                                    <button type="button" onClick={() => setActiveAltSlot(null)} className="text-[11px] font-bold text-[#6B7A8D] hover:text-[#0B1929] px-2 py-1 rounded bg-white border border-[#E2E8F0] shrink-0">
                                      Cancelar
                                    </button>
                                  </div>
                                )}
                            
                                {/* ALTERNATIVES */}
                                {(e.alternativas || []).map((alt, altIdx) => (
                                  <div key={`alt-${altIdx}`} className="mt-2 ml-3 sm:ml-[64px] grid grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_1fr_65px_80px_36px] gap-2 sm:gap-1.5 items-center p-2 sm:py-1.5 sm:px-2 bg-white sm:bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                                    <div className="w-7 h-7 rounded-md overflow-hidden bg-gray-50 border border-[#E2E8F0] flex items-center justify-center shrink-0">
                                      {alt.gif_url ? <img src={alt.gif_url} alt="" className="w-full h-full object-cover"/> : <Dumbbell className="w-[14px] h-[14px] text-[#6B7A8D]" />}
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="px-1.5 py-0.5 bg-blue-50 text-[var(--brand-primary)] border border-blue-200 rounded text-[9px] font-bold shrink-0">ALT {altIdx + 1}</span>
                                      <span className="text-[12px] font-medium text-[#0B1929] leading-tight truncate">{alt.nombre}</span>
                                    </div>
                                    
                                    <div className="col-span-3 sm:col-span-2 sm:col-start-3 sm:row-start-1 grid grid-cols-2 gap-2 sm:grid-cols-[65px_80px] sm:gap-1.5 mt-1 sm:mt-0 pt-1.5 sm:pt-0 border-t border-[#E2E8F0] sm:border-none">
                                      <div className="flex flex-col gap-0.5 sm:block">
                                        <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">REPS</span>
                                        <input type="number" className="w-full px-2 py-1 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-semibold text-center" value={alt.reps_sugeridas} onChange={ev=>updAlt(i,altIdx,"reps_sugeridas",ev.target.value)} placeholder="10" />
                                      </div>
                                      <div className="flex flex-col gap-0.5 sm:block">
                                        <span className="text-[10px] font-semibold text-[#6B7A8D] sm:hidden text-center w-full">PESO</span>
                                        <div className="relative w-full">
                                          <input type="text" inputMode="decimal" className="w-full pl-2 pr-6 py-1 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-semibold text-center" value={alt.peso_sugerido||""} onChange={ev=>updAlt(i,altIdx,"peso_sugerido",ev.target.value)} placeholder="-" />
                                          <button type="button" onClick={() => toggleUnidadAlt(i, altIdx)} className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#6B7A8D] uppercase hover:text-[#0B1929]">{alt.unidad || 'KG'}</button>
                                        </div>
                                      </div>
                                    </div>
                            
                                    <div className="col-start-3 row-start-1 sm:col-start-5 sm:row-start-1 flex items-center justify-end self-center">
                                      <button type="button" onClick={() => remAlt(i, altIdx)} className="bg-red-50 text-red-500 rounded-lg p-1.5 hover:bg-red-100 flex items-center justify-center transition-colors border-none" title="Quitar alternativa">
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

      {/* ── Expediente Clínico Integral ── */}
      {showExpediente && selected && (
        <ExpedienteClinicoModal
          cliente={selected}
          isOpen={showExpediente}
          onClose={() => setShowExpediente(false)}
          onSaved={(savedRec, updatedClient) => {
            setClinicalRec(savedRec);
            if (updatedClient) {
              setSelected((prev) => ({ ...prev, ...updatedClient }));
            }
            setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Expediente clínico guardado</div>);
          }}
        />
      )}

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
