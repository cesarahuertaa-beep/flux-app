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
import { RefreshCw, ChevronDown, Trash2, Calendar, Activity, CheckCircle2, AlertCircle, ShieldAlert, AlertTriangle, Save, Edit2, Plus, Search, FileText, Download, Lock, X, Utensils, Dumbbell, BarChart2, Camera, Image as ImageIcon, Bookmark, Calculator, ArrowLeft, User, Check, ClipboardList, RotateCcw, MessageCircle, Copy, TrendingUp, Sparkles, Flame, Target, Droplets, Pill, Clock, Loader2 } from "lucide-react";
import { EjercicioSelector } from "./EjercicioSelector";
import { ConfirmModal } from "../ui/ConfirmModal";
import { CustomSelect } from "../ui/CustomSelect";
import { generateNutriPDF } from "../../utils/pdf";
import { dbPeek, dbGet, dbGetFresh, dbPost, dbPatch, dbDel, dbUpsert, storageUpload, updateQueryCache, invalidateCache } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { useBackButton } from "../../lib/backButtonHandler";
import { CachedImage } from "../../lib/mediaCache";
import { calcEdadFromBirthdate, normalizeSexo, enrichMetrica, linkMetricasToCiclos, generateSmartMacroPrescription, generateSmartTrainingPrescription } from "../../lib/bodyComposition";
import { peekClinicalRecord, fetchClinicalRecord, saveClinicalRecord, hasAnamnesisData, EMPTY_ANAMNESIS } from "../../lib/clinicalRecord";
import { parseMealOptions, formatMealOptions, parseDiaMetadata, formatDiaMetadata } from "../../lib/mealOptions";
import { optimizeMealWithAi, generateAlternativeMealWithAi, generateMealFromPantryWithAi, generateDishFromIngredientsWithAi, auditFullDayWithAi } from "../../lib/clinicalAi";
import { buscarIngredientes, CATEGORIAS_INGREDIENTES, INGREDIENTES_CATALOGO } from "../../lib/ingredientsCatalog";
import { searchDishPhotoInCatalog, registerDishPhotoInCatalog, CATALOGO_PLATILLOS_BASE, CATEGORIAS_PLATILLOS, buscarPlatillosCatalogo } from "../../lib/foodPhotoCatalog";

import { ProgresoCliente } from "./ProgresoCliente";
import TemplatesManagerModal from "../ui/TemplatesManagerModal";
import MacroCalculatorModal from "../clinical/MacroCalculatorModal";
import ExpedienteClinicoModal from "../clinical/ExpedienteClinicoModal";
import NuevoExpedienteForms from "../clinical/NuevoExpedienteForms";
import ClinicalAiSummaryCard from "../clinical/ClinicalAiSummaryCard";
import ProgresoHistoricoModal from "./ProgresoHistoricoModal";

const sanitizeWhatsAppPhone = (phone) => {
  if (!phone) return "";
  let clean = String(phone).replace(/\D/g, "");
  if (clean.length === 10) clean = "52" + clean;
  return clean;
};


const HORAS_ESTANDAR_AM_PM = [
  "05:00 AM", "05:30 AM", "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM",
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM",
  "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
  "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM",
  "11:00 PM", "11:30 PM", "12:00 AM"
];

const isOfflineError = (e) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!e) return false;
  const m = (e.message || String(e)).toLowerCase();
  return m.includes("offline") || m.includes("failed to fetch") || m.includes("network") || m.includes("aborted");
};

// ── Helpers de Tiempos y Ciclos ──
const fmtDate = (d) => {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  } catch {
    return d;
  }
};

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

export function ProgramarCliente({ clientes, selected, setSelected, onBackToList, setMsg, biblioteca, isMiPlan }) {
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
  const isReadOnly = Boolean(cicloSel && !cicloSel.activo);
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
  const [diaForm, setDiaForm] = useState({ dia:"", orden:0, comidas:[], aguaLitros:"", suplementos:"" });
  const [aiOptimizingIndex, setAiOptimizingIndex] = useState(null);
  const [isAuditingDay, setIsAuditingDay] = useState(false);
  const [dayAuditResult, setDayAuditResult] = useState(null);
  const [aiGeneratingDishIndex, setAiGeneratingDishIndex] = useState(null);
  const [ingredientSearchMap, setIngredientSearchMap] = useState({});
  const [ingredientCatMap, setIngredientCatMap] = useState({});
  const [dishCatalogOpenMap, setDishCatalogOpenMap] = useState({});
  const [dishCatalogSearchMap, setDishCatalogSearchMap] = useState({});
  const [dishCatalogCatMap, setDishCatalogCatMap] = useState({});

  const [aiGeneratingDishMap, setAiGeneratingDishMap] = useState({});

  const handleSelectDishFromCatalog = (mealIdx, dish, optIdx = 0) => {
    const optKey = `${mealIdx}_${optIdx}`;
    setDiaForm(p => {
      const cs = [...p.comidas];
      const c = { ...cs[mealIdx] };
      const recipeText = dish.texto || dish.nombre;
      const opts = [...(c.opciones && c.opciones.length > 0 ? c.opciones : [c.opcion1 || ""])];
      while (opts.length <= optIdx) opts.push("");
      opts[optIdx] = recipeText;
      c.opciones = opts;
      if (optIdx === 0) {
        c.opcion1 = recipeText;
        if (dish.foto_url) c.foto_url = dish.foto_url;
        if (dish.calorias) c.calorias = dish.calorias;
        if (dish.proteina) c.proteina = dish.proteina;
        if (dish.carbohidratos) c.carbohidratos = dish.carbohidratos;
        if (dish.grasas) c.grasas = dish.grasas;
        c.modoEdicion = "platillo";
      }
      c.opcionesModoEdicion = {
        ...(c.opcionesModoEdicion || {}),
        [optIdx]: "platillo",
      };
      cs[mealIdx] = c;
      return { ...p, comidas: cs };
    });
    setDishCatalogOpenMap(prev => ({ ...prev, [optKey]: false, [mealIdx]: false }));
    const optLetter = String.fromCharCode(65 + optIdx);
    setMsg(
      <div className="flex items-center gap-1.5 text-purple-700">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <span>Platillo "{dish.nombre}" cargado en Opción {optLetter}.</span>
      </div>
    );
  };

  const toggleIngrediente = (mealIdx, ingredienteNombre, optIdx = 0) => {
    setDiaForm(p => {
      const cs = [...p.comidas];
      const c = { ...cs[mealIdx] };
      const currentList = optIdx === 0
        ? (c.ingredientesSeleccionados || [])
        : (c.opcionesIngredientes?.[optIdx] || []);
      const list = [...currentList];
      const exists = list.includes(ingredienteNombre);
      if (exists) {
        const filtered = list.filter(x => x !== ingredienteNombre);
        if (optIdx === 0) c.ingredientesSeleccionados = filtered;
        c.opcionesIngredientes = { ...(c.opcionesIngredientes || {}), [optIdx]: filtered };
      } else {
        const appended = [...list, ingredienteNombre];
        if (optIdx === 0) c.ingredientesSeleccionados = appended;
        c.opcionesIngredientes = { ...(c.opcionesIngredientes || {}), [optIdx]: appended };
      }
      cs[mealIdx] = c;
      return { ...p, comidas: cs };
    });
  };

  const clearIngredientes = (mealIdx, optIdx = 0) => {
    setDiaForm(p => {
      const cs = [...p.comidas];
      const c = { ...cs[mealIdx] };
      if (optIdx === 0) {
        c.ingredientesSeleccionados = [];
      }
      c.opcionesIngredientes = {
        ...(c.opcionesIngredientes || {}),
        [optIdx]: [],
      };
      cs[mealIdx] = c;
      return { ...p, comidas: cs };
    });
  };

  const setMealOptionMode = (mealIdx, optIdx, mode) => {
    setDiaForm(p => {
      const cs = [...p.comidas];
      const c = { ...cs[mealIdx] };
      if (optIdx === 0) {
        c.modoEdicion = mode;
      }
      c.opcionesModoEdicion = {
        ...(c.opcionesModoEdicion || {}),
        [optIdx]: mode,
      };
      cs[mealIdx] = c;
      return { ...p, comidas: cs };
    });
  };

  const handleGenerateDishFromIngredients = async (mealIdx, optIdx = 0) => {
    const meal = diaForm.comidas[mealIdx];
    const items = optIdx === 0
      ? (meal?.ingredientesSeleccionados || [])
      : (meal?.opcionesIngredientes?.[optIdx] || []);
    if (items.length === 0) {
      alert("Selecciona al menos 2 ingredientes marcando sus casillas para generar un platillo.");
      return;
    }
    const optKey = `${mealIdx}_${optIdx}`;
    setAiGeneratingDishMap(prev => ({ ...prev, [optKey]: true }));
    setAiGeneratingDishIndex(mealIdx);
    try {
      const metaKcal = Number(macros.calorias) || smartPrescription?.targetKcal || 0;
      const otherMealsKcal = diaForm.comidas.reduce((sum, item, idx) => idx !== mealIdx ? sum + (Number(item.calorias) || 0) : sum, 0);
      const remainingForDay = Math.max(0, metaKcal - otherMealsKcal);

      // Prioridad 1: Calorías definidas por el nutriólogo para esta toma específica
      let targetKcal = Number(meal?.calorias) || 0;
      if (targetKcal <= 0) {
        // Prioridad 2: Si el nutriólogo aún no definió calorías, calcular para una comida estándar (NUNCA el 100% del día)
        const numComidasEstimadas = Math.max(diaForm.comidas.length, 3);
        const porcionEstimada = metaKcal > 0 ? Math.round(metaKcal / numComidasEstimadas) : 500;
        targetKcal = Math.min(porcionEstimada, remainingForDay > 0 ? remainingForDay : 550);
        if (targetKcal <= 0) targetKcal = 500;
      }

      // Calcular macros proporcionales basados en targetKcal
      let pMeta = null;
      let cMeta = null;
      let fMeta = null;
      if (metaKcal > 0) {
        const ratio = targetKcal / metaKcal;
        const totalP = Number(macros.proteina || smartPrescription?.proteinG || 160);
        const totalC = Number(macros.carbohidratos || smartPrescription?.carbsG || 270);
        const totalF = Number(macros.grasas || smartPrescription?.fatsG || 94);
        pMeta = Math.round(totalP * ratio);
        cMeta = Math.round(totalC * ratio);
        fMeta = Math.round(totalF * ratio);
      } else {
        pMeta = Math.round((targetKcal * 0.30) / 4);
        cMeta = Math.round((targetKcal * 0.45) / 4);
        fMeta = Math.round((targetKcal * 0.25) / 9);
      }

      const res = await generateDishFromIngredientsWithAi({
        ingredientes: items,
        cliente: selected,
        clinicalRec,
        targetMacros: { calorias: targetKcal, proteina: pMeta, carbohidratos: cMeta, grasas: fMeta },
      });

      let autoPhoto = meal.foto_url;
      if (optIdx === 0 && !autoPhoto && res?.titulo) {
        try {
          const match = await searchDishPhotoInCatalog(res.titulo, [res.titulo, ...items]);
          if (match?.foto_url) {
            autoPhoto = match.foto_url;
          }
        } catch {}
      }

      const optLetter = String.fromCharCode(65 + optIdx);
      const dishText = res.titulo && res.texto && !res.texto.startsWith(res.titulo)
        ? `${res.titulo}\n\n${res.texto}`
        : (res.texto || res.titulo || "");

      setDiaForm(p => {
        const cs = [...p.comidas];
        const c = { ...cs[mealIdx] };
        const opts = [...(c.opciones && c.opciones.length > 0 ? c.opciones : [c.opcion1 || ""])];
        while (opts.length <= optIdx) opts.push("");
        opts[optIdx] = dishText;
        c.opciones = opts;
        if (optIdx === 0) {
          c.opcion1 = dishText;
          if (autoPhoto) c.foto_url = autoPhoto;

          // Inyectar calorías y macronutrientes calculados en los campos inferiores
          if (res.calorias != null) c.calorias = Math.round(Number(res.calorias));
          if (res.proteina != null) c.proteina = Math.round(Number(res.proteina));
          if (res.carbohidratos != null) c.carbohidratos = Math.round(Number(res.carbohidratos));
          if (res.grasas != null) c.grasas = Math.round(Number(res.grasas));

          c.modoEdicion = "platillo";
        }
        c.opcionesModoEdicion = {
          ...(c.opcionesModoEdicion || {}),
          [optIdx]: "platillo",
        };
        cs[mealIdx] = c;
        return { ...p, comidas: cs };
      });

      setMsg(
        <div className="flex items-center gap-1.5 text-purple-700">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>¡Platillo generado con IA para la Opción ${optLetter}!</span>
        </div>
      );
    } catch (err) {
      alert("No se pudo generar el platillo con IA: " + (err?.message || "Error"));
    } finally {
      setAiGeneratingDishMap(prev => ({ ...prev, [optKey]: false }));
      setAiGeneratingDishIndex(null);
    }
  };
  const [aiAltIndex, setAiAltIndex] = useState(null);
  const [photoCatalogModal, setPhotoCatalogModal] = useState(null);
  const [catalogCategory, setCatalogCategory] = useState("Todos");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editRutina, setEditRutina] = useState(null);
  const [rutinaForm, setRutinaForm] = useState({ nombre:"", ejercicios:[] });
  const [activeAltSlot, setActiveAltSlot] = useState(null);
  const [templateModal, setTemplateModal] = useState(null); // 'nutri' | 'rutina' | null
  const [showMacroCalc, setShowMacroCalc] = useState(false);
  const [showExpediente, setShowExpediente] = useState(false);
  const [metaPrescritaCollapsed, setMetaPrescritaCollapsed] = useState(true);
  const [metaEntrenoCollapsed, setMetaEntrenoCollapsed] = useState(true);
  const [allMetricas, setAllMetricas] = useState(() => {
    const ms = selected?.id ? dbPeek(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc`) : null;
    return Array.isArray(ms) ? ms.map(enrichMetrica) : [];
  });
  const [latestMetrica, setLatestMetrica] = useState(() => {
    const ms = selected?.id ? dbPeek(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc`) : null;
    return Array.isArray(ms) && ms.length > 0 ? enrichMetrica(ms[0]) : null;
  });
  const [clinicalLoaded, setClinicalLoaded] = useState(false);
  const [clinicalRec, setClinicalRec] = useState(() => {
    return selected?.id ? peekClinicalRecord(selected.id) : null;
  });

  const cycleMetrica = useMemo(() => {
    if (!Array.isArray(allMetricas) || allMetricas.length === 0) return null;
    const linked = linkMetricasToCiclos(allMetricas, ciclos);
    const getEvalTime = (m) => {
      if (!m) return 0;
      const f = m.fecha ? (String(m.fecha).split("T")[0] + "T12:00:00") : m.created_at;
      const t = new Date(f || 0).getTime();
      return isNaN(t) ? 0 : t;
    };
    if (cicloSel?.id) {
      const forCycle = linked.filter((m) => String(m.ciclo_id) === String(cicloSel.id));
      if (forCycle.length > 0) {
        return [...forCycle].sort((a, b) => {
          const diff = getEvalTime(b) - getEvalTime(a);
          if (diff !== 0) return diff;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })[0];
      }
      // El plan seleccionado no tiene evaluación registrada aún
      return null;
    }
    // Fallback únicamente si el cliente no tiene ningún plan/ciclo creado todavía
    if (!ciclos || ciclos.length === 0) {
      return [...linked].sort((a, b) => {
        const diff = getEvalTime(b) - getEvalTime(a);
        if (diff !== 0) return diff;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })[0];
    }
    return null;
  }, [allMetricas, ciclos, cicloSel?.id]);

  const smartPrescription = useMemo(() => {
    return generateSmartMacroPrescription({
      cliente: selected,
      metrica: cycleMetrica,
      clinicalRec,
      ciclo: cicloSel,
      cicloNombre: cicloSel?.nombre || "",
    });
  }, [selected, cycleMetrica, clinicalRec, cicloSel]);

  const smartTrainingPrescription = useMemo(() => {
    return generateSmartTrainingPrescription({
      cliente: selected,
      metrica: cycleMetrica,
      clinicalRec,
      ciclo: cicloSel,
      cicloNombre: cicloSel?.nombre || "",
      smartPrescription,
      isMiPlan,
    });
  }, [selected, cycleMetrica, clinicalRec, cicloSel, smartPrescription, isMiPlan]);

  // Sincronización inmediata de métricas cuando cambia el cliente seleccionado
  useEffect(() => {
    if (selected?.id) {
      const ms = dbPeek(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc`);
      const enrichedList = Array.isArray(ms) ? ms.map(enrichMetrica) : [];
      setAllMetricas(enrichedList);
      setLatestMetrica(enrichedList[0] || null);
    } else {
      setAllMetricas([]);
      setLatestMetrica(null);
    }
  }, [selected?.id]);

  useEffect(() => {
    let active = true;
    if (selected?.id) {
      setClinicalLoaded(false);
      setClinicalRec(peekClinicalRecord(selected.id));
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

  const applyPrescribedMacrosRef = useRef(null);

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
          dbGetFresh(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc&limit=30`)
            .then(ms => {
              const enrichedList = Array.isArray(ms) ? ms.map(enrichMetrica) : [];
              setAllMetricas(enrichedList);
              setLatestMetrica(enrichedList.length > 0 ? enrichedList[0] : null);
            })
            .catch(() => {});
        }
        const pm = e?.detail?.prescribedMacros;
        if (pm && pm.targetKcal > 0 && applyPrescribedMacrosRef.current) {
          applyPrescribedMacrosRef.current({
            calorias: pm.targetKcal,
            proteinas: pm.proteinG,
            carbohidratos: pm.carbsG,
            grasas: pm.fatsG,
          });
        }
      }
    };
    const onOpenHistorico = () => setShowHistorico(true);
    window.addEventListener("flux:expediente-updated", onExpedienteUpdated);
    window.addEventListener("flux:metricas-updated", onMetricasUpdated);
    window.addEventListener("flux:open-historico", onOpenHistorico);
    return () => {
      window.removeEventListener("flux:expediente-updated", onExpedienteUpdated);
      window.removeEventListener("flux:metricas-updated", onMetricasUpdated);
      window.removeEventListener("flux:open-historico", onOpenHistorico);
    };
  }, [selected?.id]);

  // Sincronización automática transparente de macros con la evaluación más actual del plan
  useEffect(() => {
    if (!selected?.id || isReadOnly || !smartPrescription?.targetKcal || !cycleMetrica) return;
    const sKcal = Number(smartPrescription.targetKcal) || 0;
    const sP = Number(smartPrescription.proteinG) || 0;
    const sC = Number(smartPrescription.carbsG) || 0;
    const sF = Number(smartPrescription.fatsG) || 0;
    if (sKcal <= 0) return;

    const curKcal = Number(macros.calorias) || 0;
    const curP = Number(macros.proteina) || 0;
    const curC = Number(macros.carbohidratos) || 0;
    const curF = Number(macros.grasas) || 0;

    if (curKcal !== sKcal || curP !== sP || curC !== sC || curF !== sF) {
      const nextMacros = {
        calorias: sKcal,
        proteina: sP,
        carbohidratos: sC,
        grasas: sF,
      };
      setMacros(nextMacros);
      const targetCicloId = cicloSel?.id || null;
      const cycleQuery = targetCicloId ? `ciclo_id=eq.${targetCicloId}` : `ciclo_id=is.null`;
      dbGetFresh(`nutricion?cliente_id=eq.${selected.id}&${cycleQuery}&limit=1`).then(rows => {
        if (rows && rows.length > 0) {
          dbPatch(`nutricion?id=eq.${rows[0].id}`, nextMacros).catch(() => {});
        } else {
          dbPost("nutricion", {
            cliente_id: selected.id,
            ...nextMacros,
            ...(targetCicloId ? { ciclo_id: targetCicloId } : {})
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [selected?.id, cicloSel?.id, smartPrescription?.targetKcal, smartPrescription?.proteinG, smartPrescription?.carbsG, smartPrescription?.fatsG, isReadOnly, cycleMetrica]);

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
  const [showHistorico, setShowHistorico] = useState(false);

  useBackButton(!!cropModal, () => {
    if (cropModal?.objectUrl) {
      try { URL.revokeObjectURL(cropModal.objectUrl); } catch (e) {}
    }
    setCropModal(null);
  }, 50);
  useBackButton(showHistorico, () => setShowHistorico(false), 30);
  useBackButton(showExpediente, () => setShowExpediente(false), 25);
  useBackButton(!!templateModal, () => setTemplateModal(null), 40);
  useBackButton(!!showDiaModal, () => {
    if (photoCatalogModal) setPhotoCatalogModal(null);
    else setShowDiaModal(false);
  }, 20);
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
      const meta = parseDiaMetadata(d.dia || "");
      setDiaForm(p => ({
        ...p,
        dia: (d.dia || "") + " (Copia)",
        diasSeleccionados: p.diasSeleccionados?.length > 0 ? p.diasSeleccionados : (meta.dayCode && meta.dayCode !== "S/D" ? [meta.dayCode] : []),
        tituloPersonalizado: meta.titulo ? `${meta.titulo} (Copia)` : "Día importado",
        aguaLitros: meta.agua || p.aguaLitros || "",
        suplementos: meta.suplementos || p.suplementos || "",
        comidas: (coms || []).map(x => {
          const parsedOpts = parseMealOptions(x);
          const copy = { 
            ...x, 
            _dndId: Math.random().toString(36).slice(2, 9),
            opciones: parsedOpts.length > 0 ? parsedOpts : [x.opcion1 || ""],
            alertaClinica: null
          };
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

      setCicloSel(prev => {
        if (
          prev &&
          chosen &&
          prev.id === chosen.id &&
          prev.nombre === chosen.nombre &&
          prev.activo === chosen.activo &&
          prev.fecha_inicio === chosen.fecha_inicio
        ) {
          return prev;
        }
        return chosen;
      });
      return chosen;
    } catch(e) { 
      if (!isOfflineError(e)) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); 
      }
      return null;
    }
  }, [selected?.id, isMiPlan]);

  const loadedCycleKeyRef = useRef(null);

  // ── Cargar datos del ciclo seleccionado ──
  const loadData = useCallback(async (targetCiclo = cicloSel, opts = {}) => {
    if (!selected?.id) return;
    const { silent = false, forceFresh = false } = opts;
    const currentCiclo = targetCiclo !== undefined ? targetCiclo : cicloSel;
    const cycleKey = `${selected.id}_${currentCiclo?.id || "null"}`;
    const cicloFilter = currentCiclo
      ? `ciclo_id=eq.${currentCiclo.id}`
      : `ciclo_id=is.null`;
    const hasCached = dbPeek(`nutricion?cliente_id=eq.${selected.id}&${cicloFilter}`) !== null ||
                      dbPeek(`rutinas?cliente_id=eq.${selected.id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`) !== null;
    if (!silent && !hasCached && loadedCycleKeyRef.current !== cycleKey) setLoading(true);
    try {

      const fetchFn = forceFresh ? dbGetFresh : dbGet;

      const [ns, rs, ms] = await Promise.all([
        fetchFn(`nutricion?cliente_id=eq.${selected.id}&${cicloFilter}`).catch(() => []),
        fetchFn(`rutinas?cliente_id=eq.${selected.id}&${cicloFilter}&select=*,ejercicios(*)&order=orden.asc`).catch(() => []),
        fetchFn(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc&limit=30`).catch(() => []),
      ]);

      if (Array.isArray(ms) && ms.length > 0) {
        const enrichedList = ms.map(enrichMetrica);
        setAllMetricas(enrichedList);
        setLatestMetrica(enrichedList[0]);
      } else {
        setAllMetricas([]);
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
    loadedCycleKeyRef.current = cycleKey;
    setLoading(false);
  }, [selected?.id, cicloSel?.id]);

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
  applyPrescribedMacrosRef.current = handleApplyPrescribedMacros;

  const pendingCacheReloadRef = useRef(false);

  useEffect(() => { loadCiclos(); }, [loadCiclos]);
  useEffect(() => { if (cicloSel !== undefined) loadData(); }, [loadData]);

  useEffect(() => {
    if (!saving && !showDiaModal && !showRutinaModal && !showPlanModal && pendingCacheReloadRef.current) {
      pendingCacheReloadRef.current = false;
      loadCiclos();
      if (cicloSel !== undefined) loadData(cicloSel, { silent: true, forceFresh: true });
    }
  }, [saving, showDiaModal, showRutinaModal, showPlanModal, loadCiclos, loadData, cicloSel]);

  useEffect(() => {
    let timer = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["ciclos", "nutricion", "nutricion_dias", "comidas", "rutinas", "ejercicios", "metricas_progreso", "clientes", "*"].includes(table)) return;
      if (saving || showDiaModal || showRutinaModal || showPlanModal) {
        pendingCacheReloadRef.current = true;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!table || table === "*" || table === "ciclos") loadCiclos();
        if (cicloSel !== undefined) loadData(cicloSel, { silent: true, forceFresh: false });
      }, 250);
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
      // Verificar si tiene datos en paralelo (nutrición, rutinas y evaluaciones de este ciclo)
      const [nutris, ruts, directMetricas] = await Promise.all([
        dbGet(`nutricion?ciclo_id=eq.${ciclo.id}`).catch(() => []),
        dbGet(`rutinas?ciclo_id=eq.${ciclo.id}`).catch(() => []),
        selected?.id
          ? dbGet(`metricas_progreso?cliente_id=eq.${selected.id}&ciclo_id=eq.${ciclo.id}`).catch(() => [])
          : Promise.resolve([]),
      ]);

      // Incluir también cualquier métrica en memoria o caché vinculada a este ciclo
      const localEvals = (allMetricas || []).filter((m) => String(m.ciclo_id) === String(ciclo.id));
      const evalsMap = new Map();
      (directMetricas || []).forEach((m) => evalsMap.set(String(m.id), m));
      localEvals.forEach((m) => evalsMap.set(String(m.id), m));
      const evals = Array.from(evalsMap.values());

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
          if (evals.length > 0) {
            delPromises.push(dbDel(`metricas_progreso?id=in.(${evals.map(m => m.id).join(",")})`));
          }
          delPromises.push(dbDel(`ciclos?id=eq.${ciclo.id}`));
          await Promise.all(delPromises);

          if (evals.length > 0) {
            const evalIdsSet = new Set(evals.map((m) => String(m.id)));
            updateQueryCache("metricas_progreso", (cachedList) => {
              if (!Array.isArray(cachedList)) return [];
              return cachedList.filter((m) => !evalIdsSet.has(String(m.id)) && String(m.ciclo_id) !== String(ciclo.id));
            });
            setAllMetricas((prev) => prev.filter((m) => !evalIdsSet.has(String(m.id))));
            if (typeof window !== "undefined" && selected?.id) {
              window.dispatchEvent(
                new CustomEvent("flux:metricas-updated", {
                  detail: { clienteId: selected.id, source: "ProgramarCliente" },
                })
              );
            }
          }

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

      const totalItems = (nutris?.length || 0) + (ruts?.length || 0) + evals.length;
      if (totalItems > 0) {
        const parts = [];
        if (ruts?.length > 0) parts.push(`${ruts.length} rutina(s)`);
        if (nutris?.length > 0) parts.push(`${nutris.length} plan(es) de nutrición`);
        if (evals.length > 0) parts.push(`${evals.length} evaluación(es)`);
        setConfirmDelete({
          title: "¡Cuidado! Eliminar ciclo completo",
          description: `Este ciclo contiene ${parts.join(", ")}. Si continúas, se destruirá todo su contenido permanentemente sin dejar datos huérfanos.`,
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
            window.dispatchEvent(new CustomEvent("flux:open-new-evaluation", { detail: { ciclo: newCiclo } }));
            window.dispatchEvent(new CustomEvent("flux:open-checkin", { detail: { ciclo: newCiclo } }));
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
    const pesoActual = cycleMetrica?.peso || latestMetrica?.peso || selected?.peso || null;
    const suggestedWater = pesoActual ? (Math.round(pesoActual * 0.035 * 10) / 10).toFixed(1) : "2.5";
    setDiaForm({ 
      dia:"", 
      diasSeleccionados:[], 
      tituloPersonalizado:"", 
      aguaLitros: suggestedWater,
      suplementos: "",
      orden:dias.length, 
      comidas:[{ 
        _dndId: Math.random().toString(36).slice(2,9), 
        hora:"08:00 AM", 
        nombre:"", 
        opciones: [""],
        opcion1:"", 
        opcion2:"", 
        calorias:"", 
        proteina:"", 
        carbohidratos:"", 
        grasas:"", 
        foto_url:"",
        alertaClinica: null
      }] 
    }); 
    setShowDiaModal(true); 
  };
  const openEditDia = (d) => { 
    const meta = parseDiaMetadata(d.dia || "");

    setEditDia(d); 
    setDiaForm({ 
      dia:d.dia, 
      diasSeleccionados: meta.dayCode && meta.dayCode !== "S/D" ? [meta.dayCode] : [],
      tituloPersonalizado: meta.titulo || "",
      aguaLitros: meta.agua || "",
      suplementos: meta.suplementos || "",
      orden:d.orden, 
      comidas:(d.comidas || []).map(c => {
        const parsedOpts = parseMealOptions(c);
        return {
          ...c,
          _dndId: String(c.id || Math.random().toString(36).slice(2,9)),
          opciones: parsedOpts.length > 0 ? parsedOpts : [c.opcion1 || ""],
          alertaClinica: null
        };
      })
    }); 
    setShowDiaModal(true); 
  };

  const saveDia = async () => {
    const formSnap = {
      ...diaForm,
      diasSeleccionados: [...(diaForm.diasSeleccionados || [])],
      comidas: (diaForm.comidas || []).map(c => {
        const { opcion1, opcion2 } = formatMealOptions(c.opciones || [c.opcion1 || ""]);
        return {
          ...c,
          opcion1,
          opcion2,
        };
      }),
    };
    const editDiaSnap = editDia;
    const prevDias = dias;

    const dayCode = formSnap.diasSeleccionados?.length > 0 ? formSnap.diasSeleccionados[0] : "S/D";
    const finalName = formatDiaMetadata({
      dayCode,
      titulo: formSnap.tituloPersonalizado,
      agua: formSnap.aguaLitros,
      suplementos: formSnap.suplementos
    });

    // 1. Actualización Optimista Instantánea en 0ms y cierre de modal inmediato
    if (editDiaSnap) {
      const optimisticComidas = formSnap.comidas.map((c, i) => ({
        ...c,
        id: c.id || `temp_${Date.now()}_${i}`,
        dia_id: editDiaSnap.id,
        hora: c.hora || "",
        nombre: c.nombre || "",
        opcion1: c.opcion1 || "",
        opcion2: c.opcion2 || "",
        opciones: c.opciones || [c.opcion1 || ""],
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
      const optimisticNewDias = creationDays.map((dCode, idx) => {
        const optimisticDayName = formatDiaMetadata({
          dayCode: dCode,
          titulo: formSnap.tituloPersonalizado,
          agua: formSnap.aguaLitros,
          suplementos: formSnap.suplementos
        });
        const tempDiaId = `temp_dia_${Date.now()}_${idx}`;
        const dObj = {
          id: tempDiaId,
          nutricion_id: nutri?.id || "temp_nutri",
          dia: optimisticDayName,
          orden: orderCounter++,
          comidas: formSnap.comidas.map((c, i) => ({
            ...c,
            id: `temp_com_${Date.now()}_${idx}_${i}`,
            dia_id: tempDiaId,
            hora: c.hora || "",
            nombre: c.nombre || `Comida ${i + 1}`,
            opcion1: c.opcion1 || "",
            opcion2: c.opcion2 || "",
            opciones: c.opciones || [c.opcion1 || ""],
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

        const diasData = creationDays.map(dCode => {
          const optimisticDayName = formatDiaMetadata({
            dayCode: dCode,
            titulo: formSnap.tituloPersonalizado,
            agua: formSnap.aguaLitros,
            suplementos: formSnap.suplementos
          });
          const d = { nutricion_id: currentNutri.id, dia: optimisticDayName, orden: orderCounter };
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
        if (Date.now() - lastSent > 3600000) {
          sessionStorage.setItem(throttleKey, String(Date.now()));
          dbPost("notificaciones", {
            usuario_id: selected.auth_id,
            tipo: "plan_nutri",
            titulo: "Tu plan de nutrición ha sido actualizado",
            mensaje: `Tu nutriólogo actualizó tu plan nutricional para ${cicloSel?.nombre || "este ciclo"}. Revisa tus nuevas metas y opciones de comida.`,
            leido: false,
          }).catch(() => {});
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
    const meta = parseDiaMetadata(d.dia || "");
    const diaTitulo = meta.titulo
      ? `${meta.dayCode && meta.dayCode !== "S/D" ? `${meta.dayCode} - ` : ""}${meta.titulo}`
      : (d.dia || "").split('|')[0] || "este día";
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
  const addComida = () => setDiaForm(p => ({
    ...p,
    comidas: [
      ...p.comidas,
      {
        _dndId: Math.random().toString(36).slice(2, 9),
        hora: "08:00 AM",
        nombre: "",
        opciones: [""],
        opcion1: "",
        opcion2: "",
        calorias: "",
        proteina: "",
        carbohidratos: "",
        grasas: "",
        foto_url: "",
        alertaClinica: null
      }
    ]
  }));

  const duplicateComida = (i) => setDiaForm(p => {
    const cs = [...p.comidas];
    const target = cs[i];
    if (!target) return p;
    const duplicated = {
      ...target,
      _dndId: Math.random().toString(36).slice(2, 9),
      id: undefined,
      nombre: target.nombre ? `${target.nombre} (Copia)` : "",
      opciones: [...(target.opciones && target.opciones.length > 0 ? target.opciones : [target.opcion1 || ""])],
      alertaClinica: null
    };
    cs.splice(i + 1, 0, duplicated);
    return { ...p, comidas: cs };
  });

  const updComida = (i, f, v) => setDiaForm(p => {
    const cs = [...p.comidas];
    if (cs[i]) cs[i] = { ...cs[i], [f]: v };
    return { ...p, comidas: cs };
  });

  const remComida = (i) => setDiaForm(p => ({
    ...p,
    comidas: p.comidas.filter((_, x) => x !== i)
  }));

  const updMealOption = (mealIdx, optIdx, text) => setDiaForm(p => {
    const cs = [...p.comidas];
    const c = { ...cs[mealIdx] };
    const opts = [...(c.opciones || [""])];
    opts[optIdx] = text;
    c.opciones = opts;
    if (optIdx === 0) {
      c.opcion1 = text;
      c.alertaClinica = null;
    }
    cs[mealIdx] = c;
    return { ...p, comidas: cs };
  });

  const addMealOption = (mealIdx) => setDiaForm(p => {
    const cs = [...p.comidas];
    const c = { ...cs[mealIdx] };
    const opts = [...(c.opciones || [""])];
    opts.push("");
    c.opciones = opts;
    cs[mealIdx] = c;
    return { ...p, comidas: cs };
  });

  const removeMealOption = (mealIdx, optIdx) => setDiaForm(p => {
    const cs = [...p.comidas];
    const c = { ...cs[mealIdx] };
    const opts = (c.opciones || [""]).filter((_, idx) => idx !== optIdx);
    c.opciones = opts.length > 0 ? opts : [""];
    c.opcion1 = c.opciones[0] || "";
    cs[mealIdx] = c;
    return { ...p, comidas: cs };
  });

  const handleAuditDayWithAi = async () => {
    if (isEstandar) {
      setMsg(
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <div>
            <strong>Auditoría con IA Exclusiva de Premium.</strong>
            <div className="text-xs opacity-90 mt-0.5">La auditoría clínica de menús con IA está reservada para el Plan Premium. Adquiérela en Mi Membresía.</div>
          </div>
        </div>
      );
      return;
    }
    if (!diaForm.comidas || diaForm.comidas.length === 0) {
      alert("Agrega al menos una comida al día para auditar.");
      return;
    }
    const hasAnyContent = diaForm.comidas.some(
      (c) =>
        (c.opciones?.[0] || c.opcion1 || "").trim().length > 0 ||
        Number(c.calorias) > 0
    );
    if (!hasAnyContent) {
      alert(
        "Escribe o selecciona alimentos en al menos una comida para poder auditar el día."
      );
      return;
    }

    setIsAuditingDay(true);
    setMsg(
      <div className="flex items-center gap-2 text-purple-700">
        <Sparkles className="w-4 h-4 animate-spin text-purple-600" />
        <span>Auditando menú del día completo con IA Clínica FLUX...</span>
      </div>
    );

    try {
      const res = await auditFullDayWithAi({
        comidas: diaForm.comidas,
        clinicalRec,
        smartPrescription,
        targetMacros: {
          calorias: macros.calorias || smartPrescription?.targetKcal,
          proteina: macros.proteina || smartPrescription?.proteinG,
          carbohidratos: macros.carbohidratos || smartPrescription?.carbsG,
          grasas: macros.grasas || smartPrescription?.fatsG,
        },
        cliente: selected,
      });

      if (res?.comidasAuditadas && Array.isArray(res.comidasAuditadas)) {
        let totalAutofilled = 0;
        let totalAlerts = 0;

        setDiaForm((p) => {
          const nextComidas = p.comidas.map((meal, idx) => {
            const audited =
              res.comidasAuditadas.find((item) => item.index === idx) ||
              res.comidasAuditadas[idx];
            if (!audited) return meal;

            const updated = { ...meal };
            const currentKcal = Number(updated.calorias) || 0;

            // Rellenar macros si estaban en 0 o vacíos y la IA los calculó
            if (currentKcal === 0 && audited.calorias > 0) {
              updated.calorias = audited.calorias;
              updated.proteina = audited.proteina;
              updated.carbohidratos = audited.carbohidratos;
              updated.grasas = audited.grasas;
              updated.macrosCalculadosPorIa = true;
              totalAutofilled++;
            }

            // Inyectar alertas y evaluación clínica con máxima claridad
            updated.alertaClinica = audited.alertaClinica || null;
            if (audited.alertaClinica) {
              totalAlerts++;
              const isDanger = /al[eé]rg|intoleran|prohibid|peligr|contraindic/i.test(audited.alertaClinica);
              updated.evaluacionClinica = {
                tipo: isDanger ? "peligro" : "advertencia",
                titulo: isDanger ? "Alérgeno / Exclusión Crítica" : "Aviso de Aversión Alimentaria",
                mensaje: audited.alertaClinica,
              };
            } else if (audited.evaluacion) {
              updated.evaluacionClinica = {
                tipo: "exito",
                titulo: "Compatibilidad Clínica",
                mensaje: audited.evaluacion,
              };
            } else {
              updated.evaluacionClinica = null;
            }
            return updated;
          });

          return { ...p, comidas: nextComidas };
        });

        if (res.resumenGlobal) {
          setDayAuditResult(res.resumenGlobal);
        }

        setMsg(
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Auditoría completada
              {totalAutofilled > 0
                ? ` • ${totalAutofilled} comida(s) calculada(s) con macros bromatológicos`
                : ""}
              {totalAlerts > 0
                ? ` • ${totalAlerts} advertencia(s) detectada(s)`
                : " • 100% compatible"}
            </span>
          </div>
        );
      }
    } catch (err) {
      console.error("Error auditando día con IA:", err);
      setMsg(
        <div className="text-amber-600 text-xs">
          ⚠️ {err.message || "No se pudo auditar el día completo."}
        </div>
      );
    } finally {
      setIsAuditingDay(false);
    }
  };

  const handleOptimizeComidaWithAi = async (mealIdx) => {
    const meal = diaForm.comidas[mealIdx];
    const mainText = meal?.opciones?.[0] || meal?.opcion1 || "";
    if (!mainText.trim()) {
      alert("Escribe primero los ingredientes o preparación de la Opción Principal para optimizar con IA.");
      return;
    }
    setAiOptimizingIndex(mealIdx);
    try {
      const res = await optimizeMealWithAi({
        mealText: mainText,
        clinicalRec,
        cliente: selected,
        targetMacros: {
          calorias: macros.calorias || smartPrescription?.targetKcal,
          proteina: macros.proteina || smartPrescription?.proteinG,
          carbohidratos: macros.carbohidratos || smartPrescription?.carbsG,
          grasas: macros.grasas || smartPrescription?.fatsG,
        }
      });

      let autoPhoto = meal.foto_url;
      if (!autoPhoto && res?.palabrasClaveFoto) {
        try {
          const match = await searchDishPhotoInCatalog(mainText, res.palabrasClaveFoto);
          if (match?.foto_url) {
            autoPhoto = match.foto_url;
          }
        } catch {}
      }

      setDiaForm(p => {
        const cs = [...p.comidas];
        const c = { ...cs[mealIdx] };
        if (res.calorias != null) c.calorias = res.calorias;
        if (res.proteina != null) c.proteina = res.proteina;
        if (res.carbohidratos != null) c.carbohidratos = res.carbohidratos;
        if (res.grasas != null) c.grasas = res.grasas;
        if (autoPhoto) c.foto_url = autoPhoto;
        // No sobreescribir el nombre de la toma con IA, respetar lo que escriba el nutriólogo
        c.alertaClinica = res.alertaClinica || null;
        c.evaluacionClinica = res.evaluacionClinica || null;
        cs[mealIdx] = c;
        return { ...p, comidas: cs };
      });
      if (res?.evaluacionClinica?.tipo === "exito") {
        setMsg(
          <div className="flex items-center gap-1.5 text-emerald-700">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Macros calculados • ¡Alineado con comida favorita del paciente!</span>
          </div>
        );
      } else if (res?.evaluacionClinica?.tipo === "advertencia" || res?.evaluacionClinica?.tipo === "peligro") {
        setMsg(
          <div className="flex items-center gap-1.5 text-amber-700">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Macros calculados • ⚠️ Revisa el aviso clínico del platillo</span>
          </div>
        );
      } else {
        const isLocal = res?.origen === "analitico_local";
        setMsg(
          <div className="flex items-center gap-1.5">
            <Sparkles className={`w-4 h-4 ${isLocal ? "text-emerald-600" : "text-purple-600"}`} />
            <span>{isLocal ? "Macros calculados (Motor Bromatológico FLUX)" : "Macros calculados con IA"}</span>
          </div>
        );
      }
    } catch (err) {
      console.error(err);
      setMsg(<div className="text-amber-600 text-xs">⚠️ {err.message || "No se pudo optimizar la comida"}</div>);
    } finally {
      setAiOptimizingIndex(null);
    }
  };

  const handleGenerateAltWithAi = async (mealIdx) => {
    const meal = diaForm.comidas[mealIdx];
    const mainText = meal?.opciones?.[0] || meal?.opcion1 || "";
    if (!mainText.trim()) {
      alert("La Opción Principal debe contener la receta base para que la IA diseñe un equivalente iso-macronutrimental.");
      return;
    }
    setAiAltIndex(mealIdx);
    try {
      const res = await generateAlternativeMealWithAi({
        mainMealText: mainText,
        targetMacros: {
          calorias: meal.calorias,
          proteina: meal.proteina,
          carbohidratos: meal.carbohidratos,
          grasas: meal.grasas,
        },
        clinicalRec,
        cliente: selected
      });

      if (res?.texto) {
        setDiaForm(p => {
          const cs = [...p.comidas];
          const c = { ...cs[mealIdx] };
          const opts = [...(c.opciones || [""])];
          if (opts.length > 1 && !opts[opts.length - 1].trim()) {
            opts[opts.length - 1] = res.texto;
          } else {
            opts.push(res.texto);
          }
          c.opciones = opts;
          cs[mealIdx] = c;
          return { ...p, comidas: cs };
        });
        const isLocal = res?.origen === "analitico_local";
        setMsg(
          <div className="flex items-center gap-1.5">
            <Sparkles className={`w-4 h-4 ${isLocal ? "text-emerald-600" : "text-purple-600"}`} />
            <span>{isLocal ? "Alternativa equivalente generada (Motor Bromatológico)" : "Alternativa equivalente generada con IA"}</span>
          </div>
        );
      }
    } catch (err) {
      console.error(err);
      setMsg(<div className="text-amber-600 text-xs">⚠️ {err.message || "No se pudo generar la alternativa"}</div>);
    } finally {
      setAiAltIndex(null);
    }
  };
  
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
      {/* ── Cabecera cliente / Mi Plan ── */}
      <div className="mb-4 bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          
          {/* Left: Info + Back button (solo si no es Mi Plan) */}
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            {!isMiPlan && (
              <button
                type="button"
                onClick={() => (onBackToList ? onBackToList() : setSelected(null))}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0F4FA] hover:bg-[#E2E8F0] text-[#0B1929] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Volver a la lista de pacientes"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#0B1929] truncate max-w-full">
                  {selected?.nombre || (isMiPlan ? "Mi Plan Personal" : "Paciente")}
                </h2>
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
                {selected?.objetivo && (
                  <span className="hidden xl:inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-blue-50/70 text-[var(--brand-primary)] truncate max-w-[220px]" title={selected.objetivo}>
                    {selected.objetivo}
                  </span>
                )}
              </div>
              <div className="text-xs text-[#6B7A8D] truncate mt-0.5 flex items-center gap-2 flex-wrap">
                {selected?.email && <span className="truncate">{selected.email}</span>}
                {!isMiPlan && selected?.telefono && (
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
                {isMiPlan && (
                  <span className="text-[#9BA5B0] font-medium">Gestión de objetivos y planificación personal</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Acciones (Expediente e Histórico) */}
          <div className="flex items-center justify-between sm:justify-start lg:justify-end gap-2 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-[#F0F4FA] flex-wrap sm:flex-nowrap">
            {!isMiPlan && (
              <button
                type="button"
                onClick={() => setShowHistorico(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0B1929] transition-all shadow-2xs cursor-pointer shrink-0"
                title="Abrir progreso histórico plan a plan en pantalla completa"
              >
                <TrendingUp className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                <span>Histórico</span>
              </button>
            )}

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

      {/* ── Resumen Clínico Inteligente IA ── */}
      {(clinicalRec?.anamnesis_completada || hasAnamnesisData(clinicalRec?.anamnesis)) && (
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
              <p className="text-[#6B7A8D] mt-0.5">Crea el primer plan para comenzar a estructurar la alimentación y la rutina.</p>
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
      {/* ── Sub-tabs ── */}
      <div className="flex gap-1 mb-4 bg-[#F0F4FA] rounded-xl p-1 w-full sm:w-max overflow-x-auto scroll-hide">
        {[
          { k:"progreso", ic: <BarChart2 className="w-4 h-4 shrink-0"/>, lb:"Evaluación" },
          ...(serviciosActivos.nutricion ? [{ k:"nutri", ic: <Utensils className="w-4 h-4 shrink-0"/>, lb:"Nutrición" }] : []),
          ...(serviciosActivos.entrenamiento ? [{ k:"deporte", ic: <Dumbbell className="w-4 h-4 shrink-0"/>, lb:"Rutina" }] : []),
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
                {/* ── Tarjeta Inteligente de Prescripción Energética & Macros (IA) ── */}
                {(() => {
                  const hasExpediente = Boolean(
                    clinicalRec?.anamnesis_completada ||
                    clinicalRec?.anamnesis?.completado_por ||
                    hasAnamnesisData(clinicalRec?.anamnesis)
                  );
                  if (
                    !hasExpediente ||
                    !smartPrescription ||
                    !smartPrescription.hasEvaluation ||
                    !cycleMetrica ||
                    !smartPrescription.targetKcal ||
                    smartPrescription.targetKcal <= 0
                  ) {
                    return null;
                  }
                  const targetKcal = smartPrescription.targetKcal;
                  const activeP = smartPrescription.proteinG;
                  const activeC = smartPrescription.carbsG;
                  const activeF = smartPrescription.fatsG;
                  const pPct = targetKcal > 0 ? Math.round((activeP * 4 / targetKcal) * 100) : 0;
                  const cPct = targetKcal > 0 ? Math.round((activeC * 4 / targetKcal) * 100) : 0;
                  const fPct = targetKcal > 0 ? Math.round((activeF * 9 / targetKcal) * 100) : 0;
                  const refWeight = smartPrescription.weight || Number(selected?.peso) || 0;
                  const prescMode = smartPrescription.prescriptionMode || "matematico";

                  return (
                    <div className="mb-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm hover:border-[var(--brand-primary)]/40 transition-colors overflow-hidden">
                      {/* Cabecera de la tarjeta (Colapsable) */}
                      <div
                        onClick={() => setMetaPrescritaCollapsed((p) => !p)}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                          metaPrescritaCollapsed ? "hover:bg-[#F8FAFC]" : "pb-3 border-b border-[#F0F4FA] bg-[#F8FAFC]/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                            prescMode === "ia"
                              ? "bg-indigo-50 text-indigo-600 border-indigo-200/60"
                              : prescMode === "manual"
                              ? "bg-amber-50 text-amber-600 border-amber-200/60"
                              : "bg-blue-50 text-[var(--brand-primary)] border-blue-200/60"
                          }`}>
                            {prescMode === "ia" ? (
                              <Sparkles className="w-4 h-4 text-indigo-600" />
                            ) : prescMode === "manual" ? (
                              <Edit2 className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Calculator className="w-4 h-4 text-[var(--brand-primary)]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-[#0B1929]">
                                Meta Diaria Prescrita
                              </h4>

                              {smartPrescription.goalInfo?.title && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                                  <Target className="w-3 h-3 shrink-0" />
                                  <span>{smartPrescription.goalInfo.title} ({smartPrescription.goalInfo.pct > 0 ? `+${smartPrescription.goalInfo.pct}%` : `${smartPrescription.goalInfo.pct}%`})</span>
                                </span>
                              )}
                              {smartPrescription.fafInfo?.label && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                                  <Flame className="w-3 h-3 shrink-0" />
                                  <span>FAF {smartPrescription.faf}</span>
                                </span>
                              )}
                              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-[#6B7A8D]">
                                {smartPrescription.formulaShort || smartPrescription.formula}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Control de Colapso con Flecha */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <span className="text-[11px] font-semibold text-[#6B7A8D] hidden sm:inline">
                            {metaPrescritaCollapsed ? "Ver desglose" : "Ocultar"}
                          </span>
                          <button
                            type="button"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7A8D] hover:text-[#0B1929] bg-white shadow-2xs border border-[#E2E8F0] transition-transform cursor-pointer"
                            title={metaPrescritaCollapsed ? "Desplegar meta prescrita" : "Colapsar"}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                metaPrescritaCollapsed ? "" : "rotate-180"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Cuerpo de la Tarjeta (Desplegable, cerrado por defecto) */}
                      {!metaPrescritaCollapsed && (
                        <div className="p-4 pt-1">
                          {/* Cuadrícula de Macronutrientes */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F4FA]">
                              <span className="text-[11px] font-semibold text-[#6B7A8D] block">Energía Diaria</span>
                              <span className="text-base sm:text-lg font-extrabold text-[var(--brand-primary)]">
                                {targetKcal} <span className="text-xs font-medium text-[#6B7A8D]">kcal</span>
                              </span>
                              <span className="text-[10px] text-[#6B7A8D] block truncate mt-0.5">
                                TMB {smartPrescription.tmb} • GET {smartPrescription.get}
                              </span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F4FA]">
                              <span className="text-[11px] font-semibold text-emerald-700 block">Proteínas</span>
                              <span className="text-base sm:text-lg font-extrabold text-[#0B1929]">
                                {activeP} <span className="text-xs font-medium text-[#6B7A8D]">g</span>
                              </span>
                              <span className="text-[10px] text-[#6B7A8D] block truncate mt-0.5">
                                {smartPrescription.proteinPct || pPct}% • {smartPrescription.protGKg || (refWeight > 0 ? (activeP / refWeight).toFixed(1) : "-")} g/kg
                              </span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F4FA]">
                              <span className="text-[11px] font-semibold text-amber-700 block">Carbohidratos</span>
                              <span className="text-base sm:text-lg font-extrabold text-[#0B1929]">
                                {activeC} <span className="text-xs font-medium text-[#6B7A8D]">g</span>
                              </span>
                              <span className="text-[10px] text-[#6B7A8D] block truncate mt-0.5">
                                {smartPrescription.carbsPct || cPct}% • {smartPrescription.carbGKg || (refWeight > 0 ? (activeC / refWeight).toFixed(1) : "-")} g/kg
                              </span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F4FA]">
                              <span className="text-[11px] font-semibold text-rose-700 block">Grasas</span>
                              <span className="text-base sm:text-lg font-extrabold text-[#0B1929]">
                                {activeF} <span className="text-xs font-medium text-[#6B7A8D]">g</span>
                              </span>
                              <span className="text-[10px] text-[#6B7A8D] block truncate mt-0.5">
                                {smartPrescription.fatsPct || fPct}% • {smartPrescription.fatGKg || (refWeight > 0 ? (activeF / refWeight).toFixed(1) : "-")} g/kg
                              </span>
                            </div>
                          </div>

                          {/* Explicación clínica IA / Criterio */}
                          {smartPrescription.rationale && (
                            <div className={`mt-3 pt-2.5 border-t border-[#F0F4FA] flex items-start gap-2.5 text-xs p-2.5 rounded-xl ${
                              prescMode === "ia"
                                ? "bg-indigo-50/60 border border-indigo-100 text-indigo-950"
                                : "bg-slate-50 border border-slate-200/70 text-[#6B7A8D]"
                            }`}>
                              {prescMode === "ia" ? (
                                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                              ) : (
                                <Activity className="w-4 h-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
                              )}
                              <div className="leading-relaxed flex-1">
                                {prescMode === "ia" && (
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <strong className="text-indigo-900 font-bold">
                                      Dictamen de Auditoría Clínica IA:
                                    </strong>
                                    {smartPrescription.badgeMotivo && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200/60">
                                        {smartPrescription.badgeMotivo}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <p className="text-[#334155] leading-relaxed">{smartPrescription.rationale}</p>
                                {smartPrescription.estrategiaMenu && (
                                  <p className="mt-1.5 text-indigo-900 text-[11px] leading-relaxed">
                                    <span className="font-bold text-indigo-950">Estrategia de menú sugerida: </span>
                                    {smartPrescription.estrategiaMenu}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Preferencias y Aversiones evaluadas de la etapa */}
                          {Boolean(smartPrescription.preferencias || smartPrescription.aversiones) && (
                            <div className="mt-3 pt-2.5 border-t border-[#F0F4FA] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {smartPrescription.preferencias && (
                                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-emerald-950">
                                  <span className="font-bold text-emerald-800 block text-[11px] uppercase tracking-wider mb-0.5">
                                    Favoritos de la etapa a incluir:
                                  </span>
                                  <span className="leading-snug">{smartPrescription.preferencias}</span>
                                </div>
                              )}
                              {smartPrescription.aversiones && (
                                <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/70 text-rose-950">
                                  <span className="font-bold text-rose-800 block text-[11px] uppercase tracking-wider mb-0.5">
                                    Aversiones / No incluir:
                                  </span>
                                  <span className="leading-snug">{smartPrescription.aversiones}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Notas de actividad física del paciente evaluadas */}
                          {Boolean(smartPrescription.fafNotas) && (
                            <div className="mt-3 pt-2.5 border-t border-[#F0F4FA] text-xs">
                              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/70 text-amber-950 flex items-start gap-2">
                                <Flame className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-amber-800 block text-[11px] uppercase tracking-wider mb-0.5">
                                    Disponibilidad y notas de actividad física (Evaluación):
                                  </span>
                                  <span className="leading-snug">{smartPrescription.fafNotas}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

            <div className="flex flex-wrap justify-between items-center gap-2 mb-2.5">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <span className="font-semibold text-[#0B1929]">
                  {parsedActiveCycle.enfoque ? (
                    <>
                      <span>{parsedActiveCycle.enfoque}</span>
                      <span className="text-xs font-semibold text-[var(--brand-primary)] ml-1.5">
                        · Días del plan
                      </span>
                    </>
                  ) : (
                    <span>Días del plan</span>
                  )}
                  <span className="text-[#6B7A8D] font-normal ml-1.5">({dias.length})</span>
                </span>
                {Boolean(parsedActiveCycle.dias && parsedActiveCycle.semanas) && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-[var(--brand-primary)] border border-blue-200/60 shrink-0">
                    {parsedActiveCycle.dias} días • {parsedActiveCycle.semanas} sem
                  </span>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-2">
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
                {dias.map((d) => {
                  const meta = parseDiaMetadata(d.dia || "");
                  const dayCode = meta.dayCode || "S/D";
                  const titulo = meta.titulo || "";
                  const numComidas = (d.comidas || []).length;
                  const totKcal = (d.comidas || []).reduce((s, c) => s + (Number(c.calorias) || 0), 0);
                  const totProt = (d.comidas || []).reduce((s, c) => s + (Number(c.proteina) || 0), 0);
                  const totCarb = (d.comidas || []).reduce((s, c) => s + (Number(c.carbohidratos) || 0), 0);
                  const totGras = (d.comidas || []).reduce((s, c) => s + (Number(c.grasas) || 0), 0);

                  return (
                    <SortableItem key={d.id} id={d.id}>
                      {({ dragHandle, isDragging }) => (
                        <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3 mb-2 flex justify-between items-center gap-3 shadow-2xs hover:border-gray-300 transition-all">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {!isReadOnly && <div className="shrink-0 text-slate-400 hover:text-slate-600">{dragHandle}</div>}
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center flex-wrap gap-2 leading-tight">
                                {dayCode !== "S/D" && (
                                  <span className="font-bold px-2 py-0.5 bg-[var(--brand-primary)] text-white text-[11px] rounded-md shrink-0 uppercase tracking-wide shadow-2xs">
                                    {dayCode}
                                  </span>
                                )}
                                <span className="font-bold text-[14px] text-[#0B1929] truncate">
                                  {titulo || (dayCode !== "S/D" ? "Menú diario" : "Sin título")}
                                </span>
                              </div>
                              <div className="text-xs text-[#6B7A8D] mt-1 flex items-center flex-wrap gap-1.5 font-medium">
                                <span>{numComidas} {numComidas === 1 ? "comida" : "comidas"}</span>
                                <span className="text-[#CBD5E1]">•</span>
                                <span className="text-[#0B1929] font-bold">{totKcal} kcal</span>
                                <span className="text-[#6B7A8D]">({totProt}g P · {totCarb}g C · {totGras}g G)</span>
                              </div>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-blue-50 transition-colors cursor-pointer"
                                onClick={() => openEditDia(d)}
                              >
                                <Edit2 className="w-3.5 h-3.5" /> <span className="text-xs font-semibold">Editar</span>
                              </button>
                              <button
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                                onClick={() => deleteDia(d)}
                              >
                                <Trash2 className="w-3.5 h-3.5" /> <span className="text-xs font-semibold">Borrar</span>
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
            {/* ── Tarjeta Inteligente de Prescripción de Entrenamiento (IA & Biomecánica) ── */}
            {(() => {
              const hasExpediente = Boolean(
                clinicalRec?.anamnesis_completada ||
                clinicalRec?.anamnesis?.completado_por ||
                hasAnamnesisData(clinicalRec?.anamnesis)
              );
              if (
                !hasExpediente ||
                !cycleMetrica ||
                !smartTrainingPrescription ||
                !smartTrainingPrescription.hasEvaluation ||
                !smartPrescription ||
                !smartPrescription.hasEvaluation ||
                !smartPrescription.targetKcal ||
                smartPrescription.targetKcal <= 0
              ) {
                return null;
              }
              const p = smartTrainingPrescription;

              return (
                <div className="mb-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm hover:border-[var(--brand-primary)]/40 transition-colors overflow-hidden">
                  {/* Cabecera de la tarjeta (Colapsable) */}
                  <div
                    onClick={() => setMetaEntrenoCollapsed((prev) => !prev)}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                      metaEntrenoCollapsed ? "hover:bg-[#F8FAFC]" : "pb-3 border-b border-[#F0F4FA] bg-[#F8FAFC]/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border bg-blue-50 text-[var(--brand-primary)] border-blue-200/60">
                        <Dumbbell className="w-4 h-4 text-[var(--brand-primary)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-[#0B1929]">
                            Directriz de Entrenamiento Prescrita
                          </h4>

                          {/* Badge de Objetivo */}
                          {p.goalTitle && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                              <Target className="w-3 h-3 shrink-0" />
                              <span>{p.goalTitle}</span>
                            </span>
                          )}

                          {/* Badge de Frecuencia */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                            <Flame className="w-3 h-3 shrink-0" />
                            <span>{p.frecuenciaLabel}</span>
                          </span>

                          {/* Badge de Lesión o Biomecánica */}
                          {p.tieneLesiones ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/70">
                              <ShieldAlert className="w-3 h-3 shrink-0 text-rose-600" />
                              <span>Adaptación por Lesión</span>
                            </span>
                          ) : (
                            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                              <span>Sin Lesiones Declaradas</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Control de Colapso */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="text-[11px] font-semibold text-[#6B7A8D] hidden sm:inline">
                        {metaEntrenoCollapsed ? "Ver directriz" : "Ocultar"}
                      </span>
                      <button
                        type="button"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7A8D] hover:text-[#0B1929] bg-white shadow-2xs border border-[#E2E8F0] transition-transform cursor-pointer"
                        title={metaEntrenoCollapsed ? "Desplegar directriz" : "Colapsar"}
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            metaEntrenoCollapsed ? "" : "rotate-180"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo de la Tarjeta (Desplegable) */}
                  {!metaEntrenoCollapsed && (
                    <div className="p-4 pt-1">
                      {/* Los 4 Bloques Principales de Programación */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                        {/* 1. Frecuencia Semanal */}
                        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F4FA]">
                          <span className="text-[11px] font-semibold text-[#6B7A8D] block">Frecuencia Semanal</span>
                          <span className="text-base sm:text-lg font-extrabold text-[var(--brand-primary)]">
                            {p.diasSugeridos} <span className="text-xs font-medium text-[#6B7A8D]">días / sem</span>
                          </span>
                          <span className="text-[10px] text-[#6B7A8D] block truncate mt-0.5">
                            {p.fafInfo?.label || "Meta de microciclo"}
                          </span>
                        </div>

                        {/* 2. Split Sugerido */}
                        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F4FA]">
                          <span className="text-[11px] font-semibold text-indigo-700 block">División Sugerida</span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#0B1929] block line-clamp-1">
                            {p.splitSugerido}
                          </span>
                          <span className="text-[10px] text-[#6B7A8D] block truncate mt-0.5">
                            {p.splitSubtext}
                          </span>
                        </div>

                        {/* 3. Enfoque Fisiológico */}
                        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F4FA]">
                          <span className="text-[11px] font-semibold text-emerald-700 block">Enfoque de Etapa</span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#0B1929] block line-clamp-1">
                            {p.enfoqueFisiologico}
                          </span>
                          <span className="text-[10px] text-[#6B7A8D] block truncate mt-0.5">
                            {p.enfoqueSubtext}
                          </span>
                        </div>

                        {/* 4. Volumen & RPE */}
                        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F4FA]">
                          <span className="text-[11px] font-semibold text-amber-700 block">Volumen & RPE</span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#0B1929] block line-clamp-1">
                            {p.volumenRpe}
                          </span>
                          <span className="text-[10px] text-[#6B7A8D] block truncate mt-0.5">
                            {p.volumenSubtext}
                          </span>
                        </div>
                      </div>

                      {/* Dictamen Biomecánico & Criterio IA */}
                      {p.rationaleBiomecanico && (
                        <div className="mt-3 pt-2.5 border-t border-[#F0F4FA] flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-indigo-950">
                          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div className="leading-relaxed flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <strong className="text-indigo-900 font-bold">
                                Dictamen Biomecánico IA:
                              </strong>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200/60">
                                {p.badgeMotivo}
                              </span>
                            </div>
                            <p className="text-[#334155] leading-relaxed">{p.rationaleBiomecanico}</p>
                          </div>
                        </div>
                      )}

                      {/* Comparativas Inferiores: Lesiones vs Preferencias */}
                      <div className="mt-3 pt-2.5 border-t border-[#F0F4FA] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* Lesiones / Precauciones */}
                        <div className={`p-2.5 rounded-xl border ${
                          p.tieneLesiones
                            ? "bg-rose-50/70 border-rose-200/80 text-rose-950"
                            : "bg-emerald-50/60 border-emerald-200/70 text-emerald-950"
                        }`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {p.tieneLesiones ? (
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                            <span className={`font-bold text-[11px] uppercase tracking-wider ${
                              p.tieneLesiones ? "text-rose-800" : "text-emerald-800"
                            }`}>
                              {p.tieneLesiones ? "Lesiones & Precauciones Biomecánicas:" : "Estado Biomecánico:"}
                            </span>
                          </div>
                          <p className="leading-snug">
                            {p.tieneLesiones
                              ? `${p.lesionesRaw}. ${p.precaucionesLesion || ""}`
                              : "Sin antecedentes de lesiones ni cirugías articulares que limiten rangos de movimiento."}
                          </p>
                        </div>

                        {/* Preferencias de Modalidad & Deporte */}
                        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/70 text-blue-950">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Dumbbell className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-bold text-blue-800 block text-[11px] uppercase tracking-wider">
                              Modalidad & Preferencias a Incluir:
                            </span>
                          </div>
                          <p className="leading-snug">
                            {p.deportePref}
                            {p.horario ? ` • Horario habitual: ${p.horario}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Fila de Transición de Actividad Física */}
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-800 flex items-center justify-between gap-3 text-xs flex-wrap">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-slate-600 shrink-0" />
                          <span>
                            <strong className="text-slate-900">Historial Previo:</strong> {p.nivelPrevio} ({p.frecuenciaPrevia} días previos)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          <span>➔</span>
                          <span>
                            <strong className="text-slate-900">Meta Proyectada:</strong> {p.diasSugeridos} días/semana
                            {p.fafNotas ? ` (${p.fafNotas})` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <span className="font-semibold text-[#0B1929]">
                  {parsedActiveCycle.enfoque ? (
                    <>
                      <span>{parsedActiveCycle.enfoque}</span>
                      <span className="text-xs font-semibold text-[var(--brand-primary)] ml-1.5">
                        · Rutinas
                      </span>
                    </>
                  ) : (
                    <span>Rutinas</span>
                  )}
                  <span className="text-[#6B7A8D] font-normal ml-1.5">({rutinas.length})</span>
                </span>
                {Boolean(parsedActiveCycle.dias && parsedActiveCycle.semanas) && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-[var(--brand-primary)] border border-blue-200/60 shrink-0">
                    {parsedActiveCycle.dias} días • {parsedActiveCycle.semanas} sem
                  </span>
                )}
              </div>
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

                  {/* Rutina */}
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
                      <span className="text-xs">Rutina</span>
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
        const metaKcal = Number(macros.calorias) || smartPrescription?.targetKcal || 0;
        const metaProt = Number(macros.proteina) || smartPrescription?.proteinG || 0;
        const metaCarbs = Number(macros.carbohidratos) || smartPrescription?.carbsG || 0;
        const metaFat = Number(macros.grasas) || smartPrescription?.fatsG || 0;

        const diffKcal = metaKcal > 0 ? metaKcal - totKcal : 0;
        const diffProt = metaProt > 0 ? metaProt - totProt : 0;
        const diffCarbs = metaCarbs > 0 ? metaCarbs - totCarbs : 0;
        const diffFat = metaFat > 0 ? metaFat - totFat : 0;

        const pesoActual = cycleMetrica?.peso || latestMetrica?.peso || selected?.peso || null;
        const recWater = pesoActual ? (Math.round(pesoActual * 0.035 * 10) / 10).toFixed(1) : "2.5";

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
                {metaKcal > 0 && (
                  <span className={`ml-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                    diffKcal === 0 ? 'bg-emerald-100 text-emerald-800' : diffKcal > 0 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {diffKcal === 0 ? '🎯 Meta exacta' : diffKcal > 0 ? `Faltan ${diffKcal} kcal` : `Excedido +${Math.abs(diffKcal)} kcal`}
                  </span>
                )}
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
              
              {/* Left Column (Sticky on Desktop): Programación + Balance + Hidratación & Suplementos */}
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

                {/* Card 2: Desktop Live Macro Balance Card */}
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

                  {/* Macro Gap Tracking Box */}
                  {metaKcal > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-[#F0F4FA]">
                      {diffKcal === 0 ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>¡Meta calórica diaria alcanzada con precisión!</span>
                        </div>
                      ) : diffKcal > 0 ? (
                        <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/70 text-xs text-blue-900">
                          <div className="font-bold flex items-center justify-between text-blue-950 mb-1">
                            <span>Faltan por asignar:</span>
                            <span className="font-extrabold text-blue-700">{diffKcal} kcal</span>
                          </div>
                          <div className="text-[11px] text-blue-800 flex items-center gap-2">
                            <span>P: {diffProt > 0 ? `${diffProt}g` : '0g'}</span>
                            <span>•</span>
                            <span>C: {diffCarbs > 0 ? `${diffCarbs}g` : '0g'}</span>
                            <span>•</span>
                            <span>G: {diffFat > 0 ? `${diffFat}g` : '0g'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-bold">Excedido por +{Math.abs(diffKcal)} kcal sobre la meta diaria</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card 3: Hidratación y Suplementación */}
                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-blue-500" />
                    Hidratación y Suplementación
                  </h4>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider">Meta de Agua (Litros/día)</label>
                      {pesoActual && (
                        <button
                          type="button"
                          onClick={() => setDiaForm(p => ({ ...p, aguaLitros: recWater }))}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          💧 Sugerir ({recWater} L)
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.1"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-blue-500 transition-colors"
                        value={diaForm.aguaLitros || ""}
                        onChange={e => setDiaForm(p => ({ ...p, aguaLitros: e.target.value }))}
                        placeholder="Ej. 2.5"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94A3B8]">L / día</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                      Suplementación Diaria Prescrita
                    </label>
                    <textarea 
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-xs text-[#0B1929] focus:outline-none focus:border-purple-500 transition-colors min-h-[64px]"
                      value={diaForm.suplementos || ""}
                      onChange={e => setDiaForm(p => ({ ...p, suplementos: e.target.value }))}
                      placeholder="Ej. Creatina 5g con el desayuno, Multivitamínico 1 cápsula con almuerzo..."
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {["+ Creatina 5g", "+ Proteína Whey", "+ Multivitamínico", "+ Omega 3", "+ Magnesio"].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const cur = diaForm.suplementos ? diaForm.suplementos.trim() + ", " : "";
                            setDiaForm(p => ({ ...p, suplementos: cur + tag.replace('+ ', '') }));
                          }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Lista de Comidas (Siempre Desplegadas y Visibles) */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-[var(--brand-primary)]" />
                      Comidas y Distribución ({diaForm.comidas.length})
                    </h3>
                    <p className="text-xs text-[#6B7A8D] mt-0.5">Arrastra desde el icono izquierdo para reordenar las tomas</p>
                  </div>

                  {/* Botón Auditar con IA */}
                  <button
                    type="button"
                    onClick={handleAuditDayWithAi}
                    disabled={isAuditingDay || diaForm.comidas.length === 0}
                    className="text-xs font-bold flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/80 hover:bg-purple-100 hover:text-purple-800 transition-all disabled:opacity-50 shadow-xs cursor-pointer"
                    title={isEstandar ? "Función exclusiva del Plan Premium" : "Auditar menú completo del día con IA Clínica"}
                  >
                    {isAuditingDay ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                        <span>Auditando día completo...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Auditar con IA</span>
                        {isEstandar && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full font-extrabold ml-0.5">
                            PRO
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </div>

                {/* Banner / Dictamen de Auditoría del Día */}
                {dayAuditResult && (
                  <div className={`mb-5 p-3.5 sm:p-4 rounded-2xl border transition-all animate-in fade-in ${
                    dayAuditResult.estado === "critico"
                      ? "bg-rose-50/80 border-rose-200/90 text-rose-950"
                      : dayAuditResult.estado === "advertencia"
                      ? "bg-amber-50/80 border-amber-200/90 text-amber-950"
                      : "bg-indigo-50/70 border-indigo-200/80 text-indigo-950"
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {dayAuditResult.estado === "aprobado" ? (
                          <div className="p-1.5 rounded-xl bg-indigo-100/80 text-indigo-700 shrink-0 mt-0.5">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-xl bg-amber-100/80 text-amber-700 shrink-0 mt-0.5">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                              Dictamen de Auditoría del Día (IA FLUX)
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              dayAuditResult.estado === "aprobado"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200/60"
                                : "bg-amber-100 text-amber-800 border border-amber-200/60"
                            }`}>
                              {dayAuditResult.estado === "aprobado" ? "Alineado" : "Con Advertencias"}
                            </span>
                            {dayAuditResult.caloriasTotales != null && (
                              <span className="text-xs font-semibold text-[#475569]">
                                Total: <strong className="text-[#0B1929]">{dayAuditResult.caloriasTotales} kcal</strong>
                                {macros.calorias ? ` / ${macros.calorias} kcal meta` : ""}
                                {dayAuditResult.desvioKcalPct !== undefined && (
                                  <span className={`ml-1 text-[11px] font-bold ${
                                    Math.abs(dayAuditResult.desvioKcalPct) <= 5 ? "text-emerald-700" : "text-amber-700"
                                  }`}>
                                    ({dayAuditResult.desvioKcalPct > 0 ? `+${dayAuditResult.desvioKcalPct}%` : `${dayAuditResult.desvioKcalPct}%`})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#334155] leading-relaxed">
                            {dayAuditResult.dictamenGeneral}
                          </p>
                          {Array.isArray(dayAuditResult.recomendaciones) && dayAuditResult.recomendaciones.length > 0 && (
                            <ul className="text-[11px] text-[#475569] list-disc list-inside mt-1 space-y-0.5">
                              {dayAuditResult.recomendaciones.map((rec, rIdx) => (
                                <li key={rIdx}>{rec}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDayAuditResult(null)}
                        className="text-[#94A3B8] hover:text-[#0B1929] p-1 rounded-lg hover:bg-white/60 transition-colors shrink-0"
                        title="Cerrar dictamen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

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
                      <div className="space-y-5">
                        {diaForm.comidas.map((c, i) => {
                          const mealKcal = Number(c.calorias) || 0;
                          const mealPct = metaKcal > 0 ? Math.round((mealKcal / metaKcal) * 100) : 0;
                          const otherMealsKcal = diaForm.comidas.reduce((sum, item, idx) => idx !== i ? sum + (Number(item.calorias) || 0) : sum, 0);
                          const remainingKcalAfterThis = metaKcal - otherMealsKcal - mealKcal;
                          const remainingPctAfterThis = metaKcal > 0 ? Math.round((remainingKcalAfterThis / metaKcal) * 100) : 0;
                          const opcionesList = c.opciones && c.opciones.length > 0 ? c.opciones : [c.opcion1 || ""];

                          return (
                            <SortableItem key={c._dndId} id={c._dndId}>
                              {({ dragHandle, isDragging }) => (
                                <div className={`bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 transition-all ${isDragging ? 'shadow-lg ring-2 ring-[var(--brand-primary)]/20 bg-white' : ''}`}>
                                  
                                  {/* Meal Card Top Header */}
                                  <div className="flex justify-between items-center mb-3.5 pb-2.5 border-b border-[#E2E8F0]/70">
                                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                      {dragHandle}
                                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-white border border-[#E2E8F0] text-[#0B1929]">
                                        Comida {i + 1}
                                      </span>

                                      {c.macrosCalculadosPorIa && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/70 flex items-center gap-1 animate-in fade-in">
                                          <Sparkles className="w-3 h-3 text-purple-600" />
                                          <span>Macros calculados con IA</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        type="button"
                                        onClick={() => duplicateComida(i)}
                                        className="text-[#6B7A8D] hover:text-[#0B1929] transition-colors p-1.5 rounded-lg hover:bg-gray-100 flex items-center gap-1 text-xs font-semibold"
                                        title="Duplicar esta comida"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Duplicar</span>
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => remComida(i)} 
                                        className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                                        title="Eliminar comida"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Row 1: Hora sugerida, Calorías de la toma (% restante) y Nombre de la toma */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                    {/* 1. Hora sugerida */}
                                    <div>
                                      <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                                        Hora sugerida (AM/PM)
                                      </label>
                                      <CustomSelect
                                        value={c.hora || ""}
                                        onChange={val => updComida(i, "hora", val)}
                                        placeholder="-- Seleccionar hora --"
                                        options={[
                                          { value: "", label: "-- Seleccionar hora --" },
                                          ...(c.hora && !HORAS_ESTANDAR_AM_PM.includes(c.hora)
                                            ? [{ value: c.hora, label: `${c.hora} (Actual)` }]
                                            : []),
                                          ...HORAS_ESTANDAR_AM_PM.map(hora => ({ value: hora, label: hora }))
                                        ]}
                                        icon={<Clock className="w-4 h-4 text-[#94A3B8]" />}
                                      />
                                    </div>

                                    {/* 2. Calorías de la toma (Definidas por el nutriólogo con indicador de % restante) */}
                                    <div>
                                      <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                                        Calorías de la toma
                                      </label>
                                      <div className="relative">
                                        <input 
                                          type="number"
                                          min="0"
                                          step="10"
                                          className="w-full pl-3.5 pr-12 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0B1929] font-bold focus:outline-none focus:border-[var(--brand-primary)] hover:border-[#CBD5E1] transition-colors" 
                                          value={c.calorias || ""} 
                                          onChange={e => updComida(i, "calorias", e.target.value)} 
                                          placeholder={metaKcal > 0 ? String(Math.round(metaKcal / Math.max(diaForm.comidas.length, 3))) : "0"} 
                                        />
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94A3B8] pointer-events-none">
                                          kcal
                                        </span>
                                      </div>
                                      {metaKcal > 0 && (
                                        <div className="mt-1 flex items-center justify-between text-[10.5px] px-0.5">
                                          <span className="text-[#6B7A8D]">
                                            {mealKcal > 0 ? `${mealPct}% del día` : "Sin definir"}
                                          </span>
                                          <span className={remainingKcalAfterThis < 0 ? "text-amber-700 font-bold" : remainingKcalAfterThis === 0 ? "text-emerald-600 font-bold" : "text-blue-600 font-medium"}>
                                            {remainingKcalAfterThis < 0 
                                              ? `+${Math.abs(remainingKcalAfterThis)} kcal excedido` 
                                              : remainingKcalAfterThis === 0 
                                              ? "✓ Meta del día cubierta" 
                                              : `Quedan ${remainingKcalAfterThis} kcal (${remainingPctAfterThis}%)`}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* 3. Nombre de la toma */}
                                    <div>
                                      <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                                        Nombre de la toma (opcional)
                                      </label>
                                      <input 
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] hover:border-[#CBD5E1] transition-colors" 
                                        value={c.nombre || ""} 
                                        onChange={e => updComida(i, "nombre", e.target.value)} 
                                        placeholder="Ej. Desayuno, Pre-entreno, Comida, Cena..." 
                                      />
                                    </div>
                                  </div>

                                  {/* Row 2: Opción Principal (A) con Switch Platillo vs Ingredientes */}
                                  <div className="mb-3.5 p-3.5 rounded-xl bg-white border border-[#E2E8F0]">
                                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                      <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          Opción Principal (A)
                                        </span>
                                        {/* Switch Platillo vs Ingredientes */}
                                        <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
                                          <button
                                            type="button"
                                            onClick={() => updComida(i, "modoEdicion", "platillo")}
                                            className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                                              (c.modoEdicion || "platillo") === "platillo"
                                                ? "bg-white text-[var(--brand-primary)] shadow-2xs font-bold"
                                                : "text-[#6B7A8D] hover:text-[#0B1929]"
                                            }`}
                                          >
                                            <span>🍲</span>
                                            <span>Platillo</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => updComida(i, "modoEdicion", "ingredientes")}
                                            className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                                              c.modoEdicion === "ingredientes"
                                                ? "bg-white text-emerald-700 shadow-2xs font-bold"
                                                : "text-[#6B7A8D] hover:text-[#0B1929]"
                                            }`}
                                          >
                                            <span>🥑</span>
                                            <span>Ingredientes</span>
                                            {c.ingredientesSeleccionados?.length > 0 && (
                                              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                                                {c.ingredientesSeleccionados.length}
                                              </span>
                                            )}
                                          </button>
                                        </div>

                                        {/* Botón Lupa de Catálogo FLUX a la derecha de Ingredientes */}
                                        <button
                                          type="button"
                                          onClick={() => setDishCatalogOpenMap(prev => ({ ...prev, [i]: !prev[i] }))}
                                          className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                                            dishCatalogOpenMap[i]
                                              ? "bg-purple-100 text-purple-700 border-purple-300 shadow-2xs ring-1 ring-purple-300"
                                              : "bg-white hover:bg-gray-50 text-[#6B7A8D] hover:text-[#0B1929] border-[#E2E8F0]"
                                          }`}
                                          title={dishCatalogOpenMap[i] ? "Cerrar catálogo de platillos" : "Explorar catálogo de platillos FLUX"}
                                        >
                                          <Search className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Panel Desplegable de Catálogo FLUX (al pulsar la lupa) */}
                                    {dishCatalogOpenMap[i] && (
                                      <div className="mb-3 p-3 bg-purple-50/50 rounded-xl border border-purple-200 animate-in fade-in transition-all">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                          <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                                            <Utensils className="w-3.5 h-3.5 text-purple-600" />
                                            Catálogo de Platillos FLUX
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setDishCatalogOpenMap(prev => ({ ...prev, [i]: false }))}
                                            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
                                            title="Cerrar catálogo"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        {/* Barra de búsqueda */}
                                        <div className="relative mb-2">
                                          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                          <input
                                            type="text"
                                            value={dishCatalogSearchMap[i] || ""}
                                            onChange={e => setDishCatalogSearchMap(prev => ({ ...prev, [i]: e.target.value }))}
                                            placeholder="Buscar platillo (ej. Huevo, Pollo con arroz, Avena, Salmón, Chilaquiles)..."
                                            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#0B1929] focus:outline-none focus:border-purple-500"
                                          />
                                          {dishCatalogSearchMap[i] && (
                                            <button
                                              type="button"
                                              onClick={() => setDishCatalogSearchMap(prev => ({ ...prev, [i]: "" }))}
                                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>

                                        {/* Filtros de Categorías */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-2.5 no-scrollbar">
                                          {CATEGORIAS_PLATILLOS.map(cat => {
                                            const activeCat = dishCatalogCatMap[i] || "todos";
                                            const isSelected = activeCat === cat.id;
                                            return (
                                              <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setDishCatalogCatMap(prev => ({ ...prev, [i]: cat.id }))}
                                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-all flex items-center gap-1 border cursor-pointer ${
                                                  isSelected
                                                    ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                                                    : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50 hover:text-[#0B1929]"
                                                }`}
                                              >
                                                <span>{cat.icono}</span>
                                                <span>{cat.nombre}</span>
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {/* Grid de Platillos en formato visual similar a ingredientes */}
                                        <div className="border border-[#E2E8F0] rounded-xl bg-white p-2.5 max-h-56 overflow-y-auto">
                                          {(() => {
                                            const platillos = buscarPlatillosCatalogo(
                                              dishCatalogSearchMap[i] || "",
                                              dishCatalogCatMap[i] || "todos"
                                            );
                                            if (platillos.length === 0) {
                                              return (
                                                <div className="text-center py-6 text-xs text-[#6B7A8D]">
                                                  No se encontraron platillos para esa búsqueda.
                                                </div>
                                              );
                                            }
                                            return (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {platillos.map(item => (
                                                  <div
                                                    key={item.id}
                                                    onClick={() => handleSelectDishFromCatalog(i, item)}
                                                    className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E2E8F0] hover:border-purple-300 hover:bg-purple-50/50 cursor-pointer select-none transition-all group"
                                                  >
                                                    <img
                                                      src={item.foto_url}
                                                      alt={item.nombre}
                                                      className="w-12 h-12 object-cover rounded-lg shrink-0 border border-gray-100 group-hover:scale-105 transition-transform"
                                                      loading="lazy"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                      <p className="text-xs font-bold text-[#0B1929] leading-tight line-clamp-2">
                                                        {item.nombre}
                                                      </p>
                                                      <div className="flex items-center gap-2 mt-1">
                                                        {item.calorias && (
                                                          <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                            {item.calorias} kcal
                                                          </span>
                                                        )}
                                                        <span className="text-[10px] text-[#6B7A8D] capitalize">
                                                          {item.categoria}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                    {(c.modoEdicion || "platillo") === "platillo" ? (
                                      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                                        {/* Foto con controles incorporados a la izquierda del cuadro gris */}
                                        {c.foto_url ? (
                                          <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-2xs bg-white group self-center sm:self-start">
                                            <CachedImage 
                                              src={c.foto_url} 
                                              alt="Platillo" 
                                              className="w-full h-full object-cover" 
                                            />
                                            {/* Botón Cambiar Foto */}
                                            <label 
                                              className="absolute inset-x-0 bottom-0 py-1 bg-black/65 hover:bg-black/85 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors backdrop-blur-xs"
                                              title="Cambiar foto ilustrativa"
                                            >
                                              <Camera className="w-3 h-3" />
                                              <span>Cambiar</span>
                                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(i, e)} disabled={saving} />
                                            </label>
                                            {/* Botón Quitar Foto */}
                                            <button 
                                              type="button" 
                                              onClick={() => updComida(i, "foto_url", "")} 
                                              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-sm"
                                              title="Quitar foto"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          /* Cuadro para subir foto incorporado a la izquierda */
                                          <label 
                                            className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[var(--brand-primary)] hover:bg-blue-50/30 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all group self-center sm:self-start"
                                            title="Subir foto ilustrativa del platillo"
                                          >
                                            <div className="w-8 h-8 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] group-hover:text-[var(--brand-primary)] group-hover:border-blue-200 shadow-2xs transition-colors">
                                              <Camera className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] font-bold text-[#6B7A8D] group-hover:text-[var(--brand-primary)] transition-colors">
                                              Subir foto
                                            </span>
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(i, e)} disabled={saving} />
                                          </label>
                                        )}

                                        {/* Cuadro gris donde se describe el alimento */}
                                        <textarea 
                                          className="flex-1 w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] min-h-[112px] sm:min-h-[128px] resize-y" 
                                          value={opcionesList[0] || ""} 
                                          onChange={e => updMealOption(i, 0, e.target.value)} 
                                          placeholder="Ingredientes, porciones (ej. 3 huevos, 50g avena, 1 plátano) y modo de preparación..." 
                                        />
                                      </div>
                                    ) : (
                                      /* Constructor por Ingredientes con Checkboxes */
                                      <div className="space-y-2.5">
                                        {/* Barra de búsqueda */}
                                        <div className="relative">
                                          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                          <input
                                            type="text"
                                            value={ingredientSearchMap[i] || ""}
                                            onChange={e => setIngredientSearchMap(prev => ({ ...prev, [i]: e.target.value }))}
                                            placeholder="Buscar ingrediente (ej. Tortilla, Carne molida, Chipotle, Aguacate, Huevo)..."
                                            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-xs text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                                          />
                                          {ingredientSearchMap[i] && (
                                            <button
                                              type="button"
                                              onClick={() => setIngredientSearchMap(prev => ({ ...prev, [i]: "" }))}
                                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>

                                        {/* Filtros de Categorías */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
                                          {CATEGORIAS_INGREDIENTES.map(cat => {
                                            const activeCat = ingredientCatMap[i] || "todos";
                                            const isSelected = activeCat === cat.id;
                                            return (
                                              <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setIngredientCatMap(prev => ({ ...prev, [i]: cat.id }))}
                                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-all flex items-center gap-1 border ${
                                                  isSelected
                                                    ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-2xs"
                                                    : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50 hover:text-[#0B1929]"
                                                }`}
                                              >
                                                <span>{cat.icono}</span>
                                                <span>{cat.nombre}</span>
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {/* Bandeja de seleccionados */}
                                        {c.ingredientesSeleccionados?.length > 0 && (
                                          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                              <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                {c.ingredientesSeleccionados.length} ingredientes seleccionados:
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => updComida(i, "ingredientesSeleccionados", [])}
                                                className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
                                              >
                                                Limpiar selección
                                              </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {c.ingredientesSeleccionados.map(ing => (
                                                <span
                                                  key={ing}
                                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-emerald-300 text-xs font-semibold text-emerald-900 shadow-2xs"
                                                >
                                                  {ing}
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleIngrediente(i, ing)}
                                                    className="text-emerald-500 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Grid de Ingredientes con Checkboxes */}
                                        <div className="border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] p-2.5 max-h-56 overflow-y-auto">
                                          {(() => {
                                            const items = buscarIngredientes(
                                              ingredientSearchMap[i] || "",
                                              ingredientCatMap[i] || "todos"
                                            );
                                            if (items.length === 0) {
                                              return (
                                                <div className="text-center py-6 text-xs text-[#6B7A8D]">
                                                  No se encontraron ingredientes con ese término.
                                                </div>
                                              );
                                            }
                                            return (
                                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                                {items.map(item => {
                                                  const isChecked = (c.ingredientesSeleccionados || []).includes(item.nombre);
                                                  return (
                                                    <div
                                                      key={item.id}
                                                      onClick={() => toggleIngrediente(i, item.nombre)}
                                                      className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                                                        isChecked
                                                          ? "bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-400"
                                                          : "bg-white border-[#E2E8F0] hover:border-gray-300 hover:bg-gray-50"
                                                      }`}
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                                                      />
                                                      <img
                                                        src={item.foto}
                                                        alt={item.nombre}
                                                        className="w-6 h-6 object-contain rounded shrink-0 bg-white"
                                                        loading="lazy"
                                                        onError={e => { e.currentTarget.style.display = 'none'; }}
                                                      />
                                                      <span className="text-xs font-medium text-[#0B1929] truncate flex-1" title={item.nombre}>
                                                        {item.nombre}
                                                      </span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* Pie del Constructor: Botón Generar con IA */}
                                        <div className="pt-1 flex items-center justify-between gap-3 flex-wrap">
                                          <span className="text-[11px] text-[#6B7A8D]">
                                            {(c.ingredientesSeleccionados || []).length >= 2 
                                              ? "Combina tus ingredientes en un platillo real del mundo."
                                              : "Selecciona al menos 2 ingredientes para generar el platillo."}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleGenerateDishFromIngredients(i)}
                                            disabled={aiGeneratingDishIndex === i || (c.ingredientesSeleccionados || []).length === 0}
                                            className="text-xs font-bold flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                          >
                                            {aiGeneratingDishIndex === i ? (
                                              <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Creando platillo...</span>
                                              </>
                                            ) : (
                                              <>
                                                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                                <span>Generar Platillo con IA {(c.ingredientesSeleccionados || []).length > 0 ? `(${c.ingredientesSeleccionados.length})` : ""}</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Alerta clínica de alergias o aversiones */}
                                    {c.evaluacionClinica ? (
                                       <div className={`mt-2.5 p-2.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in transition-all ${
                                         c.evaluacionClinica.tipo === "peligro"
                                           ? "bg-rose-50/90 border-rose-200 text-rose-950"
                                           : c.evaluacionClinica.tipo === "advertencia"
                                           ? "bg-amber-50/90 border-amber-200 text-amber-950"
                                           : c.evaluacionClinica.tipo === "exito"
                                           ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
                                           : "bg-blue-50/90 border-blue-200 text-blue-950"
                                       }`}>
                                         {c.evaluacionClinica.tipo === "peligro" ? (
                                           <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                         ) : c.evaluacionClinica.tipo === "advertencia" ? (
                                           <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                         ) : c.evaluacionClinica.tipo === "exito" ? (
                                           <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                         ) : (
                                           <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                         )}
                                         <div className="min-w-0 flex-1">
                                           <div className="flex items-center gap-2 flex-wrap">
                                             <span className="font-bold text-xs">{c.evaluacionClinica.titulo}</span>
                                             {c.evaluacionClinica.tipo === "exito" && (
                                               <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                                                 Alimento Favorito
                                               </span>
                                             )}
                                             {c.evaluacionClinica.tipo === "advertencia" && (
                                               <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase tracking-wider">
                                                 Aversión
                                               </span>
                                             )}
                                             {c.evaluacionClinica.tipo === "peligro" && (
                                               <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold uppercase tracking-wider">
                                                 Alérgeno Crítico
                                               </span>
                                             )}
                                           </div>
                                           <div className="text-[11.5px] leading-relaxed mt-1">
                                             {c.evaluacionClinica.mensaje}
                                           </div>
                                           <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-75">
                                             <span>Análisis asistido por IA orientativo</span>
                                             <button
                                               type="button"
                                               onClick={() => setMsg && setMsg("✓ Respuesta de IA reportada para revisión.")}
                                               className="underline hover:opacity-100 cursor-pointer font-semibold"
                                             >
                                               Reportar IA
                                             </button>
                                           </div>
                                         </div>
                                       </div>
                                     ) : c.alertaClinica ? (
                                       <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 animate-in fade-in">
                                         <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                         <div className="min-w-0">
                                           <div className="font-bold text-amber-950">Aviso clínico del expediente del paciente:</div>
                                           <div className="text-[11px] leading-relaxed mt-0.5">
                                             {typeof c.alertaClinica === 'string' ? c.alertaClinica : c.alertaClinica.mensaje}
                                           </div>
                                         </div>
                                       </div>
                                     ) : null}

                                    </div>

                                  {/* Row 3: Opciones Alternativas Dinámicas (B, C, D...) con Platillos, Ingredientes y Catálogo FLUX */}
                                  {opcionesList.length > 1 && (
                                    <div className="space-y-3.5 mb-3.5">
                                      {opcionesList.slice(1).map((altText, altIdx) => {
                                        const actualIdx = altIdx + 1;
                                        const optionLetter = String.fromCharCode(65 + actualIdx); // B, C, D...
                                        const optKey = `${i}_${actualIdx}`;
                                        const modo = c.opcionesModoEdicion?.[actualIdx] || "platillo";
                                        const selectedIngs = c.opcionesIngredientes?.[actualIdx] || [];
                                        const isCatOpen = Boolean(dishCatalogOpenMap[optKey]);
                                        const catSearch = dishCatalogSearchMap[optKey] || "";
                                        const catActive = dishCatalogCatMap[optKey] || "todos";
                                        const ingSearch = ingredientSearchMap[optKey] || "";
                                        const ingActive = ingredientCatMap[optKey] || "todos";
                                        const isGen = Boolean(aiGeneratingDishMap[optKey]);

                                        return (
                                          <div key={actualIdx} className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
                                            {/* Header de la Opción Alternativa */}
                                            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                              <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                                  Opción Alternativa ({optionLetter})
                                                </span>

                                                {/* Switch Platillo vs Ingredientes */}
                                                <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
                                                  <button
                                                    type="button"
                                                    onClick={() => setMealOptionMode(i, actualIdx, "platillo")}
                                                    className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                                                      modo === "platillo"
                                                        ? "bg-white text-[var(--brand-primary)] shadow-2xs font-bold"
                                                        : "text-[#6B7A8D] hover:text-[#0B1929]"
                                                    }`}
                                                  >
                                                    <span>🍲</span>
                                                    <span>Platillo</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setMealOptionMode(i, actualIdx, "ingredientes")}
                                                    className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                                                      modo === "ingredientes"
                                                        ? "bg-white text-emerald-700 shadow-2xs font-bold"
                                                        : "text-[#6B7A8D] hover:text-[#0B1929]"
                                                    }`}
                                                  >
                                                    <span>🥑</span>
                                                    <span>Ingredientes</span>
                                                    {selectedIngs.length > 0 && (
                                                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                                                        {selectedIngs.length}
                                                      </span>
                                                    )}
                                                  </button>
                                                </div>

                                                {/* Botón Lupa de Catálogo FLUX */}
                                                <button
                                                  type="button"
                                                  onClick={() => setDishCatalogOpenMap(prev => ({ ...prev, [optKey]: !prev[optKey] }))}
                                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                                                    isCatOpen
                                                      ? "bg-purple-100 text-purple-700 border-purple-300 shadow-2xs ring-1 ring-purple-300"
                                                      : "bg-white hover:bg-gray-50 text-[#6B7A8D] hover:text-[#0B1929] border-[#E2E8F0]"
                                                  }`}
                                                  title={isCatOpen ? "Cerrar catálogo de platillos" : `Explorar catálogo de platillos FLUX para Opción ${optionLetter}`}
                                                >
                                                  <Search className="w-3.5 h-3.5" />
                                                </button>
                                              </div>

                                              {/* Botón Quitar Opción */}
                                              <button
                                                type="button"
                                                onClick={() => removeMealOption(i, actualIdx)}
                                                className="text-red-400 hover:text-red-600 p-1 text-xs font-semibold flex items-center gap-1 rounded hover:bg-red-50 cursor-pointer transition-colors"
                                                title="Eliminar esta opción"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" /> Quitar opción
                                              </button>
                                            </div>

                                            {/* Panel Desplegable de Catálogo FLUX para esta opción alternativa */}
                                            {isCatOpen && (
                                              <div className="mb-3 p-3 bg-purple-50/50 rounded-xl border border-purple-200 animate-in fade-in transition-all">
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                                                    <Utensils className="w-3.5 h-3.5 text-purple-600" />
                                                    Catálogo de Platillos FLUX (Opción {optionLetter})
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => setDishCatalogOpenMap(prev => ({ ...prev, [optKey]: false }))}
                                                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
                                                    title="Cerrar catálogo"
                                                  >
                                                    <X className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>

                                                {/* Barra de búsqueda */}
                                                <div className="relative mb-2">
                                                  <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                  <input
                                                    type="text"
                                                    value={catSearch}
                                                    onChange={e => setDishCatalogSearchMap(prev => ({ ...prev, [optKey]: e.target.value }))}
                                                    placeholder="Buscar platillo (ej. Huevo, Pollo con arroz, Avena, Salmón)..."
                                                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#0B1929] focus:outline-none focus:border-purple-500"
                                                  />
                                                  {catSearch && (
                                                    <button
                                                      type="button"
                                                      onClick={() => setDishCatalogSearchMap(prev => ({ ...prev, [optKey]: "" }))}
                                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                                                    >
                                                      <X className="w-3.5 h-3.5" />
                                                    </button>
                                                  )}
                                                </div>

                                                {/* Filtros de Categorías */}
                                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-2.5 no-scrollbar">
                                                  {CATEGORIAS_PLATILLOS.map(cat => {
                                                    const isSelected = catActive === cat.id;
                                                    return (
                                                      <button
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => setDishCatalogCatMap(prev => ({ ...prev, [optKey]: cat.id }))}
                                                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-all flex items-center gap-1 border cursor-pointer ${
                                                          isSelected
                                                            ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                                                            : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50 hover:text-[#0B1929]"
                                                        }`}
                                                      >
                                                        <span>{cat.icono}</span>
                                                        <span>{cat.nombre}</span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>

                                                {/* Grid de Platillos */}
                                                <div className="border border-[#E2E8F0] rounded-xl bg-white p-2.5 max-h-56 overflow-y-auto">
                                                  {(() => {
                                                    const platillos = buscarPlatillosCatalogo(catSearch, catActive);
                                                    if (platillos.length === 0) {
                                                      return (
                                                        <div className="text-center py-6 text-xs text-[#6B7A8D]">
                                                          No se encontraron platillos para esa búsqueda.
                                                        </div>
                                                      );
                                                    }
                                                    return (
                                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                        {platillos.map(item => (
                                                          <div
                                                            key={item.id}
                                                            onClick={() => handleSelectDishFromCatalog(i, item, actualIdx)}
                                                            className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E2E8F0] hover:border-purple-300 hover:bg-purple-50/50 cursor-pointer select-none transition-all group"
                                                          >
                                                            <img
                                                             src={item.foto_url}
                                                             alt={item.nombre}
                                                             className="w-12 h-12 object-cover rounded-lg shrink-0 border border-gray-100 group-hover:scale-105 transition-transform"
                                                             loading="lazy"
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                              <p className="text-xs font-bold text-[#0B1929] leading-tight line-clamp-2">
                                                                {item.nombre}
                                                              </p>
                                                              <div className="flex items-center gap-2 mt-1">
                                                                {item.calorias && (
                                                                  <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                                    {item.calorias} kcal
                                                                  </span>
                                                                )}
                                                                <span className="text-[10px] text-[#6B7A8D] capitalize">
                                                                  {item.categoria}
                                                                </span>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    );
                                                  })()}
                                                </div>
                                              </div>
                                            )}

                                            {/* Modo Platillo vs Modo Ingredientes */}
                                            {modo === "platillo" ? (
                                              /* Modo Platillo: Sin foto, área de texto completa */
                                              <textarea 
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] min-h-[96px] resize-y transition-colors" 
                                                value={altText || ""} 
                                                onChange={e => updMealOption(i, actualIdx, e.target.value)} 
                                                placeholder={`Ingredientes, porciones y preparación de la alternativa ${optionLetter}...`} 
                                              />
                                            ) : (
                                              /* Constructor por Ingredientes */
                                              <div className="space-y-2.5">
                                                {/* Barra de búsqueda de ingredientes */}
                                                <div className="relative">
                                                  <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                  <input
                                                    type="text"
                                                    value={ingSearch}
                                                    onChange={e => setIngredientSearchMap(prev => ({ ...prev, [optKey]: e.target.value }))}
                                                    placeholder="Buscar ingrediente (ej. Pollo, Arroz, Brócoli, Avena, Huevo)..."
                                                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-xs text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                                                  />
                                                  {ingSearch && (
                                                    <button
                                                      type="button"
                                                      onClick={() => setIngredientSearchMap(prev => ({ ...prev, [optKey]: "" }))}
                                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                                                    >
                                                      <X className="w-3.5 h-3.5" />
                                                    </button>
                                                  )}
                                                </div>

                                                {/* Filtros de Categorías de Ingredientes */}
                                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
                                                  {CATEGORIAS_INGREDIENTES.map(cat => {
                                                    const isSelected = ingActive === cat.id;
                                                    return (
                                                      <button
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => setIngredientCatMap(prev => ({ ...prev, [optKey]: cat.id }))}
                                                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-all flex items-center gap-1 border cursor-pointer ${
                                                          isSelected
                                                            ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-2xs"
                                                            : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50 hover:text-[#0B1929]"
                                                        }`}
                                                      >
                                                        <span>{cat.icono}</span>
                                                        <span>{cat.nombre}</span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>

                                                {/* Bandeja de seleccionados */}
                                                {selectedIngs.length > 0 && (
                                                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                                      <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                        {selectedIngs.length} ingredientes seleccionados:
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() => clearIngredientes(i, actualIdx)}
                                                        className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
                                                      >
                                                        Limpiar selección
                                                      </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                      {selectedIngs.map(ing => (
                                                        <span
                                                          key={ing}
                                                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-emerald-300 text-xs font-semibold text-emerald-900 shadow-2xs"
                                                        >
                                                          {ing}
                                                          <button
                                                            type="button"
                                                            onClick={() => toggleIngrediente(i, ing, actualIdx)}
                                                            className="text-emerald-500 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                                                          >
                                                            <X className="w-3 h-3" />
                                                          </button>
                                                        </span>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Grid de Ingredientes con Checkboxes */}
                                                <div className="border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] p-2.5 max-h-56 overflow-y-auto">
                                                  {(() => {
                                                    const items = buscarIngredientes(ingSearch, ingActive);
                                                    if (items.length === 0) {
                                                      return (
                                                        <div className="text-center py-6 text-xs text-[#6B7A8D]">
                                                          No se encontraron ingredientes con ese término.
                                                        </div>
                                                      );
                                                    }
                                                    return (
                                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                        {items.map(item => {
                                                          const isChecked = selectedIngs.includes(item.nombre);
                                                          return (
                                                            <div
                                                              key={item.id}
                                                              onClick={() => toggleIngrediente(i, item.nombre, actualIdx)}
                                                              className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                                                                isChecked
                                                                  ? "bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-400"
                                                                  : "bg-white border-[#E2E8F0] hover:border-gray-300 hover:bg-gray-50"
                                                              }`}
                                                            >
                                                              <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {}}
                                                                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                                                              />
                                                              <img
                                                                src={item.foto}
                                                                alt={item.nombre}
                                                                className="w-6 h-6 object-contain rounded shrink-0 bg-white"
                                                                loading="lazy"
                                                                onError={e => { e.currentTarget.style.display = 'none'; }}
                                                              />
                                                              <span className="text-xs font-medium text-[#0B1929] truncate flex-1" title={item.nombre}>
                                                                {item.nombre}
                                                              </span>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    );
                                                  })()}
                                                </div>

                                                {/* Pie del Constructor: Botón Generar con IA */}
                                                <div className="pt-1 flex items-center justify-between gap-3 flex-wrap">
                                                  <span className="text-[11px] text-[#6B7A8D]">
                                                    {selectedIngs.length >= 2 
                                                      ? `Combina tus ingredientes para la Opción ${optionLetter}.`
                                                      : "Selecciona al menos 2 ingredientes para generar el platillo."}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleGenerateDishFromIngredients(i, actualIdx)}
                                                    disabled={isGen || selectedIngs.length === 0}
                                                    className="text-xs font-bold flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                                  >
                                                    {isGen ? (
                                                      <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        <span>Creando platillo...</span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                                        <span>Generar Platillo con IA {selectedIngs.length > 0 ? `(${selectedIngs.length})` : ""}</span>
                                                      </>
                                                    )}
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Botones de Opciones Alternativas */}
                                  <div className="flex items-center gap-2 flex-wrap mb-4">
                                    <button
                                      type="button"
                                      onClick={() => addMealOption(i)}
                                      className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[#CBD5E1] text-[#6B7A8D] hover:text-[#0B1929] hover:border-[#94A3B8] transition-colors font-semibold"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Agregar Opción Alternativa</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleGenerateAltWithAi(i)}
                                      disabled={aiAltIndex === i}
                                      className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors font-semibold border border-purple-200 disabled:opacity-50"
                                      title="Genera automáticamente una alternativa que iguala con precisión los mismos macros de la Opción A"
                                    >
                                      {aiAltIndex === i ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          <span>Generando equivalente...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                          <span>Generar Alternativa con IA</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {/* Row 5: Macronutrientes por comida */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {[
                                      ["calorias", "Calorías (Kcal)"], 
                                      ["proteina", "Proteína (g)"], 
                                      ["carbohidratos", "Carbos (g)"], 
                                      ["grasas", "Grasas (g)"]
                                    ].map(([f, lb]) => (
                                      <div key={f} className="bg-white p-2.5 rounded-xl border border-[#E2E8F0]">
                                        <label className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1 truncate">{lb}</label>
                                        <input 
                                          type="number" 
                                          className="w-full px-2 py-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-bold text-[#0B1929] text-center focus:outline-none focus:border-[var(--brand-primary)]" 
                                          value={c[f] || ""} 
                                          onChange={e => updComida(i, f, e.target.value)} 
                                          placeholder="0" 
                                        />
                                      </div>
                                    ))}
                                  </div>

                                </div>
                              )}
                            </SortableItem>
                          );
                        })}
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

      {/* ── Modal de Catálogo de Platillos FLUX ── */}
      {photoCatalogModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#0B1929] flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[var(--brand-primary)]" />
                  Catálogo de Platillos y Recetas FLUX
                </h3>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Selecciona una imagen de alta resolución para la Comida {photoCatalogModal.mealIndex + 1}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setPhotoCatalogModal(null)} 
                className="p-2 text-[#6B7A8D] hover:text-[#0B1929] rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Category Filter */}
            <div className="px-6 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder="Buscar por platillo o ingrediente (ej. Huevo, Avena, Pollo, Salmón, Ensalada)..."
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {["Todos", "Desayuno", "Pollo", "Carne", "Pescado", "Bowls", "Ensalada", "Snack"].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                      catalogCategory === cat 
                        ? 'bg-[var(--brand-primary)] text-white' 
                        : 'bg-white border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Dish Cards Grid */}
            <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-4">
              {CATALOGO_PLATILLOS_BASE.filter(item => {
                const matchesCat = catalogCategory === "Todos" || item.categoria?.toLowerCase().includes(catalogCategory.toLowerCase());
                const q = catalogSearch.toLowerCase().trim();
                const matchesSearch = !q || item.titulo?.toLowerCase().includes(q) || (item.keywords || []).some(k => k.toLowerCase().includes(q));
                return matchesCat && matchesSearch;
              }).map(item => (
                <div 
                  key={item.id}
                  onClick={() => {
                    const idx = photoCatalogModal.mealIndex;
                    updComida(idx, "foto_url", item.foto_url);
                    // Si el nombre de la comida es genérico, sugerir el nombre del platillo
                    const curComida = diaForm.comidas[idx];
                    if (!curComida?.nombre || curComida.nombre.startsWith("Comida ")) {
                      updComida(idx, "nombre", item.titulo);
                    }
                    setPhotoCatalogModal(null);
                    setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Foto asignada del catálogo</div>);
                  }}
                  className="group cursor-pointer rounded-2xl border border-[#E2E8F0] overflow-hidden hover:border-[var(--brand-primary)] hover:shadow-md transition-all flex flex-col bg-white"
                >
                  <div className="aspect-4/3 relative overflow-hidden bg-gray-100">
                    <img 
                      src={item.foto_url} 
                      alt={item.titulo} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      loading="lazy"
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold backdrop-blur-xs">
                      ~{item.caloriasAprox} kcal
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-bold text-[#0B1929] line-clamp-1 group-hover:text-[var(--brand-primary)] transition-colors">
                      {item.titulo}
                    </div>
                    <div className="text-[10px] text-[#6B7A8D] mt-0.5 uppercase tracking-wider font-semibold">
                      {item.categoria}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
              <button
                type="button"
                onClick={() => setPhotoCatalogModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B7A8D] hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
        latestMetrica={cycleMetrica || latestMetrica}
        clinicalRec={clinicalRec}
        cicloNombre={cicloSel?.nombre || ""}
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

      {/* ── Progreso Histórico Plan a Plan a Pantalla Completa ── */}
      {showHistorico && selected && (
        <ProgresoHistoricoModal
          isOpen={showHistorico}
          onClose={() => setShowHistorico(false)}
          cliente={selected}
          ciclos={ciclos}
          brand={brand}
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
