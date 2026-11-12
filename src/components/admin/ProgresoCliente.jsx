import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import {
  calculateBodyComposition,
  enrichMetrica,
  prepareMetricaPayload,
  normalizeSexo,
  calcEdadFromBirthdate,
  getMetodoLabel,
  linkMetricasToCiclos,
  GOAL_PRESETS,
  ACTIVITY_FACTORS,
  getGoalPresetInfo,
  getActivityFactorInfo,
  inferGoalFromText,
  inferFafFromAnamnesis,
  generateSmartMacroPrescription,
  generateSmartTrainingPrescription,
} from "../../lib/bodyComposition";
import { createPortal } from "react-dom";
import { dbPeek, dbGet, dbGetFresh, updateQueryCache, dbPost, dbPatch, dbDel, storageUpload, storageDelete } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { useBackButton } from "../../lib/backButtonHandler";
import { generateProgresoPDF } from "../../utils/pdf";
import { parseFotos, getSemanasConFecha, compressImageIfNeeded } from "../../utils/helpers";
import {
  Scale, Microscope, Ruler, Stethoscope, BarChart2, Dumbbell,
  Calendar, Edit2, Eye, Camera, FileText, Activity, BicepsFlexed, Plus, Trash2, Heart, ArrowUp, ArrowDown, X, AlertCircle, CheckCircle2, Target, Lock,
  UtensilsCrossed, Droplets, Check, ChevronDown, ClipboardList, ArrowLeft, Save, Layers, Clock, Zap, Utensils, Moon, Sparkles, Flame, Calculator, Ban, Loader2, SlidersHorizontal, RotateCcw, Upload
} from "lucide-react";
import { EvolutionCharts } from "../ui/EvolutionCharts";
import { BeforeAfterComparator } from "../ui/BeforeAfterComparator";
import { GRUPO_LABELS, normalizeMuscleGroup } from "../../lib/constants";
import { ListSkeleton } from "../ui/Skeleton";
import { ConfirmModal } from "../ui/ConfirmModal";
import ExpedienteClinicoModal from "../clinical/ExpedienteClinicoModal";
import { peekClinicalRecord, fetchClinicalRecord, saveClinicalRecord } from "../../lib/clinicalRecord";
import { auditMacroPrescriptionWithAi, syncDualDomainSummariesInBackground, extractInbodyFromDocument } from "../../lib/clinicalAi";
import {
  SMAE_GROUPS,
  DIET_RESTRICTION_TAGS,
  autoDistributeSmaeFromMacros,
  calculateSmaeTotals,
} from "../../lib/smaeData";
import UpgradeModal from "../ui/UpgradeModal";

const FIELDS_BASICAS = [
  { key: "peso", label: "Peso (kg)", type: "number", step: "0.1" },
  { key: "estatura", label: "Estatura (cm)", type: "number", step: "0.5" },
];

const FIELDS_CIRCUNFERENCIAS_BASE = [
  { key: "cintura", label: "Cintura (cm)", type: "number", step: "0.1" },
  { key: "cadera", label: "Cadera (cm)", type: "number", step: "0.1" },
  { key: "cuello", label: "Cuello (cm)", type: "number", step: "0.1" },
];

const FIELDS_CIRCUNFERENCIAS_COMPLETAS = [
  ...FIELDS_CIRCUNFERENCIAS_BASE,
  { key: "pecho", label: "Pecho (cm)", type: "number", step: "0.1" },
  { key: "brazo_relajado", label: "Brazo relajado (cm)", type: "number", step: "0.1" },
  { key: "brazo_contraido", label: "Brazo contraído (cm)", type: "number", step: "0.1" },
  { key: "muslo", label: "Muslo (cm)", type: "number", step: "0.1" },
  { key: "pantorrilla", label: "Pantorrilla (cm)", type: "number", step: "0.1" },
];

const FIELDS_DIAMETROS = [
  { key: "diametro_muneca", label: "Muñeca · Biestiloideo (cm)", type: "number", step: "0.1" },
  { key: "diametro_codo", label: "Codo · Biepicondíleo (cm)", type: "number", step: "0.1" },
  { key: "diametro_rodilla", label: "Rodilla · Bicondíleo (cm)", type: "number", step: "0.1" },
];

const FIELDS_CLINICOS = [
  { key: "glucosa", label: "Glucosa (mg/dL)", type: "number" },
  { key: "presion_arterial", label: "Presión arterial", type: "text", placeholder: "120/80" },
];

export function getGroupsForMethod(metodo, sexo = "M") {
  const s = normalizeSexo(sexo);

  if (metodo === "inbody") {
    return [
      { label: "Antropometría Base", icon: <Scale className="w-4 h-4" />, fields: [
        ...FIELDS_BASICAS,
        { key: "cintura", label: "Cintura (cm)", type: "number", step: "0.1" },
        { key: "cadera", label: "Cadera (cm)", type: "number", step: "0.1" },
      ]},
      { label: "Composición por Bioimpedancia", icon: <Microscope className="w-4 h-4" />, fields: [
        { key: "grasa_pct", label: "% Grasa Corporal", type: "number", step: "0.1" },
        { key: "calc_masa_grasa", label: "Masa Grasa (kg)", type: "number", step: "0.1" },
        { key: "inbody_smm", label: "Masa Muscular Esq. SMM (kg)", type: "number", step: "0.1" },
        { key: "inbody_tbw", label: "Agua Corporal Total (L)", type: "number", step: "0.1" },
        { key: "inbody_proteina", label: "Proteína (kg)", type: "number", step: "0.1" },
        { key: "inbody_mineral_oseo", label: "Mineral Óseo (kg)", type: "number", step: "0.1" },
      ]},
      { label: "Indicadores Metabólicos", icon: <Activity className="w-4 h-4" />, fields: [
        { key: "inbody_grasa_visceral", label: "Grasa Visceral (Nivel)", type: "number", step: "1" },
        { key: "inbody_bmr", label: "TMB Basal (kcal)", type: "number", step: "1" },
        { key: "inbody_score", label: "Puntaje BIA / InBody", type: "number", step: "1" },
      ]},
      { label: "Masa Magra Segmentada (Opcional)", icon: <Dumbbell className="w-4 h-4" />, fields: [
        { key: "inbody_magra_brazo_der", label: "Brazo Derecho (kg)", type: "number", step: "0.1" },
        { key: "inbody_magra_brazo_izq", label: "Brazo Izquierdo (kg)", type: "number", step: "0.1" },
        { key: "inbody_magra_tronco", label: "Tronco (kg)", type: "number", step: "0.1" },
        { key: "inbody_magra_pierna_der", label: "Pierna Derecha (kg)", type: "number", step: "0.1" },
        { key: "inbody_magra_pierna_izq", label: "Pierna Izquierda (kg)", type: "number", step: "0.1" },
      ]},
      { label: "Clínicos (Opcional)", icon: <Stethoscope className="w-4 h-4" />, fields: FIELDS_CLINICOS },
    ];
  }

  if (metodo === "basico") {
    return [
      { label: "Mediciones Básicas", icon: <Scale className="w-4 h-4" />, fields: [
        ...FIELDS_BASICAS,
        ...FIELDS_CIRCUNFERENCIAS_BASE,
        { key: "grasa_pct", label: "% Grasa (Opcional / Báscula)", type: "number", step: "0.1", placeholder: "Auto US Navy si vacío" },
      ]},
      { label: "Perímetros Corporales (Opcional)", icon: <Ruler className="w-4 h-4" />, fields: [
        { key: "pecho", label: "Pecho (cm)", type: "number", step: "0.1" },
        { key: "brazo_relajado", label: "Brazo relajado (cm)", type: "number", step: "0.1" },
        { key: "brazo_contraido", label: "Brazo contraído (cm)", type: "number", step: "0.1" },
        { key: "muslo", label: "Muslo (cm)", type: "number", step: "0.1" },
        { key: "pantorrilla", label: "Pantorrilla (cm)", type: "number", step: "0.1" },
      ]},
      { label: "Clínicos (Opcional)", icon: <Stethoscope className="w-4 h-4" />, fields: FIELDS_CLINICOS },
    ];
  }

  if (metodo === "plicometria_jp3") {
    const jp3Fields = s === "M"
      ? [
          { key: "pliegue_pectoral", label: "Pectoral (mm)", type: "number", step: "0.1" },
          { key: "pliegue_abdominal", label: "Abdominal (mm)", type: "number", step: "0.1" },
          { key: "pliegue_muslo", label: "Muslo anterior (mm)", type: "number", step: "0.1" },
        ]
      : [
          { key: "pliegue_triceps", label: "Tricipital (mm)", type: "number", step: "0.1" },
          { key: "pliegue_suprailiaco", label: "Suprailíaco (mm)", type: "number", step: "0.1" },
          { key: "pliegue_muslo", label: "Muslo anterior (mm)", type: "number", step: "0.1" },
        ];
    return [
      { label: "Antropometría Base", icon: <Scale className="w-4 h-4" />, fields: [
        ...FIELDS_BASICAS,
        ...FIELDS_CIRCUNFERENCIAS_BASE,
      ]},
      { label: `3 Pliegues Jackson-Pollock (${s === "M" ? "Hombre" : "Mujer"})`, icon: <Target className="w-4 h-4" />, fields: jp3Fields },
      { label: "Perímetros Adicionales (Opcional)", icon: <Ruler className="w-4 h-4" />, fields: [
        { key: "brazo_relajado", label: "Brazo relajado (cm)", type: "number", step: "0.1" },
        { key: "brazo_contraido", label: "Brazo contraído (cm)", type: "number", step: "0.1" },
        { key: "muslo", label: "Muslo (cm)", type: "number", step: "0.1" },
        { key: "pantorrilla", label: "Pantorrilla (cm)", type: "number", step: "0.1" },
      ]},
    ];
  }

  if (metodo === "plicometria_dw4") {
    return [
      { label: "Antropometría Base", icon: <Scale className="w-4 h-4" />, fields: [
        ...FIELDS_BASICAS,
        ...FIELDS_CIRCUNFERENCIAS_BASE,
      ]},
      { label: "4 Pliegues Durnin-Womersley (mm)", icon: <Target className="w-4 h-4" />, fields: [
        { key: "pliegue_biceps", label: "Bicipital (mm)", type: "number", step: "0.1" },
        { key: "pliegue_triceps", label: "Tricipital (mm)", type: "number", step: "0.1" },
        { key: "pliegue_subescapular", label: "Subescapular (mm)", type: "number", step: "0.1" },
        { key: "pliegue_suprailiaco", label: "Suprailíaco (mm)", type: "number", step: "0.1" },
      ]},
      { label: "Perímetros Adicionales (Opcional)", icon: <Ruler className="w-4 h-4" />, fields: [
        { key: "brazo_relajado", label: "Brazo relajado (cm)", type: "number", step: "0.1" },
        { key: "brazo_contraido", label: "Brazo contraído (cm)", type: "number", step: "0.1" },
        { key: "muslo", label: "Muslo (cm)", type: "number", step: "0.1" },
        { key: "pantorrilla", label: "Pantorrilla (cm)", type: "number", step: "0.1" },
      ]},
    ];
  }

  // Default: 'manual' (ISAK Completo — 4 componentes + Somatotipo Heath-Carter)
  return [
    { label: "Básicas", icon: <Scale className="w-4 h-4" />, fields: FIELDS_BASICAS },
    { label: "6 Pliegues ISAK (mm)", icon: <Target className="w-4 h-4" />, fields: [
      { key: "pliegue_triceps", label: "Tríceps", type: "number", step: "0.1" },
      { key: "pliegue_subescapular", label: "Subescapular", type: "number", step: "0.1" },
      { key: "pliegue_suprailiaco", label: "Suprailíaco", type: "number", step: "0.1" },
      { key: "pliegue_abdominal", label: "Abdominal", type: "number", step: "0.1" },
      { key: "pliegue_muslo", label: "Muslo", type: "number", step: "0.1" },
      { key: "pliegue_pantorrilla", label: "Pantorrilla", type: "number", step: "0.1" },
      { key: "pliegue_biceps", label: "Bíceps (Opcional)", type: "number", step: "0.1" },
      { key: "pliegue_pectoral", label: "Pectoral (Opcional)", type: "number", step: "0.1" },
    ]},
    { label: "Circunferencias (cm)", icon: <Ruler className="w-4 h-4" />, fields: FIELDS_CIRCUNFERENCIAS_COMPLETAS },
    { label: "Diámetros Óseos · Rocha / Heath-Carter", icon: <Activity className="w-4 h-4" />, fields: FIELDS_DIAMETROS },
    { label: "Clínicos (Opcional)", icon: <Stethoscope className="w-4 h-4" />, fields: FIELDS_CLINICOS },
  ];
}

const emptyForm = () => ({
  fecha: new Date().toISOString().split("T")[0],
  metodo_evaluacion: "basico",
  peso: "", estatura: "", imc: "",

  // Pliegues (mm)
  pliegue_triceps: "", pliegue_subescapular: "", pliegue_suprailiaco: "", pliegue_abdominal: "",
  pliegue_muslo: "", pliegue_pantorrilla: "", pliegue_pectoral: "", pliegue_biceps: "",

  // Circunferencias (cm)
  cuello: "", cintura: "", cadera: "", pecho: "", brazo_relajado: "", brazo_contraido: "",
  muslo: "", pantorrilla: "",

  // Diámetros óseos (cm)
  diametro_muneca: "", diametro_codo: "", diametro_rodilla: "",

  // InBody
  inbody_smm: "", inbody_tbw: "", inbody_proteina: "", inbody_mineral_oseo: "",
  inbody_grasa_visceral: "", inbody_bmr: "", inbody_score: "",
  inbody_magra_brazo_der: "", inbody_magra_brazo_izq: "", inbody_magra_pierna_der: "",
  inbody_magra_pierna_izq: "", inbody_magra_tronco: "",

  // Outputs calculados / InBody
  calc_masa_grasa: "", calc_masa_muscular: "", calc_masa_osea: "", calc_masa_residual: "",
  somatotipo_x: "", somatotipo_y: "",

  // Legacy/Calculated
  grasa_pct: "", musculo_pct: "", icc: "", glucosa: "", presion_arterial: "", notas: "",

  // Check-in clínico integrado y Enfoque de la Etapa (Alimenta Cálculo de Macros IA)
  checkin_energia: "4",
  checkin_saciedad: "4",
  checkin_digestion: "4",
  checkin_descanso: "4",
  checkin_observaciones: "",
  checkin_ajustes: "",
  eval_objetivo: "",
  eval_faf: "",
  eval_faf_notas: "",
  ciclo_id: "",

  // Hábitos del ciclo y actividad física actual
  horas_sueno: "",
  consumo_agua_estimado: "",
  nivel_estres: "3",
  dias_ejercicio_actual: "",
  horario_ejercicio: "",

  // Preferencias y gustos alimentarios del ciclo (migrados del expediente)
  preferencias_alimentos: "",
  aversiones_alimentos: "",

  // Recordatorio de 24 horas (R24H) del ciclo (migrado del expediente)
  r24h_desayuno: "",
  r24h_colacion_m: "",
  r24h_comida: "",
  r24h_colacion_v: "",
  r24h_cena: "",
  r24h_picoteos: "",
});

const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });

export function ProgresoCliente({ selected, setMsg, isMiPlan, mode, cicloActivo, initialNutriDias, initialRutinas, isReadOnly: propReadOnly }) {
  const isCivil = localStorage.getItem("flux_role") === "civil";
  const isFreemium = isCivil && selected?.plan_tipo !== "premium";
  const _peekMetricas = selected?.id ? dbPeek(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc`) : null;
  const _peekCiclos = selected?.id ? dbPeek(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`) : null;
  const _peekActiveCiclo = Array.isArray(_peekCiclos) ? (_peekCiclos.find(c => c.activo) || _peekCiclos[0] || null) : null;
  const _peekFilter = _peekActiveCiclo ? `ciclo_id=eq.${_peekActiveCiclo.id}` : `ciclo_id=is.null`;
  const _peekRs = selected?.id ? dbPeek(`rutinas?cliente_id=eq.${selected.id}&${_peekFilter}&select=*,ejercicios(*)&order=orden.asc`) : null;
  const _peekNutriProgreso = selected?.id ? dbPeek(`nutricion_progreso?cliente_id=eq.${selected.id}&limit=1000`) : null;

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState("metricas");
  const openPaywall = (feature = "metricas") => {
    setPaywallFeature(feature);
    setPaywallOpen(true);
  };
  const [metricas,     setMetricas]     = useState(() => Array.isArray(_peekMetricas) ? _peekMetricas.map(enrichMetrica) : []);
  const [rutinas,      setRutinas]      = useState(() => {
    if (Array.isArray(initialRutinas) && initialRutinas.length > 0) return initialRutinas;
    return Array.isArray(_peekRs)
      ? _peekRs.map(r => ({ ...r, ejercicios: Array.isArray(r.ejercicios) ? [...r.ejercicios].sort((a, b) => (a.orden || 0) - (b.orden || 0)) : [] }))
      : [];
  });
  const [nutriDias,    setNutriDias]    = useState(() => {
    if (Array.isArray(initialNutriDias) && initialNutriDias.length > 0) return initialNutriDias;
    return [];
  });
  const [nutriProgreso,setNutriProgreso]= useState(() => {
    const npMap = {};
    if (Array.isArray(_peekNutriProgreso)) {
      _peekNutriProgreso.forEach(r => {
        if (r?.dia_id && r?.semana != null) {
          npMap[`${r.dia_id}-${r.semana}`] = r;
        }
      });
    }
    return npMap;
  });
  const [ciclos,       setCiclos]       = useState(() => Array.isArray(_peekCiclos) ? _peekCiclos : []);
  const [cicloSel,     setCicloSel]     = useState(() => cicloActivo || _peekActiveCiclo);
  const [progreso,     setProgreso]     = useState(() => {
    const rs = (Array.isArray(initialRutinas) && initialRutinas.length > 0) ? initialRutinas : (_peekRs || []);
    const allIds = rs.flatMap(r => (r.ejercicios || []).map(e => e.id));
    if (selected?.id && allIds.length > 0) {
      const ps = dbPeek(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=in.(${allIds.join(",")})&limit=3000`) ||
                 dbPeek(`progreso?cliente_id=eq.${selected.id}&limit=3000`);
      if (Array.isArray(ps)) {
        const pm = {};
        ps.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}-${p.variante_id || 'original'}`] = p.valor; });
        return pm;
      }
    }
    return {};
  });

  useEffect(() => {
    if (Array.isArray(initialNutriDias) && initialNutriDias.length > 0) {
      setNutriDias(initialNutriDias);
    }
  }, [initialNutriDias]);

  useEffect(() => {
    if (Array.isArray(initialRutinas) && initialRutinas.length > 0) {
      setRutinas(initialRutinas);
    }
  }, [initialRutinas]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [showExpediente, setShowExpediente] = useState(false);
  const [clinicalRec,  setClinicalRec]  = useState(() => peekClinicalRecord(selected?.id));
  const [evalSexo,     setEvalSexo]     = useState(() => normalizeSexo(selected?.genero || selected?.sexo || peekClinicalRecord(selected?.id)?.anamnesis?.genero));
  const [evalEdad,     setEvalEdad]     = useState(() => calcEdadFromBirthdate(selected?.fecha_nacimiento || peekClinicalRecord(selected?.id)?.anamnesis?.fecha_nacimiento, 25));
  const [form,         setForm]         = useState(emptyForm());
  const [autoSyncMacros, setAutoSyncMacros] = useState(true);
  const [prescriptionMode, setPrescriptionMode] = useState("matematico"); // "matematico" | "ia" | "manual"
  const [manualMacros, setManualMacros] = useState({
    targetKcal: "",
    proteinG: "",
    carbsG: "",
    fatsG: ""
  });
  const [manualSimMode, setManualSimMode] = useState("g_kg"); // "g_kg" | "pct"
  const [aiAuditResult, setAiAuditResult] = useState(null);
  const [isAuditingAi, setIsAuditingAi] = useState(false);
  const [aiAuditError, setAiAuditError] = useState(null);
  const [customSmaeMap, setCustomSmaeMap] = useState(null);
  const [showStep5SmaeTable, setShowStep5SmaeTable] = useState(false);
  const [sub,          setSub]          = useState(() => mode || "evaluaciones");

  const [trackingWeightUnit, setTrackingWeightUnit] = useState(() => {
    try {
      return localStorage.getItem("flux_tracking_unit") || "kg";
    } catch {
      return "kg";
    }
  });

  const handleToggleTrackingUnit = (u) => {
    setTrackingWeightUnit(u);
    try {
      localStorage.setItem("flux_tracking_unit", u);
    } catch {}
  };

  const formatTrackingWeight = (val, unit) => {
    if (!val || val === "—" || val === "-" || val === "ALT" || val === "ORG") return val;
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (unit === "lb") {
      const lb = num * 2.20462262;
      return (Math.abs(lb - Math.round(lb)) < 0.08)
        ? Math.round(lb).toString()
        : Number(lb.toFixed(1)).toString();
    }
    // En kg: si es entero o prácticamente entero, mostrar entero; si no, 1 decimal
    return (Math.abs(num - Math.round(num)) < 0.05)
      ? Math.round(num).toString()
      : Number(num.toFixed(1)).toString();
  };

  // Tombstoning para borrado 100% instantáneo que resiste ecos asíncronos de red
  const deletedIdsRef = useRef(new Set());
  const initialLoadedRef = useRef(false);

  const filterDeleted = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    return list.filter(m => m && !deletedIdsRef.current.has(String(m.id)));
  }, []);

  useEffect(() => {
    deletedIdsRef.current.clear();
  }, [selected?.id]);

  const activeMetricas = useMemo(
    () => metricas.filter(m => !deletedIdsRef.current.has(String(m?.id))),
    [metricas]
  );

  // Vincular evaluaciones al ciclo y filtrar según el plan seleccionado
  const allLinkedMetricas = useMemo(() => {
    return linkMetricasToCiclos(activeMetricas, ciclos);
  }, [activeMetricas, ciclos]);

  const currentCiclo = cicloActivo || cicloSel;
  const isReadOnly = propReadOnly ?? Boolean(isMiPlan || (currentCiclo && !currentCiclo.activo));

  const cycleInfo = useMemo(() => {
    if (!currentCiclo?.nombre) {
      return {
        nombreBase: "Plan actual",
        semanas: 4,
        dias: 28,
        enfoque: ""
      };
    }
    const parts = currentCiclo.nombre.split("|");
    const nombreBase = parts[0] || "Plan actual";
    const semanas = parseInt(parts[1], 10) || 4;
    const dias = parseInt(parts[3], 10) || (semanas * 7);
    const enfoque = (parts[4] || "").trim();
    return { nombreBase, semanas, dias, enfoque };
  }, [currentCiclo?.nombre]);

  const displayedMetricas = useMemo(() => {
    if (mode === "historico" || sub === "historico") {
      return allLinkedMetricas;
    }
    if (currentCiclo?.id && ciclos.length > 0) {
      return allLinkedMetricas.filter(m => String(m.ciclo_id) === String(currentCiclo.id));
    }
    return allLinkedMetricas;
  }, [mode, sub, currentCiclo?.id, ciclos.length, allLinkedMetricas]);

  useEffect(() => {
    if (mode) setSub(mode);
  }, [mode]);
  const [pendingFotos, setPendingFotos] = useState([]);   // File objects
  const [previewUrls,  setPreviewUrls]  = useState([]);   // object URLs
  const [lightbox,     setLightbox]     = useState(null); // URL shown fullscreen
  const [editingId,    setEditingId]    = useState(null); // null=new, ID=editing
  const [existingFotos,setExistingFotos]= useState([]);   // fotos ya guardadas al editar
  const [analyzingInbody, setAnalyzingInbody] = useState(false);
  const [inbodyOcrResult, setInbodyOcrResult] = useState(null);
  const inbodyFileInputRef = useRef(null);
  const brand = useBrand();

  const handleInbodyFileUpload = async (file) => {
    if (!file) return;
    setAnalyzingInbody(true);
    setInbodyOcrResult(null);

    try {
      // 1. Convertir a Base64
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          if (typeof res === "string") {
            const raw = res.includes(",") ? res.split(",")[1] : res;
            resolve(raw);
          } else {
            reject(new Error("No se pudo leer el archivo"));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

      // 2. Extraer datos con IA Vision
      const extracted = await extractInbodyFromDocument({ fileBase64, mimeType });

      // 3. Auto-rellenar campos en el formulario
      setForm((prev) => {
        const next = { ...prev };
        if (extracted.peso != null) next.peso = extracted.peso;
        if (extracted.estatura != null && (!next.estatura || Number(next.estatura) === 0)) {
          next.estatura = extracted.estatura;
        }
        if (extracted.grasa_pct != null) next.grasa_pct = extracted.grasa_pct;
        if (extracted.calc_masa_grasa != null) next.calc_masa_grasa = extracted.calc_masa_grasa;
        if (extracted.inbody_smm != null) next.inbody_smm = extracted.inbody_smm;
        if (extracted.inbody_tbw != null) next.inbody_tbw = extracted.inbody_tbw;
        if (extracted.inbody_proteina != null) next.inbody_proteina = extracted.inbody_proteina;
        if (extracted.inbody_mineral_oseo != null) next.inbody_mineral_oseo = extracted.inbody_mineral_oseo;
        if (extracted.inbody_grasa_visceral != null) next.inbody_grasa_visceral = extracted.inbody_grasa_visceral;
        if (extracted.inbody_bmr != null) next.inbody_bmr = extracted.inbody_bmr;
        if (extracted.inbody_score != null) next.inbody_score = extracted.inbody_score;
        if (extracted.inbody_magra_brazo_der != null) next.inbody_magra_brazo_der = extracted.inbody_magra_brazo_der;
        if (extracted.inbody_magra_brazo_izq != null) next.inbody_magra_brazo_izq = extracted.inbody_magra_brazo_izq;
        if (extracted.inbody_magra_tronco != null) next.inbody_magra_tronco = extracted.inbody_magra_tronco;
        if (extracted.inbody_magra_pierna_der != null) next.inbody_magra_pierna_der = extracted.inbody_magra_pierna_der;
        if (extracted.inbody_magra_pierna_izq != null) next.inbody_magra_pierna_izq = extracted.inbody_magra_pierna_izq;
        if (extracted.cintura != null) next.cintura = extracted.cintura;
        if (extracted.cadera != null) next.cadera = extracted.cadera;
        if (extracted.presion_arterial != null) next.presion_arterial = extracted.presion_arterial;
        if (extracted.frecuencia_cardiaca != null) next.frecuencia_cardiaca = extracted.frecuencia_cardiaca;
        return next;
      });

      // 4. Si es imagen, adjuntarla automáticamente al carrusel de fotos para que quede guardada como respaldo
      if (file.type.startsWith("image/")) {
        setPendingFotos((prev) => [...prev, file]);
        setPreviewUrls((prev) => [...prev, URL.createObjectURL(file)]);
      }

      // 5. Contar métricas pobladas
      const filledCount = Object.keys(extracted).filter(
        (k) => extracted[k] != null && k !== "equipo_detectado" && k !== "fecha_ticket"
      ).length;

      setInbodyOcrResult({
        success: true,
        count: filledCount,
        equipo: extracted.equipo_detectado || "InBody / BIA",
        fileName: file.name,
      });

      setMsg(
        <div className="flex gap-2 items-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>¡{filledCount} mediciones cargadas desde el ticket ({extracted.equipo_detectado || "InBody"})!</span>
        </div>
      );
    } catch (err) {
      console.error("Error en lectura IA de InBody:", err);
      setInbodyOcrResult({
        success: false,
        error: err?.message || "No se pudo interpretar el archivo.",
        fileName: file.name,
      });
      setMsg("❌ " + (err?.message || "Error al procesar el ticket. Revisa que sea legible."));
    } finally {
      setAnalyzingInbody(false);
    }
  };

  useBackButton(!!lightbox, () => setLightbox(null), 100);
  useBackButton(showModal, () => setShowModal(false), 20);
  useBackButton(showExpediente, () => setShowExpediente(false), 25);

  const loadCicloData = useCallback(async (ciclo) => {
    if (!selected) return;
    const cicloFiltro = ciclo ? `ciclo_id=eq.${ciclo.id}` : `ciclo_id=is.null`;

    // 1. Rutinas y progreso de pesas (solo si mode no es "nutricion")
    if (mode !== "nutricion") {
      let rsFull = (Array.isArray(initialRutinas) && initialRutinas.length > 0) ? initialRutinas : null;
      if (!rsFull) {
        const rs = await dbGet(`rutinas?cliente_id=eq.${selected.id}&${cicloFiltro}&select=*,ejercicios(*)&order=orden.asc`).catch(() => []);
        rsFull = await Promise.all((rs || []).map(async (r) => {
          const ejs = Array.isArray(r.ejercicios)
            ? [...r.ejercicios].sort((a, b) => (a.orden || 0) - (b.orden || 0))
            : await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`).catch(() => []);
          return { ...r, ejercicios: ejs };
        }));
        setRutinas(rsFull);
      }

      const allIds = rsFull.flatMap(r => (r.ejercicios || []).map(e => e.id));
      if (allIds.length) {
        const ps = await dbGet(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=in.(${allIds.join(",")})&limit=3000`).catch(() => []);
        const pm = {};
        (ps || []).forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}-${p.variante_id || 'original'}`] = p.valor; });
        setProgreso(pm);
      } else {
        setProgreso({});
      }
    }

    // 2. Plan de Nutrición y progreso de hábitos (solo si mode no es "rutinas")
    if (mode !== "rutinas") {
      let diasLoaded = (Array.isArray(initialNutriDias) && initialNutriDias.length > 0) ? initialNutriDias : null;

      const promises = [
        dbGet(`nutricion_progreso?cliente_id=eq.${selected.id}&limit=1000`).catch(() => [])
      ];

      if (!diasLoaded) {
        promises.push(
          (async () => {
            const ns = await dbGet(`nutricion?cliente_id=eq.${selected.id}&${cicloFiltro}`).catch(() => []);
            if (Array.isArray(ns) && ns.length > 0) {
              const ds = await dbGet(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`).catch(() => []);
              return (ds || []).map(d => ({
                ...d,
                comidas: (d.comidas || []).sort((a, b) => (a.orden || 0) - (b.orden || 0))
              }));
            }
            return [];
          })()
        );
      }

      const [npRows, loadedFromDb] = await Promise.all(promises);
      if (!diasLoaded && loadedFromDb) {
        diasLoaded = loadedFromDb;
        setNutriDias(diasLoaded);
      }

      const npMap = {};
      if (Array.isArray(npRows)) {
        npRows.forEach(r => {
          if (r?.dia_id && r?.semana != null) {
            npMap[`${r.dia_id}-${r.semana}`] = r;
          }
        });
      }

      // Respaldo de lectura desde localStorage si se consulta en el mismo dispositivo
      if (diasLoaded && diasLoaded.length > 0) {
        for (let w = 1; w <= 12; w++) {
          diasLoaded.forEach((d, idx) => {
            const mapKey = `${d.id}-${w}`;
            if (npMap[mapKey]) return;
            try {
              const k1 = `flux_nutri_habits_${selected.id}_s${w}_dia_${d.id}`;
              const k2 = `flux_nutri_habits_${selected.id}_s${w}_d${idx}`;
              const raw = localStorage.getItem(k1) || localStorage.getItem(k2);
              if (raw) {
                const parsed = JSON.parse(raw);
                const comidasList = d.comidas || [];
                const doneMap = (parsed && typeof parsed.comidasDone === "object" && parsed.comidasDone !== null) ? parsed.comidasDone : {};
                let doneCount = comidasList.filter((c, cIdx) => Boolean(
                  (c.id && doneMap[c.id]) ||
                  doneMap[cIdx] ||
                  doneMap[String(cIdx)] ||
                  (c.orden != null && doneMap[c.orden])
                )).length;
                if ((Number(parsed?.agua) > 0) || doneCount > 0) {
                  npMap[mapKey] = {
                    cliente_id: selected.id,
                    dia_id: d.id,
                    semana: w,
                    agua_ml: Number(parsed.agua) || 0,
                    meta_agua_ml: 2500,
                    comidas_done: parsed.comidasDone || {},
                    comidas_realizadas: doneCount,
                    total_comidas: comidasList.length,
                  };
                }
              }
            } catch {}
          });
        }
      }
      setNutriProgreso(npMap);
    }
  }, [selected?.id, mode, initialNutriDias, initialRutinas]);

  useEffect(() => {
    if (cicloActivo?.id && cicloSel?.id !== cicloActivo.id) {
      setCicloSel(cicloActivo);
      loadCicloData(cicloActivo);
    }
  }, [cicloActivo?.id, cicloSel?.id, loadCicloData]);

  const load = useCallback(async (force = false) => {
    if (!selected?.id) return;

    // Solo mostrar skeleton si realmente NO tenemos datos mínimos para la sección activa
    const hasInitialData = (mode === "nutricion" && ((initialNutriDias && initialNutriDias.length > 0) || nutriDias.length > 0)) ||
                           (mode === "rutinas" && ((initialRutinas && initialRutinas.length > 0) || rutinas.length > 0)) ||
                           (!mode && (_peekMetricas !== null || _peekCiclos !== null)) ||
                           (mode === "evaluaciones" && (_peekMetricas !== null || _peekCiclos !== null));

    if (!initialLoadedRef.current && !hasInitialData) {
      setLoading(true);
    }
    initialLoadedRef.current = true;

    try {
      if (mode === "nutricion" || mode === "rutinas") {
        // En modos específicos de tracking, SOLO cargamos el ciclo activo y los datos de ese tracking
        const activeCiclo = cicloActivo || cicloSel;
        if (!activeCiclo) {
          const cs = await dbGet(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`).catch(() => []);
          setCiclos(cs || []);
          const resolved = (cs || []).find(c => c.activo) || (cs || [])[0] || null;
          setCicloSel(resolved);
          await loadCicloData(resolved);
        } else {
          await loadCicloData(activeCiclo);
        }
      } else {
        // Modo evaluaciones o vista completa: consultar en paralelo con Promise.all
        const qPath = `metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc`;
        const [ms, cs] = await Promise.all([
          force
            ? dbGetFresh(qPath).catch(() => [])
            : dbGet(qPath, (bg) => {
                if (Array.isArray(bg)) setMetricas(filterDeleted(bg.map(enrichMetrica)));
              }).catch(() => []),
          dbGet(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`).catch(() => []),
          fetchClinicalRecord(selected.id).then(rec => setClinicalRec(rec)).catch(() => {})
        ]);

        if (Array.isArray(ms)) {
          setMetricas(filterDeleted(ms.map(enrichMetrica)));
        }
        setCiclos(cs || []);
        const activeCiclo = cicloActivo || (cs || []).find(c => c.activo) || (cs || [])[0] || null;
        setCicloSel(prev => prev ?? activeCiclo);

        await loadCicloData(activeCiclo);
      }
    } catch(e) {
      setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
    } finally {
      setLoading(false);
    }
  }, [selected?.id, loadCicloData, setMsg, cicloActivo, cicloSel, filterDeleted, mode, initialNutriDias, initialRutinas, nutriDias.length, rutinas.length, _peekMetricas, _peekCiclos]);

  useEffect(() => {
    const clin = peekClinicalRecord(selected?.id);
    setClinicalRec(clin);
    setEvalSexo(normalizeSexo(selected?.genero || selected?.sexo || clin?.anamnesis?.genero));
    setEvalEdad(calcEdadFromBirthdate(selected?.fecha_nacimiento || clin?.anamnesis?.fecha_nacimiento, 25));
  }, [selected, clinicalRec?.anamnesis?.genero, clinicalRec?.anamnesis?.fecha_nacimiento]);

  useEffect(() => {
    const onExpedienteUpdated = (e) => {
      const targetId = e?.detail?.clienteId;
      if (!targetId || targetId === selected?.id) {
        if (e?.detail?.record) setClinicalRec(e.detail.record);
        else if (selected?.id) fetchClinicalRecord(selected.id).then(rec => setClinicalRec(rec)).catch(() => {});
      }
    };
    window.addEventListener("flux:expediente-updated", onExpedienteUpdated);
    return () => window.removeEventListener("flux:expediente-updated", onExpedienteUpdated);
  }, [selected?.id]);

  const openNewEvaluation = useCallback((explicitCiclo = null) => {
    const base = emptyForm();
    const targetCiclo = explicitCiclo || cicloActivo || cicloSel;
    if (targetCiclo?.id) {
      base.ciclo_id = targetCiclo.id;
    }
    base.metodo_evaluacion = isCivil ? "basico" : "basico";

    // Objetivo y FAF por defecto según datos actuales del cliente o rutinas asignadas
    const fallbackGoal = inferGoalFromText(selected?.objetivo || targetCiclo?.nombre || "");
    let trainingDays = 0;
    if (Array.isArray(rutinas) && rutinas.length > 0) {
      const uDays = new Set();
      rutinas.forEach(r => {
        const parts = (r.nombre || "").split("|");
        const dayTag = parts.length > 1 ? parts[0] : "";
        if (dayTag && dayTag !== "S/D") uDays.add(dayTag.toLowerCase());
      });
      trainingDays = uDays.size > 0 ? uDays.size : rutinas.length;
    }
    let calculatedFaf = null;
    if (trainingDays > 0) {
      if (trainingDays <= 1) calculatedFaf = 1.2;
      else if (trainingDays <= 3) calculatedFaf = 1.375;
      else if (trainingDays <= 5) calculatedFaf = 1.55;
      else calculatedFaf = 1.725;
    }
    base.eval_objetivo = fallbackGoal || "recomposicion";
    base.eval_faf = String(calculatedFaf || 1.375);
    base.eval_faf_notas = "";

    const clin = clinicalRec || peekClinicalRecord(selected?.id);
    setEvalSexo(normalizeSexo(selected?.genero || selected?.sexo || clin?.anamnesis?.genero));
    setEvalEdad(calcEdadFromBirthdate(selected?.fecha_nacimiento || clin?.anamnesis?.fecha_nacimiento, 25));
    setForm(base);
    setAutoSyncMacros(true);
    setPrescriptionMode("matematico");
    setManualMacros({ targetKcal: "", proteinG: "", carbsG: "", fatsG: "" });
    setAiAuditResult(null);
    setIsAuditingAi(false);
    setAiAuditError(null);
    setEditingId(null);
    setExistingFotos([]);
    setPendingFotos([]);
    setPreviewUrls([]);
    setInbodyOcrResult(null);
    setAnalyzingInbody(false);
    setShowModal(true);
  }, [isCivil, cicloActivo, cicloSel, selected?.objetivo, selected?.genero, selected?.sexo, selected?.fecha_nacimiento, clinicalRec, rutinas]);

  useEffect(() => {
    const handleOpen = (ev) => {
      const explicitCiclo = ev?.detail?.ciclo;
      const targetClienteId = ev?.detail?.clienteId || explicitCiclo?.cliente_id;
      if (targetClienteId && selected?.id && String(targetClienteId) !== String(selected.id)) return;
      openNewEvaluation(explicitCiclo);
    };
    window.addEventListener("flux:open-new-evaluation", handleOpen);
    window.addEventListener("flux:open-checkin", handleOpen);
    return () => {
      window.removeEventListener("flux:open-new-evaluation", handleOpen);
      window.removeEventListener("flux:open-checkin", handleOpen);
    };
  }, [openNewEvaluation, selected?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let timer = null;
    const onCacheUpdated = (ev) => {
      if (saving || showModal) return;
      const table = ev?.detail?.table;
      if (table && !["metricas_progreso", "progreso", "nutricion_progreso", "rutinas", "ejercicios", "nutricion_dias", "ciclos"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (table === "metricas_progreso" || table === "*") {
          const fresh = dbPeek(`metricas_progreso?cliente_id=eq.${selected?.id}&order=fecha.desc`);
          if (Array.isArray(fresh)) {
            setMetricas(filterDeleted(fresh.map(enrichMetrica)));
          } else {
            load(false);
          }
        }
        if (cicloSel !== undefined) loadCicloData(cicloSel);
      }, 400);
    };

    const onMetricasUpdated = (ev) => {
      if (ev?.detail?.source === "ProgresoCliente") return;
      const targetId = ev?.detail?.clienteId;
      if (!targetId || targetId === selected?.id) {
        const fresh = dbPeek(`metricas_progreso?cliente_id=eq.${selected?.id}&order=fecha.desc`);
        if (Array.isArray(fresh)) {
          setMetricas(filterDeleted(fresh.map(enrichMetrica)));
        } else {
          load(true);
        }
      }
    };

    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    window.addEventListener("flux:metricas-updated", onMetricasUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
      window.removeEventListener("flux:metricas-updated", onMetricasUpdated);
    };
  }, [saving, showModal, cicloSel, loadCicloData, selected?.id, load, filterDeleted]);

  // Load routines & nutrition for any selected cycle (used when the user clicks a cycle pill)
  const loadRutinas = useCallback(async (ciclo) => {
    if (!selected?.id) return;
    try {
      await loadCicloData(ciclo);
    } catch(e) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>); }
  }, [selected?.id, loadCicloData, setMsg]);

  const updForm = (key, val) => {
    setForm(p => {
      const next = { ...p, [key]: val };
      if ((key === "peso" || key === "estatura") && next.peso && next.estatura) {
        const h = parseFloat(next.estatura) / 100;
        next.imc = h > 0 ? (parseFloat(next.peso) / (h * h)).toFixed(1) : "";
      }
      if ((key === "cintura" || key === "cadera") && next.cintura && next.cadera) {
        const icc = parseFloat(next.cintura) / parseFloat(next.cadera);
        next.icc = icc > 0 ? icc.toFixed(2) : "";
      }
      return next;
    });
  };

  const handleFotos = (e) => {
    const files = Array.from(e.target.files);
    setPendingFotos(prev => [...prev, ...files]);
    setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const removePendingFoto = (idx) => {
    URL.revokeObjectURL(previewUrls[idx]);
    setPendingFotos(prev => prev.filter((_,i) => i !== idx));
    setPreviewUrls(prev => prev.filter((_,i) => i !== idx));
  };

  const liveCalculations = useMemo(
    () => calculateBodyComposition(form, evalSexo, evalEdad),
    [form, evalSexo, evalEdad]
  );

  const liveSmartMacros = useMemo(() => {
    const rawPeso = form.peso ? parseFloat(form.peso) : 0;
    if (!rawPeso || rawPeso <= 0) return null;
    const enrichedDraft = {
      ...form,
      ...liveCalculations,
      peso: form.peso,
      estatura: form.estatura || selected?.estatura || "",
      grasa_pct: liveCalculations.grasa_pct || form.grasa_pct || "",
      masa_libre_grasa: liveCalculations.masa_libre_grasa || "",
      sexo: evalSexo,
      edad: evalEdad,
    };
    return generateSmartMacroPrescription({
      cliente: { ...selected, genero: evalSexo === "F" ? "Femenino" : "Masculino", edad: evalEdad },
      metrica: enrichedDraft,
      clinicalRec,
      cicloNombre: currentCiclo?.nombre || "",
    });
  }, [form, liveCalculations, selected, evalSexo, evalEdad, clinicalRec, currentCiclo?.nombre]);

  const activePrescription = useMemo(() => {
    if (!liveSmartMacros) return null;
    const getNum = Number(liveSmartMacros.matematico?.get || liveSmartMacros.get) || 0;
    const p = parseFloat(form.peso) || parseFloat(liveSmartMacros.peso) || 0;

    if (prescriptionMode === "ia" && aiAuditResult) {
      const kcal = Number(aiAuditResult.targetKcal) || liveSmartMacros.targetKcal || 0;
      const prot = Number(aiAuditResult.proteinG) || 0;
      const carbs = Number(aiAuditResult.carbsG) || 0;
      const fats = Number(aiAuditResult.fatsG) || 0;
      const totalCalc = prot * 4 + carbs * 4 + fats * 9 || kcal;
      const dynamicGoalPct = getNum > 0 ? Math.round(((kcal - getNum) / getNum) * 100) : (liveSmartMacros.goalPct || 0);

      return {
        targetKcal: kcal,
        tmb: liveSmartMacros.tmb,
        get: getNum,
        proteinG: prot,
        carbsG: carbs,
        fatsG: fats,
        protGKg: aiAuditResult.protGKg || (p > 0 ? Number((prot / p).toFixed(2)) : 0),
        carbGKg: aiAuditResult.carbGKg || (p > 0 ? Number((carbs / p).toFixed(2)) : 0),
        fatGKg: aiAuditResult.fatGKg || (p > 0 ? Number((fats / p).toFixed(2)) : 0),
        proteinPct: totalCalc > 0 ? Math.round(((prot * 4) / totalCalc) * 100) : 0,
        carbsPct: totalCalc > 0 ? Math.round(((carbs * 4) / totalCalc) * 100) : 0,
        fatsPct: totalCalc > 0 ? Math.round(((fats * 9) / totalCalc) * 100) : 0,
        goalPct: dynamicGoalPct,
        mode: "ia",
        modeLabel: "Auditado IA",
        hasEnoughData: true,
        badgeMotivo: aiAuditResult.badgeMotivo || "Prescripción IA",
        analisisClinico: aiAuditResult.analisisClinico,
        ajustesSugeridos: aiAuditResult.ajustesSugeridos || [],
        estrategiaMenu: aiAuditResult.estrategiaMenu,
        model: aiAuditResult.model,
      };
    }
    if (prescriptionMode === "manual") {
      const kcal = Number(manualMacros.targetKcal) || liveSmartMacros.targetKcal || 0;
      const prot = Number(manualMacros.proteinG) || 0;
      const carbs = Number(manualMacros.carbsG) || 0;
      const fats = Number(manualMacros.fatsG) || 0;
      const totalCalc = prot * 4 + carbs * 4 + fats * 9 || kcal;
      const dynamicGoalPct = getNum > 0 ? Math.round(((kcal - getNum) / getNum) * 100) : (liveSmartMacros.goalPct || 0);

      return {
        targetKcal: kcal,
        tmb: liveSmartMacros.tmb,
        get: getNum,
        proteinG: prot,
        carbsG: carbs,
        fatsG: fats,
        protGKg: p > 0 ? Number((prot / p).toFixed(2)) : 0,
        carbGKg: p > 0 ? Number((carbs / p).toFixed(2)) : 0,
        fatGKg: p > 0 ? Number((fats / p).toFixed(2)) : 0,
        proteinPct: totalCalc > 0 ? Math.round(((prot * 4) / totalCalc) * 100) : 0,
        carbsPct: totalCalc > 0 ? Math.round(((carbs * 4) / totalCalc) * 100) : 0,
        fatsPct: totalCalc > 0 ? Math.round(((fats * 9) / totalCalc) * 100) : 0,
        goalPct: dynamicGoalPct,
        mode: "manual",
        modeLabel: "Manual",
        hasEnoughData: kcal > 0,
      };
    }
    return {
      ...(liveSmartMacros.matematico || liveSmartMacros),
      mode: "matematico",
      modeLabel: "Matemático (Fórmula)",
      hasEnoughData: liveSmartMacros.hasEnoughData,
    };
  }, [prescriptionMode, liveSmartMacros, manualMacros, aiAuditResult, form.peso]);

  const activeMacroSignature = `${prescriptionMode}_${activePrescription?.targetKcal || 0}_${activePrescription?.proteinG || 0}_${activePrescription?.carbsG || 0}_${activePrescription?.fatsG || 0}`;

  const isCustomSmaeActive = Boolean(
    customSmaeMap &&
    customSmaeMap.signature === activeMacroSignature &&
    customSmaeMap.map &&
    Object.keys(customSmaeMap.map).length > 0
  );

  const effectiveSmaeDistribution = useMemo(() => {
    if (isCustomSmaeActive) {
      return customSmaeMap.map;
    }
    if (!activePrescription || !activePrescription.targetKcal) return {};
    return autoDistributeSmaeFromMacros({
      calorias: activePrescription.targetKcal,
      proteina: activePrescription.proteinG,
      carbohidratos: activePrescription.carbsG,
      grasas: activePrescription.fatsG,
    });
  }, [isCustomSmaeActive, customSmaeMap, activePrescription]);

  const adjustStep5Smae = (groupId, delta) => {
    setCustomSmaeMap((prev) => {
      const base =
        prev && prev.signature === activeMacroSignature && prev.map
          ? prev.map
          : effectiveSmaeDistribution;
      const cur = Number(base[groupId]) || 0;
      const nextVal = Math.max(0, Math.round((cur + delta) * 2) / 2);
      return {
        signature: activeMacroSignature,
        map: { ...base, [groupId]: nextVal },
      };
    });
  };

  const handleAuditMacrosWithAi = async () => {
    if (isFreemium) {
      openPaywall("ia");
      return;
    }
    if (!liveSmartMacros || !liveSmartMacros.hasEnoughData) {
      setAiAuditError("Ingresa al menos el peso del paciente en la evaluación para auditar con IA.");
      return;
    }
    setIsAuditingAi(true);
    setAiAuditError(null);
    try {
      // Pliegues cutáneos (mm)
      const plieguesArr = [];
      if (form.pliegue_triceps) plieguesArr.push(`Tríceps: ${form.pliegue_triceps} mm`);
      if (form.pliegue_subescapular) plieguesArr.push(`Subescapular: ${form.pliegue_subescapular} mm`);
      if (form.pliegue_suprailiaco) plieguesArr.push(`Suprailíaco: ${form.pliegue_suprailiaco} mm`);
      if (form.pliegue_abdominal) plieguesArr.push(`Abdominal: ${form.pliegue_abdominal} mm`);
      if (form.pliegue_muslo) plieguesArr.push(`Muslo: ${form.pliegue_muslo} mm`);
      if (form.pliegue_pantorrilla) plieguesArr.push(`Pantorrilla: ${form.pliegue_pantorrilla} mm`);
      if (form.pliegue_biceps) plieguesArr.push(`Bíceps: ${form.pliegue_biceps} mm`);
      if (form.pliegue_pectoral) plieguesArr.push(`Pectoral: ${form.pliegue_pectoral} mm`);
      const plieguesStr = plieguesArr.join(", ");

      // Circunferencias corporales (cm)
      const circArr = [];
      if (form.cintura) circArr.push(`Cintura: ${form.cintura} cm`);
      if (form.cadera) circArr.push(`Cadera: ${form.cadera} cm`);
      if (form.cuello) circArr.push(`Cuello: ${form.cuello} cm`);
      if (form.pecho) circArr.push(`Pecho: ${form.pecho} cm`);
      if (form.brazo_relajado) circArr.push(`Brazo relajado: ${form.brazo_relajado} cm`);
      if (form.brazo_contraido) circArr.push(`Brazo contraído: ${form.brazo_contraido} cm`);
      if (form.muslo) circArr.push(`Muslo: ${form.muslo} cm`);
      if (form.pantorrilla) circArr.push(`Pantorrilla: ${form.pantorrilla} cm`);
      const circStr = circArr.join(", ");

      const res = await auditMacroPrescriptionWithAi({
        cliente: { ...selected, genero: evalSexo === "F" ? "Femenino" : "Masculino", edad: evalEdad },
        anamnesis: clinicalRec?.anamnesis || {},
        metrica: {
          ...form,
          ...liveCalculations,
          peso: form.peso || selected?.peso || "",
          estatura: form.estatura || selected?.estatura || "",
          grasa_pct: liveCalculations.grasa_pct || form.grasa_pct || "",
          masa_libre_grasa: liveCalculations.masa_libre_grasa || "",
          masa_muscular_kg: liveCalculations.masa_muscular_kg || form.calc_masa_muscular || "",
          pliegues_str: plieguesStr,
          circunferencias_str: circStr,
          inbody_bmr: form.inbody_bmr || "",
          metodo_label: form.metodo_evaluacion === "durnin" ? "Durnin-Womersley (4 Pliegues)" : form.metodo_evaluacion === "inbody" ? "Bioimpedancia Eléctrica (InBody)" : "Plicometría ISAK (6 Pliegues)",
          sexo: evalSexo,
          edad: evalEdad,
        },
        r24h: liveSmartMacros.r24h || {},
        habitos: {
          ...(liveSmartMacros.contextoClinico?.habitos || {}),
          dias_ejercicio_actuales: form.dias_ejercicio_actual || liveSmartMacros.contextoClinico?.habitos?.dias_ejercicio_actuales || "0",
          faf_proyectado_etapa: liveSmartMacros.fafInfo?.label || "Moderado (3 a 5 días/semana)",
          faf_notas: form.eval_faf_notas || "",
        },
        calcMatematico: {
          formulaLabel: liveSmartMacros.formulaLabel,
          tmb: liveSmartMacros.matematico?.tmb || liveSmartMacros.tmb,
          get: liveSmartMacros.matematico?.get || liveSmartMacros.get,
          faf: liveSmartMacros.faf || liveSmartMacros.matematico?.faf || 1.55,
          goalTitle: liveSmartMacros.goalInfo?.title || "Recomposición Corporal",
          goalPct: liveSmartMacros.goalPct,
          targetKcal: liveSmartMacros.matematico?.targetKcal || liveSmartMacros.targetKcal,
          proteinG: liveSmartMacros.matematico?.proteinG || liveSmartMacros.proteinG,
          protGKg: liveSmartMacros.matematico?.protGKg || liveSmartMacros.protGKg,
          carbsG: liveSmartMacros.matematico?.carbsG || liveSmartMacros.carbsG,
          carbGKg: liveSmartMacros.matematico?.carbGKg || liveSmartMacros.carbGKg,
          fatsG: liveSmartMacros.matematico?.fatsG || liveSmartMacros.fatsG,
          fatGKg: liveSmartMacros.matematico?.fatGKg || liveSmartMacros.fatGKg,
        },
        preferencias: form.preferencias_alimentos || liveSmartMacros.preferencias || "",
        aversiones: form.aversiones_alimentos || liveSmartMacros.aversiones || "",
      });

      setAiAuditResult(res);
      setPrescriptionMode("ia");
    } catch (err) {
      console.error("Error auditando con IA:", err);
      setAiAuditError(err.message || "Error al conectar con FLUX IA");
    } finally {
      setIsAuditingAi(false);
    }
  };

  const handleCopyFromAi = () => {
    if (!aiAuditResult) return;
    setManualMacros({
      targetKcal: String(aiAuditResult.targetKcal || ""),
      proteinG: String(aiAuditResult.proteinG || ""),
      carbsG: String(aiAuditResult.carbsG || ""),
      fatsG: String(aiAuditResult.fatsG || ""),
    });
  };

  const handleCopyFromMath = () => {
    const math = liveSmartMacros?.matematico || liveSmartMacros;
    if (!math) return;
    setManualMacros({
      targetKcal: String(math.targetKcal || ""),
      proteinG: String(math.proteinG || ""),
      carbsG: String(math.carbsG || ""),
      fatsG: String(math.fatsG || ""),
    });
  };

  const handleSetGoalPreset = (pct) => {
    const p = parseFloat(form.peso) || parseFloat(selected?.peso) || 0;
    const getNum = Number(liveSmartMacros?.matematico?.get || liveSmartMacros?.get) || 0;
    if (getNum <= 0) return;
    const newKcal = Math.round(getNum * (1 + pct / 100));
    const curP = Number(manualMacros.proteinG) || Number(liveSmartMacros.proteinG) || (p > 0 ? Math.round(p * 2.0) : 0);
    const curF = Number(manualMacros.fatsG) || Number(liveSmartMacros.fatsG) || (p > 0 ? Math.round(p * 0.9) : 0);
    const newC = Math.max(0, Math.round((newKcal - curP * 4 - curF * 9) / 4));
    setManualMacros({
      targetKcal: String(newKcal),
      proteinG: String(curP),
      carbsG: String(newC),
      fatsG: String(curF),
    });
  };

  const handleAdjustProtGKg = (newGKg) => {
    const p = parseFloat(form.peso) || parseFloat(selected?.peso) || 0;
    if (p <= 0) return;
    const newProtG = Math.round(p * newGKg);
    const kcal = Number(manualMacros.targetKcal) || Number(liveSmartMacros.targetKcal) || 0;
    const curF = Number(manualMacros.fatsG) || Number(liveSmartMacros.fatsG) || 0;
    const newCarbs = Math.max(0, Math.round((kcal - newProtG * 4 - curF * 9) / 4));
    setManualMacros(prev => ({
      ...prev,
      targetKcal: String(kcal),
      proteinG: String(newProtG),
      carbsG: String(newCarbs),
    }));
  };

  const handleAdjustFatGKg = (newGKg) => {
    const p = parseFloat(form.peso) || parseFloat(selected?.peso) || 0;
    if (p <= 0) return;
    const newFatG = Math.round(p * newGKg);
    const kcal = Number(manualMacros.targetKcal) || Number(liveSmartMacros.targetKcal) || 0;
    const curP = Number(manualMacros.proteinG) || Number(liveSmartMacros.proteinG) || 0;
    const newCarbs = Math.max(0, Math.round((kcal - curP * 4 - newFatG * 9) / 4));
    setManualMacros(prev => ({
      ...prev,
      targetKcal: String(kcal),
      fatsG: String(newFatG),
      carbsG: String(newCarbs),
    }));
  };

  const handleAdjustPct = (type, val) => {
    const kcal = Number(manualMacros.targetKcal) || Number(liveSmartMacros.targetKcal) || 0;
    if (kcal <= 0) return;
    const curP = Number(activePrescription?.proteinPct) || 30;
    const curC = Number(activePrescription?.carbsPct) || 45;
    const curF = Number(activePrescription?.fatsPct) || 25;
    let nextP = type === 'p' ? val : curP;
    let nextF = type === 'f' ? val : curF;
    let nextC = type === 'c' ? val : (100 - nextP - nextF);
    if (nextC < 0) nextC = 0;
    const pG = Math.round(((nextP / 100) * kcal) / 4);
    const fG = Math.round(((nextF / 100) * kcal) / 9);
    const cG = Math.max(0, Math.round((kcal - pG * 4 - fG * 9) / 4));
    setManualMacros({
      targetKcal: String(kcal),
      proteinG: String(pG),
      carbsG: String(cG),
      fatsG: String(fG),
    });
  };

  const routineDaysCount = useMemo(() => {
    if (!Array.isArray(rutinas) || rutinas.length === 0) return 0;
    const uniqueDays = new Set();
    rutinas.forEach(r => {
      const parts = (r.nombre || "").split("|");
      const dayTag = parts.length > 1 ? parts[0] : "";
      if (dayTag && dayTag !== "S/D") uniqueDays.add(dayTag.toLowerCase());
    });
    return uniqueDays.size > 0 ? uniqueDays.size : rutinas.length;
  }, [rutinas]);

  const suggestedFafFromTraining = useMemo(() => {
    const days = routineDaysCount > 0
      ? routineDaysCount
      : (parseInt(form.dias_ejercicio_actual, 10) || 0);

    if (days <= 1) return { value: 1.2, days, label: days === 0 ? "0–1 día (Sedentario)" : "1 día programado (Sedentario)" };
    if (days <= 3) return { value: 1.375, days, label: `${days} días programados (Ligero)` };
    if (days <= 5) return { value: 1.55, days, label: `${days} días programados (Moderado)` };
    return { value: 1.725, days, label: `${days} días programados (Activo/Intenso)` };
  }, [routineDaysCount, form.dias_ejercicio_actual]);

  const adherenceSummary = useMemo(() => {
    if (!nutriDias.length || !Object.keys(nutriProgreso).length) return null;
    let totalComidas = 0;
    let comidasRealizadas = 0;
    let totalAguaMl = 0;
    let totalMetaAguaMl = 0;
    let diasRegistrados = 0;

    Object.values(nutriProgreso).forEach(r => {
      if (!r) return;
      const cTotal = Number(r.comidas_total) || 0;
      const cDone = Number(r.comidas_realizadas) || 0;
      const agua = Number(r.agua_ml) || 0;
      const metaAgua = Number(r.meta_agua_ml) || 2000;
      if (cTotal > 0 || agua > 0) diasRegistrados++;
      totalComidas += cTotal;
      comidasRealizadas += cDone;
      totalAguaMl += agua;
      totalMetaAguaMl += metaAgua;
    });

    if (diasRegistrados === 0) return null;
    const pctComidas = totalComidas > 0 ? Math.round((comidasRealizadas / totalComidas) * 100) : 0;
    const pctAgua = totalMetaAguaMl > 0 ? Math.round((totalAguaMl / totalMetaAguaMl) * 100) : 0;
    const promedioAguaL = (totalAguaMl / (diasRegistrados * 1000)).toFixed(1);
    return {
      pctComidas,
      pctAgua,
      promedioAguaL,
      diasRegistrados,
      summaryText: `Cumplimiento de comidas: ${pctComidas}% • Apego al agua: ${pctAgua}% (~${promedioAguaL} L/día en ${diasRegistrados} días registrados)`
    };
  }, [nutriDias, nutriProgreso]);

  const isFirstEvaluationEver = !editingId && allLinkedMetricas.length === 0;

  const saveMetrica = async () => {
    setSaving(true);
    try {
      const rawData = {};
      if (!editingId) rawData.cliente_id = selected.id;
      const targetCicloId = form.ciclo_id || (cicloActivo || cicloSel)?.id || null;
      if (targetCicloId) {
        rawData.ciclo_id = targetCicloId;
      }
      const IGNORED_KEYS = new Set(["id", "created_at", "updated_at", "cliente_id", "fotos", "_rawNotas"]);
      const STRING_KEYS = new Set([
        "fecha", "presion_arterial", "notas", "metodo_evaluacion",
        "checkin_observaciones", "checkin_ajustes", "eval_objetivo", "eval_faf", "eval_faf_notas",
        "preferencias_alimentos", "aversiones_alimentos",
        "r24h_desayuno", "r24h_colacion_m", "r24h_comida", "r24h_colacion_v", "r24h_cena", "r24h_picoteos",
        "horas_sueno", "consumo_agua_estimado", "nivel_estres",
        "dias_ejercicio_actual", "horario_ejercicio"
      ]);
      Object.entries(form).forEach(([k, v]) => {
        if (IGNORED_KEYS.has(k)) return;
        if (v !== "" && v !== null && v !== undefined) {
          if (STRING_KEYS.has(k)) { rawData[k] = v; }
          else { const n = parseFloat(v); rawData[k] = isNaN(n) ? v : n; }
        }
      });
      rawData.metodo_evaluacion = form.metodo_evaluacion;
      rawData.evalSexo = evalSexo;
      rawData.evalEdad = evalEdad;

      // Preservar modo de prescripción y resultados de auditoría clínica con IA
      rawData.prescription_mode = prescriptionMode;
      if (aiAuditResult) {
        rawData.ai_audit_result = aiAuditResult;
      }
      if (manualMacros && (manualMacros.targetKcal || manualMacros.proteinG || manualMacros.carbsG || manualMacros.fatsG)) {
        rawData.manual_macros = manualMacros;
      }
      if (activePrescription && activePrescription.targetKcal > 0) {
        rawData.prescribed_macros = {
          targetKcal: activePrescription.targetKcal,
          tmb: activePrescription.tmb,
          get: activePrescription.get,
          proteinG: activePrescription.proteinG,
          carbsG: activePrescription.carbsG,
          fatsG: activePrescription.fatsG,
          protGKg: activePrescription.protGKg,
          carbGKg: activePrescription.carbGKg,
          fatGKg: activePrescription.fatGKg,
          proteinPct: activePrescription.proteinPct,
          carbsPct: activePrescription.carbsPct,
          fatsPct: activePrescription.fatsPct,
          goalPct: activePrescription.goalPct,
          mode: activePrescription.mode,
          modeLabel: activePrescription.modeLabel,
          badgeMotivo: activePrescription.badgeMotivo || null,
          analisisClinico: activePrescription.analisisClinico || null,
          ajustesSugeridos: activePrescription.ajustesSugeridos || [],
          estrategiaMenu: activePrescription.estrategiaMenu || null,
          model: activePrescription.model || null,
          smaeDistribution: effectiveSmaeDistribution || null,
          smaeCustomized: isCustomSmaeActive,
        };
      }

      const calc = calculateBodyComposition(form, evalSexo, evalEdad);
      const data = prepareMetricaPayload(rawData, calc);

      // Subir fotos en paralelo para máxima velocidad
      let uploadedUrls = [];
      if (pendingFotos.length > 0) {
        uploadedUrls = await Promise.all(
          pendingFotos.map(async (file, idx) => {
            const cleanName = (file.name || "foto.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
            const path = `${selected.id}/${Date.now()}_${idx}_${cleanName}`;
            const compressedFile = await compressImageIfNeeded(file);
            return await storageUpload("progress-photos", path, compressedFile);
          })
        );
      }

      // Merge existing + new photos
      const allFotos = [...existingFotos, ...uploadedUrls];
      data.fotos = allFotos;

      // Sincronizar peso y género en el perfil del paciente si cambiaron
      if (selected?.id) {
        const targetGenero = evalSexo === "F" ? "Femenino" : "Masculino";
        const clientPatch = {};
        if (selected.genero !== targetGenero) clientPatch.genero = targetGenero;
        if (data.peso && Number(data.peso) > 0 && Number(selected.peso) !== Number(data.peso)) {
          clientPatch.peso = Number(data.peso);
        }
        if (Object.keys(clientPatch).length > 0) {
          dbPatch(`clientes?id=eq.${selected.id}`, clientPatch).catch(() => {});
        }
      }

      let savedRow = null;
      if (editingId) {
        const patchRes = await dbPatch(`metricas_progreso?id=eq.${editingId}`, data, { headers: { Prefer: "return=representation" } });
        savedRow = Array.isArray(patchRes) && patchRes[0] ? patchRes[0] : { ...data, id: editingId };
        setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Evaluación actualizada</div>);
      } else {
        const postRes = await dbPost("metricas_progreso", data, { headers: { Prefer: "return=representation" } });
        savedRow = Array.isArray(postRes) && postRes[0] ? postRes[0] : { ...data, id: `temp_${Date.now()}` };
        setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Evaluación guardada</div>);

        if (['cliente', 'client'].includes(localStorage.getItem('flux_role')) && selected.nutriologo_id) {
          dbPost("notificaciones", {
            profile_id: selected.nutriologo_id,
            titulo: "Nuevo progreso registrado",
            mensaje: `${selected.nombre || 'Un paciente'} ha registrado nuevas métricas de progreso.`,
            tipo: "progreso",
            link_url: "clientes",
            entidad_id: selected.id
          }, { headers: { Prefer: "return=minimal" } }).catch(() => {});
        }
      }

      // Sincronizar check-in al expediente clínico
      if (selected?.id && (form.checkin_observaciones || form.checkin_ajustes || form.checkin_energia)) {
        const checkinEntry = {
          id: `eval_${editingId || savedRow.id || Date.now()}`,
          fecha: form.fecha || new Date().toISOString().split("T")[0],
          energia: Number(form.checkin_energia) || 4,
          saciedad: Number(form.checkin_saciedad) || 4,
          digestion: Number(form.checkin_digestion) || 4,
          descanso: Number(form.checkin_descanso) || 4,
          observaciones: (form.checkin_observaciones || "").trim(),
          ajustes_solicitados: (form.checkin_ajustes || "").trim(),
          autor: "nutriologo",
        };
        const prevCheckins = Array.isArray(clinicalRec?.checkins) ? clinicalRec.checkins : [];
        const filtered = prevCheckins.filter(c => c.id !== checkinEntry.id && c.fecha !== checkinEntry.fecha);
        const nextRec = {
          ...clinicalRec,
          checkins: [checkinEntry, ...filtered].slice(0, 50),
          solicitud_activa: null,
        };
        saveClinicalRecord(selected.id, nextRec).then(rec => setClinicalRec(rec)).catch(() => {});
      }

      // Limpiar de la lista de eliminados en caso de que coincida
      if (savedRow?.id) deletedIdsRef.current.delete(String(savedRow.id));
      if (editingId) deletedIdsRef.current.delete(String(editingId));

      // 1. Actualización optimista instantánea (0ms) en el estado de React:
      const rowWithCiclo = {
        ...savedRow,
        ciclo_id: targetCicloId,
        prescription_mode: prescriptionMode,
        ai_audit_result: aiAuditResult,
        manual_macros: manualMacros,
        prescribed_macros: rawData.prescribed_macros || activePrescription,
      };
      const enrichedItem = enrichMetrica(rowWithCiclo);
      setMetricas(prev => {
        const filtered = prev.filter(m => String(m.id) !== String(enrichedItem.id) && String(m.id) !== String(editingId));
        const next = [enrichedItem, ...filtered];
        return next.sort((a, b) => new Date((b.fecha || "") + "T12:00:00") - new Date((a.fecha || "") + "T12:00:00"));
      });

      // 2. Actualizar caché de consulta (queryCache) de inmediato para evitar lecturas obsoletas:
      updateQueryCache("metricas_progreso", (cachedList) => {
        if (!Array.isArray(cachedList)) return [rowWithCiclo];
        const filtered = cachedList.filter(m => String(m.id) !== String(savedRow.id) && String(m.id) !== String(editingId));
        const next = [rowWithCiclo, ...filtered];
        return next.sort((a, b) => new Date((b.fecha || "") + "T12:00:00") - new Date((a.fecha || "") + "T12:00:00"));
      });

      // 3. Sincronizar automáticamente la prescripción seleccionada al Plan Nutricional activo
      if (autoSyncMacros && !isReadOnly && activePrescription?.targetKcal > 0 && selected?.id) {
        try {
          const nutriPayload = {
            calorias: Math.round(Number(activePrescription.targetKcal) || 0),
            proteina: Math.round(Number(activePrescription.proteinG) || 0),
            carbohidratos: Math.round(Number(activePrescription.carbsG) || 0),
            grasas: Math.round(Number(activePrescription.fatsG) || 0),
          };
          const cycleQuery = targetCicloId ? `ciclo_id=eq.${targetCicloId}` : `ciclo_id=is.null`;
          const currentNutri = await dbGetFresh(`nutricion?cliente_id=eq.${selected.id}&${cycleQuery}&limit=1`);
          if (currentNutri && currentNutri.length > 0) {
            await dbPatch(`nutricion?id=eq.${currentNutri[0].id}`, nutriPayload);
          } else {
            await dbPost("nutricion", {
              cliente_id: selected.id,
              ...nutriPayload,
              ...(targetCicloId ? { ciclo_id: targetCicloId } : {})
            });
          }
        } catch (syncErr) {
          console.warn("Error sincronizando plan de nutrición desde evaluación:", syncErr);
        }
      }

      const macrosToSync = (autoSyncMacros && !isReadOnly && activePrescription?.targetKcal > 0)
        ? {
            ...activePrescription,
            prescriptionMode,
          }
        : null;

      closeModal();
      setSaving(false);
      await load(true);
      if (typeof window !== "undefined" && selected?.id) {
        window.dispatchEvent(new CustomEvent("flux:metricas-updated", {
          detail: {
            clienteId: selected.id,
            source: "ProgresoCliente",
            prescribedMacros: macrosToSync,
          }
        }));
        // Proceso secundario en segundo plano: regenerar resúmenes exclusivos de Dieta y Rutina con la nueva evaluación
        try {
          const recActual = clinicalRecord || peekClinicalRecord(selected.id);
          const cicloRef = cicloActivo || cicloSel || null;
          const sp = generateSmartMacroPrescription({
            cliente: selected,
            metrica: enrichedItem,
            clinicalRec: recActual,
            ciclo: cicloRef,
            cicloNombre: cicloRef?.nombre || "",
          });
          const stp = generateSmartTrainingPrescription({
            cliente: selected,
            metrica: enrichedItem,
            clinicalRec: recActual,
            ciclo: cicloRef,
            cicloNombre: cicloRef?.nombre || "",
            smartPrescription: sp,
            isMiPlan,
          });
          syncDualDomainSummariesInBackground({
            clienteId: selected.id,
            cliente: selected,
            clinicalRec: recActual,
            metrica: enrichedItem,
            smartPrescription: sp,
            smartTrainingPrescription: stp,
            force: true,
          }).catch(() => {});
        } catch {}
      }
    } catch(e) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>); }
    setSaving(false);
  };

  const closeModal = () => {
    setShowModal(false); setForm(emptyForm());
    setPendingFotos([]); setPreviewUrls([]);
    setEditingId(null); setExistingFotos([]);
    setCustomSmaeMap(null);
    setShowStep5SmaeTable(false);
    setInbodyOcrResult(null);
    setAnalyzingInbody(false);
  };

  const startEdit = (mRaw) => {
    const m = enrichMetrica(mRaw);
    const filled = emptyForm();
    const targetCiclo = cicloActivo || cicloSel;
    filled.ciclo_id = m.ciclo_id || targetCiclo?.id || "";

    // 1. Detección inteligente del método de evaluación si no está definido o es ambiguo
    let metodo = m.metodo_evaluacion || "";
    if (!metodo) {
      if (m.inbody_smm || m.inbody_score || m.inbody_tbw || m.inbody_proteina || m.inbody_mineral_oseo || m.inbody_grasa_visceral) {
        metodo = "inbody";
      } else if (m.diametro_muneca || m.diametro_codo || m.diametro_rodilla || (m.pliegue_pantorrilla && m.pliegue_subescapular)) {
        metodo = "manual";
      } else if (m.pliegue_biceps && m.pliegue_triceps && !m.pliegue_abdominal) {
        metodo = "plicometria_dw4";
      } else if (m.pliegue_pectoral || m.pliegue_abdominal || m.pliegue_muslo || m.pliegue_suprailiaco || m.pliegue_triceps) {
        metodo = "plicometria_jp3";
      } else {
        metodo = isCivil ? "basico" : "basico";
      }
    }
    filled.metodo_evaluacion = metodo;

    // 2. Mapear todos los campos existentes de m a filled
    const IGNORED = new Set(["id", "created_at", "updated_at", "cliente_id", "fotos", "_rawNotas"]);
    Object.keys(filled).forEach(k => {
      if (m[k] !== null && m[k] !== undefined && m[k] !== "") {
        filled[k] = String(m[k]);
      }
    });
    Object.keys(m).forEach(k => {
      if (!IGNORED.has(k) && m[k] !== null && m[k] !== undefined && m[k] !== "") {
        filled[k] = String(m[k]);
      }
    });

    if (m.fecha) {
      filled.fecha = String(m.fecha).split("T")[0];
    }

    // Fallback inteligente para eval_objetivo y eval_faf si es una evaluación previa sin esos metadatos
    if (!filled.eval_objetivo) {
      filled.eval_objetivo = inferGoalFromText(
        clinicalRec?.anamnesis?.objetivo_principal || selected?.objetivo || targetCiclo?.nombre || ""
      );
    }
    if (!filled.eval_faf) {
      filled.eval_faf = String(inferFafFromAnamnesis(clinicalRec?.anamnesis));
    }
    if (!filled.eval_faf_notas && m.eval_faf_notas) {
      filled.eval_faf_notas = String(m.eval_faf_notas);
    }

    // 3. Cruzar check-in del expediente clínico si faltaban observaciones o escalas
    const checkinList = Array.isArray(clinicalRec?.checkins) ? clinicalRec.checkins : [];
    const evalFecha = filled.fecha;
    const matchingCheckin = checkinList.find(c =>
      c.id === `eval_${m.id}` ||
      (c.fecha && evalFecha && c.fecha.split("T")[0] === evalFecha)
    ) || (checkinList.length > 0 && Math.abs(new Date(checkinList[0].fecha || "").getTime() - new Date(evalFecha || "").getTime()) < 86400000 * 2 ? checkinList[0] : null);

    if (matchingCheckin) {
      if (!filled.checkin_energia || filled.checkin_energia === "4") {
        if (matchingCheckin.energia) filled.checkin_energia = String(matchingCheckin.energia);
      }
      if (!filled.checkin_saciedad || filled.checkin_saciedad === "4") {
        if (matchingCheckin.saciedad) filled.checkin_saciedad = String(matchingCheckin.saciedad);
      }
      if (!filled.checkin_digestion || filled.checkin_digestion === "4") {
        if (matchingCheckin.digestion) filled.checkin_digestion = String(matchingCheckin.digestion);
      }
      if (!filled.checkin_descanso || filled.checkin_descanso === "4") {
        if (matchingCheckin.descanso) filled.checkin_descanso = String(matchingCheckin.descanso);
      }
      if (!filled.checkin_observaciones && matchingCheckin.observaciones) {
        filled.checkin_observaciones = String(matchingCheckin.observaciones);
      }
      if (!filled.checkin_ajustes && matchingCheckin.ajustes_solicitados) {
        filled.checkin_ajustes = String(matchingCheckin.ajustes_solicitados);
      }
    }

    // 4. Configurar sexo, edad, fotos y estado de edición
    const detectedSexo = normalizeSexo(m.sexo || selected?.genero || selected?.sexo || clinicalRec?.anamnesis?.genero);
    const detectedEdad = Number(m.edad) || calcEdadFromBirthdate(selected?.fecha_nacimiento, 25);
    setEvalSexo(detectedSexo);
    setEvalEdad(detectedEdad);
    setForm(filled);
    setAutoSyncMacros(true);

    // Restaurar modo de prescripción previamente seleccionado por el doctor
    const savedMode = m.prescription_mode || m.prescriptionMode || (m.ai_audit_result || m.aiAuditResult ? "ia" : "matematico");
    setPrescriptionMode(savedMode);

    // Restaurar macros manuales si existían
    if (m.manual_macros || m.manualMacros) {
      setManualMacros(m.manual_macros || m.manualMacros);
    } else {
      setManualMacros({ targetKcal: "", proteinG: "", carbsG: "", fatsG: "" });
    }

    // Restaurar resultado de auditoría clínica con IA de Gemini
    if (m.ai_audit_result || m.aiAuditResult) {
      setAiAuditResult(m.ai_audit_result || m.aiAuditResult);
    } else {
      setAiAuditResult(null);
    }

    // Restaurar distribución de equivalentes SMAE del ciclo solo si fue ajustada manualmente por el nutriólogo
    if (
      m.prescribed_macros?.smaeCustomized &&
      m.prescribed_macros?.smaeDistribution &&
      Object.keys(m.prescribed_macros.smaeDistribution).length > 0
    ) {
      const savedSig = `${savedMode}_${m.prescribed_macros.targetKcal || 0}_${m.prescribed_macros.proteinG || 0}_${m.prescribed_macros.carbsG || 0}_${m.prescribed_macros.fatsG || 0}`;
      setCustomSmaeMap({
        signature: savedSig,
        map: m.prescribed_macros.smaeDistribution,
      });
    } else {
      setCustomSmaeMap(null);
    }
    setShowStep5SmaeTable(false);

    setIsAuditingAi(false);
    setAiAuditError(null);
    setEditingId(m.id);
    setExistingFotos(parseFotos(m.fotos));
    setPendingFotos([]);
    setPreviewUrls([]);
    setShowModal(true);
  };

  const deleteFoto = async (metrica, fotoUrl) => {
    const newFotos = parseFotos(metrica.fotos).filter(u => u !== fotoUrl);
    setMetricas(prev => prev.map(m => m.id === metrica.id ? { ...m, fotos: newFotos } : m));
    setExistingFotos(prev => prev.filter(u => u !== fotoUrl));

    try {
      await dbPatch(`metricas_progreso?id=eq.${metrica.id}`, { fotos: newFotos });
      if (fotoUrl && fotoUrl.includes("storage/v1/object/public/progress-photos/")) {
        const oldPath = fotoUrl.split("/public/progress-photos/")[1];
        if (oldPath) {
          storageDelete("progress-photos", oldPath).catch(err => console.warn("No se pudo borrar foto progreso", err));
        }
      } else if (fotoUrl && fotoUrl.includes("storage/v1/object/public/logos/")) {
        const oldPath = fotoUrl.split("/public/logos/")[1];
        if (oldPath) {
          storageDelete("logos", oldPath).catch(err => console.warn("No se pudo borrar foto", err));
        }
      }
    } catch (err) {
      console.warn("Error borrando foto", err);
    }
  };

  const deleteMetrica = (id) => {
    setConfirmDelete({
      title: "¿Eliminar evaluación?",
      description: "Esta evaluación y sus mediciones se eliminarán permanentemente. Esta acción no se puede deshacer.",
      confirmText: "Eliminar evaluación",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        const idStr = String(id);
        deletedIdsRef.current.add(idStr);
        const prevMetricas = metricas;
        setConfirmDelete(null);

        // 1. Eliminación optimista instantánea (0ms) en el estado React
        setMetricas(prev => prev.filter(m => String(m.id) !== idStr));

        // 2. Actualizar caché de consulta (queryCache) de inmediato para evitar lecturas obsoletas
        updateQueryCache("metricas_progreso", (cachedList) => {
          if (!Array.isArray(cachedList)) return [];
          return cachedList.filter(m => String(m.id) !== idStr);
        });

        // 3. Sincronizar y limpiar check-in asociado en el expediente si existe
        if (selected?.id && Array.isArray(clinicalRec?.checkins)) {
          const filteredCheckins = clinicalRec.checkins.filter(c =>
            String(c.id) !== `eval_${idStr}` && String(c.id) !== idStr
          );
          if (filteredCheckins.length !== clinicalRec.checkins.length) {
            const nextRec = { ...clinicalRec, checkins: filteredCheckins };
            saveClinicalRecord(selected.id, nextRec).then(rec => setClinicalRec(rec)).catch(() => {});
          }
        }

        setMsg(<div className="flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> Evaluación eliminada</div>);

        // Si es un ID temporal de memoria (aún no persistido en BD), no llamar a dbDel
        if (idStr.startsWith("temp_")) return;

        try {
          await dbDel(`metricas_progreso?id=eq.${idStr}`);
          if (typeof window !== "undefined" && selected?.id) {
            window.dispatchEvent(new CustomEvent("flux:metricas-updated", {
              detail: { clienteId: selected.id, source: "ProgresoCliente" }
            }));
          }
        } catch(err) {
          deletedIdsRef.current.delete(idStr);
          setMetricas(prevMetricas);
          setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { err.message }</div>);
        }
      }
    });
  };

  const showRutinasSub = isCivil || isMiPlan || (clinicalRec?.servicios_activos?.entrenamiento !== false) || rutinas.length > 0;
  const showNutriSub = isCivil || isMiPlan || (clinicalRec?.servicios_activos?.nutricion !== false) || nutriDias.length > 0;

  useEffect(() => {
    if (mode) return;
    if (sub === "rutinas" && !showRutinasSub) setSub("evaluaciones");
    else if (sub === "nutricion" && !showNutriSub) setSub("evaluaciones");
  }, [sub, showRutinasSub, showNutriSub, mode]);

  const delta = (curr, prev, key) => {
    if (curr[key]==null || prev[key]==null || curr[key]==="" || prev[key]==="") return null;
    const d = parseFloat(curr[key]) - parseFloat(prev[key]);
    return d === 0 ? null : d;
  };

  const DISPLAY_KEYS = [
    { key:"peso",               label:"Peso",      unit:"kg",    icon:<Scale className="w-3.5 h-3.5" /> },
    { key:"imc",                label:"IMC",       unit:"",      icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"grasa_pct",          label:"Grasa",     unit:"%",     icon:<Activity className="w-3.5 h-3.5" /> },
    { key:"masa_libre_grasa",   label:"MLG",       unit:"kg",    icon:<BicepsFlexed className="w-3.5 h-3.5" /> },
    { key:"musculo_pct",        label:"Músculo",   unit:"%",     icon:<BicepsFlexed className="w-3.5 h-3.5" /> },
    { key:"calc_masa_grasa",    label:"M. Grasa",  unit:"kg",    icon:<Activity className="w-3.5 h-3.5" /> },
    { key:"calc_masa_muscular", label:"M. Muscular",unit:"kg",   icon:<BicepsFlexed className="w-3.5 h-3.5" /> },
    { key:"calc_masa_osea",     label:"M. Ósea",   unit:"kg",    icon:<Activity className="w-3.5 h-3.5" /> },
    { key:"calc_masa_residual", label:"M. Residual",unit:"kg",   icon:<Activity className="w-3.5 h-3.5" /> },
    { key:"inbody_smm",         label:"SMM",       unit:"kg",    icon:<BicepsFlexed className="w-3.5 h-3.5" /> },
    { key:"inbody_tbw",         label:"TBW",       unit:"L",     icon:<Activity className="w-3.5 h-3.5" /> },
    { key:"inbody_score",       label:"Puntuación",unit:"",      icon:<Target className="w-3.5 h-3.5" /> },
    { key:"cintura",            label:"Cintura",   unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"cadera",             label:"Cadera",    unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"icc",                label:"ICC",       unit:"",      icon:<Scale className="w-3.5 h-3.5" /> },
    { key:"ice",                label:"ICE",       unit:"",      icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"pecho",              label:"Pecho",     unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"brazo_relajado",     label:"Brazo",     unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"muslo",              label:"Muslo",     unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"somatotipo_x",       label:"Somato X",  unit:"",      icon:<Target className="w-3.5 h-3.5" /> },
    { key:"somatotipo_y",       label:"Somato Y",  unit:"",      icon:<Target className="w-3.5 h-3.5" /> },
    { key:"glucosa",            label:"Glucosa",   unit:"mg/dL", icon:<Stethoscope className="w-3.5 h-3.5" /> },
    { key:"presion_arterial",   label:"Presión",   unit:"",      icon:<Heart className="w-3.5 h-3.5" /> },
  ];

  const allClientPhotos = useMemo(() => {
    const list = (mode === "historico" || sub === "historico") ? allLinkedMetricas : displayedMetricas;
    return list.flatMap(m =>
      parseFotos(m.fotos)
        .filter(Boolean)
        .map(url => ({
          url,
          fecha: m.fecha,
          label: fmtDate(m.fecha),
          peso: m.peso,
          grasa_pct: m.grasa_pct,
        }))
    );
  }, [mode, sub, allLinkedMetricas, displayedMetricas]);

  const activeSection = mode || sub;

  if (loading) return <ListSkeleton rows={4} />;

  return (
    <div className="pb-28 md:pb-8">
      {/* Sub-nav (solo si no se definió un modo fijo) */}
      {!mode && (
        <div className="flex gap-1 mb-5 mx-3 md:mx-0 bg-[#F0F4FA] rounded-xl p-1 w-[calc(100%-1.5rem)] sm:w-max overflow-x-auto scroll-hide">
          {[
            { k: "evaluaciones", ic: <BarChart2 className="w-4 h-4 shrink-0" />, lb: "Evaluaciones" },
            ...(showRutinasSub ? [{ k: "rutinas", ic: <Dumbbell className="w-4 h-4 shrink-0" />, lb: "Adherencia Rutinas" }] : []),
            ...(showNutriSub ? [{ k: "nutricion", ic: <UtensilsCrossed className="w-4 h-4 shrink-0" />, lb: "Adherencia Nutrición" }] : [])
          ].map(({ k, ic, lb }) => (
            <button
              key={k}
              onClick={() => setSub(k)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-[13px] whitespace-nowrap transition-all flex-1 sm:flex-none shrink-0 ${
                sub === k
                  ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold border border-transparent"
                  : "text-[#6B7A8D] hover:text-[#0B1929] border border-transparent"
              }`}
            >
              {ic} {lb}
            </button>
          ))}
        </div>
      )}

      {/* ── EVALUACIONES ── */}
      {activeSection === "evaluaciones" && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-3 px-3.5 md:px-0 flex-nowrap">
            <div className="flex items-center gap-1.5 sm:gap-2 shrink min-w-0">
              <span className="font-bold text-[#0B1929] text-sm sm:text-base whitespace-nowrap">
                {/* En móvil: Breve y limpio sin saturar la pantalla */}
                <span className="inline sm:hidden">
                  Evaluaciones{" "}
                  <span className="text-[#6B7A8D] font-normal">({displayedMetricas.length})</span>
                </span>
                {/* En desktop: Título descriptivo completo */}
                <span className="hidden sm:inline">
                  {cycleInfo.enfoque ? (
                    <>
                      <span>{cycleInfo.enfoque}</span>
                      <span className="text-xs sm:text-sm font-semibold text-[var(--brand-primary)] ml-1.5">
                        · {cycleInfo.nombreBase}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Evaluación del plan:</span>{" "}
                      <span className="text-[var(--brand-primary)]">{cycleInfo.nombreBase}</span>
                    </>
                  )}
                  <span className="text-[#6B7A8D] font-normal ml-1.5">
                    ({displayedMetricas.length})
                  </span>
                </span>
              </span>

              {Boolean(cycleInfo.dias && cycleInfo.semanas) && (
                <span className="text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg bg-blue-50 text-[var(--brand-primary)] border border-blue-200/60 shrink-0 whitespace-nowrap">
                  {cycleInfo.dias}d • {cycleInfo.semanas}sem
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {displayedMetricas.length > 0 && (
                <button
                  onClick={() => {
                    if (isFreemium) {
                      openPaywall("metricas");
                      return;
                    }
                    generateProgresoPDF(selected, displayedMetricas, brand);
                  }}
                  className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-[#0B1929] hover:bg-gray-50 transition-colors flex items-center justify-center sm:gap-1.5 cursor-pointer shadow-2xs relative text-xs sm:text-sm font-bold"
                  title="Descargar Reporte PDF"
                >
                  <FileText className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
                  <span className="hidden sm:inline">PDF</span>
                  {isFreemium && (
                    <>
                      <span className="sm:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 border border-white" />
                      <span className="hidden sm:inline text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                        PRO
                      </span>
                    </>
                  )}
                </button>
              )}
              {!isReadOnly && (
                <button
                  onClick={openNewEvaluation}
                  className={`${displayedMetricas.length === 0 ? "hidden sm:inline-flex" : "inline-flex"} w-8 h-8 sm:w-auto sm:px-3.5 sm:py-1.5 rounded-xl bg-[var(--brand-primary)] text-white hover:opacity-90 transition-colors items-center justify-center sm:gap-1.5 cursor-pointer shadow-sm text-xs sm:text-sm font-bold`}
                  title="Nueva evaluación"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Nueva evaluación</span>
                </button>
              )}
            </div>
          </div>

          {displayedMetricas.length === 0 ? (
            <div className="text-center py-12 text-[#6B7A8D] bg-white rounded-none md:rounded-2xl border-y md:border border-dashed border-[#E2E8F0] p-6 mb-4">
              <div className="flex justify-center mb-3 text-[#CBD5E1]"><BarChart2 className="w-12 h-12" /></div>
              <div className="text-[15px] font-bold text-[#0B1929] mb-1.5">
                Sin evaluaciones en este plan
              </div>
              <div className="text-[13px] max-w-sm mx-auto mb-4">
                {isReadOnly
                  ? `Este plan histórico (${cycleInfo.nombreBase}) no tiene evaluaciones registradas.`
                  : `Registra la primera evaluación corporal y check-in para ${cycleInfo.enfoque ? `${cycleInfo.enfoque} (${cycleInfo.nombreBase})` : cycleInfo.nombreBase}.`}
              </div>
              {!isReadOnly && (
                <button onClick={openNewEvaluation} className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm mx-auto">
                  <Plus className="w-4 h-4" /> Registrar evaluación
                </button>
              )}
            </div>
          ) : displayedMetricas.map((m, idx) => {
            const prev = displayedMetricas[idx + 1];
            const isFreemium = isCivil && selected?.plan_tipo !== 'premium';
            const isLocked = isFreemium && idx > 0;
            const cycleName = ciclos.find(c => String(c.id) === String(m.ciclo_id))?.nombre?.split("|")[0];
            return (
              <div key={m.id} className="relative bg-white rounded-none md:rounded-[14px] border-y md:border border-[#E2E8F0] p-3 sm:p-4 mb-2.5 sm:mb-3 shadow-none md:shadow-sm overflow-hidden">
                {isLocked && (
                  <div
                    onClick={() => openPaywall("metricas")}
                    className="absolute inset-0 z-10 backdrop-blur-[3px] bg-white/60 flex flex-col items-center justify-center gap-2 rounded-none md:rounded-[14px] cursor-pointer hover:bg-white/75 transition-all active:scale-[0.99]"
                  >
                    <Lock className="w-6 h-6 text-amber-500" />
                    <p className="text-xs font-bold text-[#0B1929] text-center px-4">Historial exclusivo Premium</p>
                    <p className="text-[11px] text-[var(--brand-primary)] font-bold text-center px-6 underline">Toca para desbloquear con FLUX Pro</p>
                  </div>
                )}
                <div className={isLocked ?"blur-sm pointer-events-none select-none" :""}>
                {/* ── Fila Superior de la Evaluación: Fecha, badges y acciones compactas ── */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-bold text-[var(--brand-primary)] text-sm sm:text-[15px] flex items-center gap-1.5 whitespace-nowrap">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {fmtDate(m.fecha)}
                    </span>
                    {idx===0 && (
                      <span className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                        Más reciente
                      </span>
                    )}
                    {m.metodo_evaluacion && (
                      <span className={`text-[9.5px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md font-bold uppercase tracking-wide whitespace-nowrap ${m.metodo_evaluacion === 'inbody' ? 'bg-purple-50 text-purple-600 border border-purple-100' : m.metodo_evaluacion === 'basico' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                        {getMetodoLabel(m.metodo_evaluacion)}
                      </span>
                    )}
                  </div>
                  {/* Acciones en la esquina superior derecha */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={()=>startEdit(m)}
                      className="border border-[#E2E8F0] text-[#6B7A8D] p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-1 cursor-pointer"
                      title={isReadOnly ? "Ver detalles" : "Editar evaluación"}
                    >
                      {isReadOnly ? <Eye className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isReadOnly ? "Ver" : "Editar"}</span>
                    </button>
                    {!isReadOnly && (
                      <button
                        onClick={()=>deleteMetrica(m.id)}
                        className="bg-red-50 text-red-600 p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Eliminar evaluación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Borrar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Fila de Metas / FAF / Calorías ── */}
                {(m.eval_objetivo || m.eval_faf || m.prescribed_macros?.targetKcal || m.ai_audit_result?.targetKcal) && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    {m.eval_objetivo && (() => {
                      const g = getGoalPresetInfo(m.eval_objetivo);
                      return g ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
                          <Target className="w-3 h-3" /> {g.title} ({g.pct > 0 ? `+${g.pct}%` : `${g.pct}%`})
                        </span>
                      ) : null;
                    })()}
                    {m.eval_faf && (() => {
                      const f = getActivityFactorInfo(m.eval_faf);
                      return f ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
                          <Flame className="w-3 h-3" /> FAF {f.value} ({f.label})
                        </span>
                      ) : null;
                    })()}
                    {(m.prescribed_macros?.targetKcal || m.ai_audit_result?.targetKcal) && (() => {
                      const mode = m.prescription_mode || (m.ai_audit_result ? "ia" : "matematico");
                      const kcal = m.prescribed_macros?.targetKcal || m.ai_audit_result?.targetKcal;
                      const label = m.prescribed_macros?.modeLabel || (mode === "ia" ? "Auditado IA" : mode === "manual" ? "Manual" : "Matemático");
                      return (
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap border ${
                          mode === "ia"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : mode === "manual"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {mode === "ia" ? (
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                          ) : mode === "manual" ? (
                            <Edit2 className="w-3 h-3 text-amber-600" />
                          ) : (
                            <Calculator className="w-3 h-3 text-blue-600" />
                          )}
                          <span>{kcal} kcal ({label})</span>
                        </span>
                      );
                    })()}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 mb-0" style={{marginBottom:m.notas?12:0}}>
                  {DISPLAY_KEYS.filter(f=>m[f.key]!==null&&m[f.key]!==undefined&&m[f.key]!=="").map(f=>{
                    const d = (!isFreemium && prev) ? delta(m,prev,f.key) : null;
                    return (
                      <div key={f.key} className="bg-gray-50 rounded-[10px] p-2.5 border border-[#E2E8F0] text-center">
                        <div className="text-[11px] text-[#6B7A8D] mb-1 flex items-center justify-center gap-1">{f.icon} {f.label}</div>
                        <div className="text-lg font-bold text-[#0B1929] font-['Rajdhani']">
                          {m[f.key]}{f.unit&&<span className="text-[11px] font-normal text-[#6B7A8D]"> {f.unit}</span>}
                        </div>
                        {d!==null&&(
                          <div className={`text-[11px] mt-0.5 font-bold flex items-center justify-center gap-0.5 ${d<0?"text-green-500":"text-red-500"}`}>
                            {d>0?<ArrowUp className="w-3 h-3" />:<ArrowDown className="w-3 h-3" />} {Math.abs(d).toFixed(1)}{f.unit}
                          </div>
                        )}
                        {isFreemium && idx===0 && prev && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openPaywall("metricas"); }}
                            className="text-[10px] mt-0.5 text-amber-600 hover:text-amber-700 font-bold flex items-center justify-center gap-1 cursor-pointer mx-auto transition-colors"
                          >
                            <Sparkles className="w-3 h-3 text-amber-500" /> Premium
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Check-in de Seguimiento registrado con esta evaluación */}
                {Boolean(m.checkin_energia || m.checkin_saciedad || m.checkin_digestion || m.checkin_descanso || m.nivel_estres || m.checkin_observaciones || m.checkin_ajustes) && (
                  <div className="mt-2.5 bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-100 rounded-xl p-2.5 sm:p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#0B1929] text-xs">
                      <Activity className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                      <span>Check-in de Seguimiento</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] sm:text-[11px]">
                        {m.checkin_energia && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[var(--brand-primary)] font-bold">
                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Energía {m.checkin_energia}/5
                          </span>
                        )}
                        {m.checkin_saciedad && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700 font-bold">
                            <Utensils className="w-3 h-3 text-emerald-600" /> Saciedad {m.checkin_saciedad}/5
                          </span>
                        )}
                        {m.checkin_digestion && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-700 font-bold">
                            <Stethoscope className="w-3 h-3 text-purple-600" /> Digestión {m.checkin_digestion}/5
                          </span>
                        )}
                        {m.checkin_descanso && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-700 font-bold">
                            <Moon className="w-3 h-3 text-indigo-500" /> Sueño {m.checkin_descanso}/5
                          </span>
                        )}
                        {m.nivel_estres && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white font-bold border ${
                            Number(m.nivel_estres) >= 4
                              ? "border-rose-200 text-rose-700"
                              : Number(m.nivel_estres) === 3
                              ? "border-amber-200 text-amber-700"
                              : "border-blue-200 text-[var(--brand-primary)]"
                          }`}>
                            <AlertCircle className={`w-3 h-3 ${Number(m.nivel_estres) >= 4 ? "text-rose-500" : Number(m.nivel_estres) === 3 ? "text-amber-500" : "text-blue-500"}`} /> Estrés {m.nivel_estres}/5
                          </span>
                        )}
                      </div>
                    {m.checkin_observaciones && (
                      <p className="text-[#0B1929] text-xs">
                        <span className="font-bold text-[#6B7A8D]">Sensaciones: </span>
                        {m.checkin_observaciones}
                      </p>
                    )}
                    {m.checkin_ajustes && (
                      <p className="text-[var(--brand-primary)] text-xs font-semibold">
                        <span className="font-bold text-[#6B7A8D]">Ajustes de menú solicitados: </span>
                        {m.checkin_ajustes}
                      </p>
                    )}
                  </div>
                )}

                {/* Estilo de Vida y Preferencias de la Etapa */}
                {Boolean(m.horas_sueno || m.consumo_agua_estimado || m.preferencias_alimentos || m.aversiones_alimentos || m.r24h_desayuno || m.r24h_comida || m.r24h_cena) && (
                  <div className="mt-3 bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-[#0B1929] flex items-center gap-1.5 text-xs">
                        <Utensils className="w-3.5 h-3.5 text-emerald-600" /> Preferencias y Hábitos de la Etapa
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        {m.horas_sueno && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[#0B1929]">
                            <Clock className="w-3 h-3 text-[var(--brand-primary)]" /> {m.horas_sueno}h sueño
                          </span>
                        )}
                        {m.consumo_agua_estimado && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[#0B1929]">
                            <Droplets className="w-3 h-3 text-blue-500" /> {m.consumo_agua_estimado}
                          </span>
                        )}
                      </div>
                    </div>

                    {m.preferencias_alimentos && (
                      <p className="text-emerald-900 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <span className="font-bold text-emerald-800">Alimentos favoritos: </span>
                        {m.preferencias_alimentos}
                      </p>
                    )}
                    {m.aversiones_alimentos && (
                      <p className="text-rose-900 bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                        <span className="font-bold text-rose-800">Alimentos que rechaza: </span>
                        {m.aversiones_alimentos}
                      </p>
                    )}
                    {Boolean(m.r24h_desayuno || m.r24h_comida || m.r24h_cena) && (
                      <div className="text-[11px] text-[#6B7A8D] bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-bold text-[#0B1929] block mb-0.5">R24H Previo:</span>
                        {[
                          m.r24h_desayuno && `Desayuno: ${m.r24h_desayuno}`,
                          m.r24h_colacion_m && `Col. Matutina: ${m.r24h_colacion_m}`,
                          m.r24h_comida && `Comida: ${m.r24h_comida}`,
                          m.r24h_colacion_v && `Col. Vespertina: ${m.r24h_colacion_v}`,
                          m.r24h_cena && `Cena: ${m.r24h_cena}`,
                          m.r24h_picoteos && `Picoteos: ${m.r24h_picoteos}`,
                        ].filter(Boolean).join(" • ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Criterio y Auditoría de IA registrada */}
                {Boolean(m.prescription_mode === "ia" && m.ai_audit_result) && (
                  <div className="mt-3 bg-gradient-to-r from-indigo-50/70 to-blue-50/40 border border-indigo-100 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Prescripción Auditada por IA ({m.ai_audit_result.targetKcal} kcal)
                      </span>
                      {m.ai_audit_result.badgeMotivo && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200/60">
                          {m.ai_audit_result.badgeMotivo}
                        </span>
                      )}
                    </div>
                    {m.ai_audit_result.analisisClinico && (
                      <p className="text-[#334155] text-[11px] leading-relaxed">
                        <span className="font-bold text-[#0B1929]">Criterio clínico: </span>
                        {m.ai_audit_result.analisisClinico}
                      </p>
                    )}
                    {m.ai_audit_result.estrategiaMenu && (
                      <p className="text-indigo-900 text-[11px] font-medium">
                        <span className="font-bold text-[#0B1929]">Estrategia: </span>
                        {m.ai_audit_result.estrategiaMenu}
                      </p>
                    )}
                  </div>
                )}

                {m.eval_faf_notas && (
                  <div className="text-xs text-[#0B1929] bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/70 mt-2.5 flex items-start gap-1.5">
                    <Flame className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                    <div>
                      <span className="font-bold text-amber-800">Notas de actividad física: </span>
                      <span>{m.eval_faf_notas}</span>
                    </div>
                  </div>
                )}

                {m.notas&&<div className="text-xs text-[#6B7A8D] bg-gray-50 p-2.5 rounded-lg border border-[#E2E8F0] mt-2.5 flex items-start gap-1.5">
                  <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {m.notas}
                </div>}
                {/* Fotos de progreso */}
                {parseFotos(m.fotos).length>0&&(
                  <div className="mt-3">
                    <div className="text-[11px] text-[#6B7A8D] font-bold mb-2 uppercase tracking-[0.5px] flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" /> Fotos ({parseFotos(m.fotos).length})
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {parseFotos(m.fotos).map((url,fi)=>(
                        <div key={fi} className="relative w-20 h-20">
                          <img src={url} onClick={()=>setLightbox(url)}
                            className="w-20 h-20 object-cover rounded-[10px] cursor-zoom-in border-2 border-[#E2E8F0]"
                            alt={`foto ${fi+1}`}/>
                          {!isReadOnly && (
                            <button onClick={()=>deleteFoto(m,url)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-[18px] h-[18px] text-[11px] leading-[18px] text-center cursor-pointer border-none font-bold">×</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── RUTINAS DEL CLIENTE ── */}
      {activeSection === "rutinas" && (
        <div>
          {/* Barra de opciones de Tracking: selector de ciclo + selector de unidad KG / LB */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            {!cicloActivo && ciclos.length > 0 ? (
              <div>
                <div className="text-[11px] text-[#6B7A8D] font-bold uppercase tracking-[0.8px] mb-2">Ciclo</div>
                <div className="flex gap-1.5 flex-wrap">
                  {ciclos.map(c => (
                    <button key={c.id} onClick={async () => { setCicloSel(c); await loadRutinas(c); }} className={`px-3 py-1.5 rounded-lg text-[13px] border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      cicloSel?.id===c.id 
                        ? (c.activo ?"bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] font-bold shadow-md" :"bg-gray-100 text-[#0B1929] border-gray-300 font-bold") 
                        :"bg-transparent text-[#6B7A8D] border-[#E2E8F0] font-medium hover:bg-gray-50"
                    }`}>
                      {c.nombre.split("|")[0]}
                      {c.activo && <span className={`inline-block w-1.5 h-1.5 rounded-full ${cicloSel?.id===c.id ?"bg-white" :"bg-green-400"}`}/>}
                    </button>
                  ))}
                </div>
              </div>
            ) : <div />}

            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E2E8F0] shadow-2xs ml-auto">
              <span className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider px-2">Unidad:</span>
              <button
                type="button"
                onClick={() => handleToggleTrackingUnit("kg")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  trackingWeightUnit === "kg"
                    ? "bg-[var(--brand-primary)] text-white shadow-xs"
                    : "text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-50"
                }`}
              >
                KG
              </button>
              <button
                type="button"
                onClick={() => handleToggleTrackingUnit("lb")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  trackingWeightUnit === "lb"
                    ? "bg-[var(--brand-primary)] text-white shadow-xs"
                    : "text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-50"
                }`}
              >
                LB
              </button>
            </div>
          </div>
          {rutinas.length===0?(
            <div className="text-center py-16 text-[#6B7A8D]">
              <div className="flex justify-center mb-3 text-[#E2E8F0]"><Dumbbell className="w-12 h-12" /></div>
              <div className="text-[15px] font-bold text-[#0B1929] mb-1.5">Sin rutinas asignadas</div>
            </div>
          ):rutinas.map(r=>{
            const semanas = getSemanasConFecha(r, cicloSel);
            const numSemanas = Math.max(1, semanas.length);
            const metricColPercent = (62 / (numSemanas * 2)).toFixed(2);
            const tableMinPx = Math.max(740, 240 + 50 + (numSemanas * 2 * 56));
            const tieneData = r.ejercicios.some(ej => Object.keys(progreso).some(key => key.startsWith(`${ej.id}-`)));
            return (
              <div key={r.id} className="mb-6">
                <div className="font-bold text-[15px] mb-2.5 text-[var(--brand-primary)] flex items-center gap-2">
                  <Dumbbell className="w-4 h-4" /> {r.nombre}
                  {!tieneData&&<span className="text-[11px] text-[#6B7A8D] font-normal">Sin registros aún</span>}
                </div>
                {tieneData&&(
                  <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] shadow-sm">
                    <table 
                      className="border-collapse text-[11px] w-full min-w-full bg-white table-fixed" 
                      style={{ minWidth: `${tableMinPx}px` }}
                    >
                      <colgroup>
                        <col style={{ width: "32%" }} />
                        <col style={{ width: "6%" }} />
                        {semanas.map((_, i) => (
                          <Fragment key={`col-grp-${i}`}>
                            <col style={{ width: `${metricColPercent}%` }} />
                            <col style={{ width: `${metricColPercent}%` }} />
                          </Fragment>
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          <th 
                            rowSpan={2} 
                            style={{ width: "32%" }}
                            className="sticky left-0 z-30 bg-gray-50 text-[#0B1929] px-3 py-2 border border-[#E2E8F0] text-left font-bold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] w-[32%]"
                          >
                            Ejercicio
                          </th>
                          <th 
                            rowSpan={2} 
                            style={{ width: "6%" }}
                            className="bg-gray-50 text-[#0B1929] px-2 py-2 border border-[#E2E8F0] text-center font-bold w-[6%]"
                          >
                            Serie
                          </th>
                          {semanas.map((s,i)=>(
                            <th 
                              key={i} 
                              colSpan={2} 
                              style={{ width: `${(parseFloat(metricColPercent) * 2).toFixed(2)}%` }}
                              className="bg-gray-50 text-[var(--brand-primary)] px-1 py-1.5 border border-[#E2E8F0] text-center text-[10px] font-bold whitespace-nowrap"
                            >
                              {s.label}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {semanas.map((_,i)=>(
                            <Fragment key={`h${i}`}>
                              <th 
                                key={`p${i}`} 
                                style={{ width: `${metricColPercent}%` }}
                                className="bg-gray-50/70 text-[#6B7A8D] px-1.5 py-1 border border-[#E2E8F0] text-center text-[10px] font-semibold"
                              >
                                Peso ({trackingWeightUnit})
                              </th>
                              <th 
                                key={`r${i}`} 
                                style={{ width: `${metricColPercent}%` }}
                                className="bg-gray-50/70 text-[#6B7A8D] px-1.5 py-1 border border-[#E2E8F0] text-center text-[10px] font-semibold"
                              >
                                Reps
                              </th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.ejercicios.map((ej, eji) => {
                          const variantsWithData = new Set(["original"]);
                          for (const key in progreso) {
                            if (key.startsWith(`${ej.id}-`)) {
                              const match = key.match(/-(?:peso|reps)-(.+)$/);
                              if (match && match[1]) {
                                variantsWithData.add(match[1]);
                              }
                            }
                          }
                          const activeVariants = Array.from(variantsWithData).sort();

                          return activeVariants.map((vid) => {
                            const isOriginal = vid ==="original";
                            const altIdx = isOriginal ? -1 : parseInt(vid.replace("alt_",""));
                            const exObj = isOriginal ? ej : (ej.alternativas || [])[altIdx] || ej;
                            
                            const rowBg = eji % 2 === 0 ?"bg-white" :"bg-gray-50/30";
                            const highlight = !isOriginal ?"bg-[var(--brand-primary)]/5" : rowBg;

                            return Array.from({length: exObj.num_series || ej.num_series || 4}, (_, si) => (
                              <tr key={`${ej.id}-${vid}-${si}`} className={highlight}>
                                {si === 0 && (
                                  <td 
                                    rowSpan={exObj.num_series || ej.num_series || 4} 
                                    style={{ width: "32%" }}
                                    className={`px-3 py-2 border border-[#E2E8F0] font-bold align-middle sticky left-0 z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] w-[32%] ${
                                      !isOriginal ? "bg-[#f0f9ff]" : (eji % 2 === 0 ? "bg-white" : "bg-[#F8FAFC]")
                                    }`}
                                  >
                                    <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                                      <span className="text-[#0B1929] leading-tight break-words">{exObj.nombre}</span>
                                      {!isOriginal && <span className="text-[9px] bg-[var(--brand-primary)] text-white px-1 py-0.5 rounded font-bold shrink-0">ALT</span>}
                                    </div>
                                    <div className="text-[10px] text-[#6B7A8D] font-normal mt-0.5 truncate">{GRUPO_LABELS[normalizeMuscleGroup(exObj.grupo_muscular || ej.grupo_muscular)] || exObj.grupo_muscular || ej.grupo_muscular}</div>
                                  </td>
                                )}
                                <td className="px-2 py-1.5 border border-[#E2E8F0] text-center text-[var(--brand-primary)] font-bold font-['Rajdhani']">{si+1}</td>
                                {semanas.map((_, wi) => {
                                  const pVal = progreso[`${ej.id}-${wi}-${si}-peso-${vid}`] ||"";
                                  const rVal = progreso[`${ej.id}-${wi}-${si}-reps-${vid}`] ||"";
                                  
                                  let emptyText ="—";
                                  let emptyColorClass ="text-[#CBD5E1]";
                                  let emptyWeightClass ="font-normal";
                                  
                                  if (!pVal && !rVal) {
                                    const otherVariantHasData = activeVariants.some(otherVid => 
                                      otherVid !== vid && (progreso[`${ej.id}-${wi}-${si}-peso-${otherVid}`] || progreso[`${ej.id}-${wi}-${si}-reps-${otherVid}`])
                                    );
                                    if (otherVariantHasData) {
                                      emptyText = isOriginal ?"ALT" :"ORG";
                                      emptyColorClass ="text-[#6B7A8D]";
                                      emptyWeightClass ="font-bold";
                                    }
                                  }

                                  return (
                                    <Fragment key={`w${wi}`}>
                                      <td key={`p${wi}`} className={`px-1 py-1.5 border border-[#E2E8F0] text-center ${pVal ?"bg-[var(--brand-primary)]/10" :""}`}>
                                        <span className={`text-[11px] ${pVal ?"text-[var(--brand-primary)] font-bold" : `${emptyColorClass} ${emptyWeightClass}`}`}>{pVal ? formatTrackingWeight(pVal, trackingWeightUnit) : emptyText}</span>
                                      </td>
                                      <td key={`r${wi}`} className={`px-1 py-1.5 border border-[#E2E8F0] text-center ${rVal ?"bg-[var(--brand-primary)]/5" :""}`}>
                                        <span className={`text-[11px] ${rVal ?"text-[#3B82F6] font-bold" : `${emptyColorClass} ${emptyWeightClass}`}`}>{rVal||emptyText}</span>
                                      </td>
                                    </Fragment>
                                  );
                                })}
                              </tr>
                            ));
                          });
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── NUTRICIÓN Y AGUA DEL CLIENTE ── */}
      {activeSection === "nutricion" && (
        <div>
          {/* Cycle selector */}
          {!cicloActivo && ciclos.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] text-[#6B7A8D] font-bold uppercase tracking-[0.8px] mb-2">Ciclo</div>
              <div className="flex gap-1.5 flex-wrap">
                {ciclos.map(c => (
                  <button key={c.id} onClick={async () => { setCicloSel(c); setSelectedNutriWeek(null); await loadRutinas(c); }} className={`px-3 py-1.5 rounded-lg text-[13px] border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    cicloSel?.id===c.id 
                      ? (c.activo ?"bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] font-bold shadow-md" :"bg-gray-100 text-[#0B1929] border-gray-300 font-bold") 
                      :"bg-transparent text-[#6B7A8D] border-[#E2E8F0] font-medium hover:bg-gray-50"
                  }`}>
                    {c.nombre.split("|")[0]}
                    {c.activo && <span className={`inline-block w-1.5 h-1.5 rounded-full ${cicloSel?.id===c.id ?"bg-white" :"bg-green-400"}`}/>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nutriDias.length === 0 ? (
            <div className="text-center py-16 text-[#6B7A8D]">
              <div className="flex justify-center mb-3 text-[#E2E8F0]"><UtensilsCrossed className="w-12 h-12" /></div>
              <div className="text-[15px] font-bold text-[#0B1929] mb-1.5">Sin dieta asignada</div>
            </div>
          ) : (() => {
            const semanasNutri = getSemanasConFecha(rutinas[0] || null, cicloSel);
            const currentWeekIndex = semanasNutri.findIndex(s => s.isCurrent);
            const hasCurrent = currentWeekIndex !== -1;
            const currentWeekObj = hasCurrent ? semanasNutri[currentWeekIndex] : (semanasNutri[0] || null);
            const currentWeekNum = currentWeekObj?.weekNum || 1;

            // Filtrar semanas futuras: solo semanas hasta la actual
            const validWeeks = hasCurrent 
              ? semanasNutri.filter(s => s.weekNum <= currentWeekNum)
              : (semanasNutri.length > 0 ? semanasNutri : [{ weekNum: 1, label: "Semana 1", isCurrent: true }]);

            return (
              <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] shadow-none md:shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E2E8F0] bg-gray-50/60 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                      Historial Comparativo por Semana del Ciclo
                    </span>
                    <span className="block text-[11px] text-[#6B7A8D] mt-0.5">
                      Plan de {nutriDias.length} {nutriDias.length === 1 ? "día" : "días"} por semana · Comidas cumplidas · Agua registrada
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="border-collapse text-[11px] min-w-full bg-white">
                    <thead>
                      <tr>
                        <th className="bg-gray-50 text-[#0B1929] px-3 py-2.5 border-b border-r border-[#E2E8F0] text-left min-w-[130px]">
                          Día del Plan
                        </th>
                        {validWeeks.map(s => (
                          <th
                            key={s.weekNum}
                            className={`px-3 py-2 border-b border-r border-[#E2E8F0] text-center whitespace-nowrap ${
                              s.isCurrent
                                ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-extrabold"
                                : "bg-gray-50 text-[#0B1929] font-bold"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span>{s.label}</span>
                              {s.isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[var(--brand-primary)] text-white font-extrabold uppercase">
                                  Actual
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {nutriDias.map((d, idx) => {
                        const totalC = (d.comidas || []).length;
                        return (
                          <tr key={d.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}>
                            <td className="px-3 py-2.5 border-b border-r border-[#E2E8F0] font-bold text-[#0B1929]">
                              {d.nombre || d.dia_semana || `Día ${idx + 1}`}
                            </td>
                            {validWeeks.map(s => {
                              const r = nutriProgreso[`${d.id}-${s.weekNum}`];
                              const agua = Number(r?.agua_ml) || 0;
                              const doneMap = (r && typeof r.comidas_done === "object" && r.comidas_done !== null) ? r.comidas_done : {};
                              let doneCount = (d.comidas || []).filter((c, ci) => Boolean(
                                (c.id && doneMap[c.id]) ||
                                doneMap[ci] ||
                                doneMap[String(ci)] ||
                                (c.orden != null && doneMap[c.orden])
                              )).length;
                              if (doneCount === 0 && Number(r?.comidas_realizadas) > 0) {
                                doneCount = Math.min(Number(r.comidas_realizadas), totalC);
                              }
                              const hasAny = agua > 0 || doneCount > 0;
                              return (
                                <td
                                  key={s.weekNum}
                                  className={`px-2 py-2 border-b border-r border-[#E2E8F0] text-center ${
                                    s.isCurrent ? "bg-[var(--brand-primary)]/5" : ""
                                  }`}
                                >
                                  {hasAny ? (
                                    <div className="flex flex-col items-center gap-0.5 leading-tight">
                                      <span className="font-bold text-emerald-600">{doneCount}/{totalC} com.</span>
                                      <span className="text-[10px] font-semibold text-sky-600">{(agua / 1000).toFixed(2)} L</span>
                                    </div>
                                  ) : (
                                    <span className="text-[#CBD5E1]">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold">
                        <td className="px-3 py-2.5 border-t-2 border-b border-r border-[#E2E8F0] text-[#0B1929]">
                          Total Semanal
                        </td>
                        {validWeeks.map(s => {
                          let semComidas = 0;
                          let semTotalComidas = 0;
                          let semAgua = 0;
                          nutriDias.forEach(d => {
                            const r = nutriProgreso[`${d.id}-${s.weekNum}`];
                            const totalC = (d.comidas || []).length;
                            semTotalComidas += totalC;
                            const doneMap = (r && typeof r.comidas_done === "object" && r.comidas_done !== null) ? r.comidas_done : {};
                            let doneCount = (d.comidas || []).filter((c, ci) => Boolean(
                              (c.id && doneMap[c.id]) ||
                              doneMap[ci] ||
                              doneMap[String(ci)] ||
                              (c.orden != null && doneMap[c.orden])
                            )).length;
                            if (doneCount === 0 && Number(r?.comidas_realizadas) > 0) {
                              doneCount = Math.min(Number(r.comidas_realizadas), totalC);
                            }
                            semComidas += doneCount;
                            semAgua += Number(r?.agua_ml) || 0;
                          });
                          const hasData = semComidas > 0 || semAgua > 0;
                          const promAgua = nutriDias.length > 0 ? (semAgua / (nutriDias.length * 1000)).toFixed(2) : "0.00";
                          return (
                            <td
                              key={s.weekNum}
                              className={`px-2 py-2 border-t-2 border-b border-r border-[#E2E8F0] text-center ${
                                s.isCurrent ? "bg-[var(--brand-primary)]/5" : ""
                              }`}
                            >
                              {hasData ? (
                                <div className="flex flex-col items-center gap-0.5 leading-tight">
                                  <span className="font-extrabold text-emerald-700">{semComidas}/{semTotalComidas} com.</span>
                                  <span className="text-[10px] font-bold text-sky-700">{promAgua} L/día prom.</span>
                                </div>
                              ) : (
                                <span className="text-[#CBD5E1]">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── EDITOR DE EVALUACIÓN CORPORAL A PANTALLA COMPLETA (Master-Detail) ── */}
      {showModal && (() => {
        const isPlicometria = ["plicometria_jp3", "plicometria_dw4", "manual", "plicometria_isak"].includes(form.metodo_evaluacion);
        const effectiveMethod = isCivil
          ? (form.metodo_evaluacion === "inbody" ? "inbody" : "basico")
          : form.metodo_evaluacion;
        const activeGroups = getGroupsForMethod(effectiveMethod, evalSexo);
        const hasLiveCalc = Boolean(
          liveCalculations.imc ||
          liveCalculations.grasa_pct ||
          form.grasa_pct ||
          liveCalculations.icc ||
          liveCalculations.masa_libre_grasa ||
          liveCalculations.calc_masa_muscular
        );

        return (
          <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col overflow-y-auto animate-in fade-in duration-150">
            {/* Top Sticky Header */}
            <div className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] shadow-2xs modal-safe-sticky-top">
              <div className="px-4 md:px-8 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6B7A8D] hover:text-[#0B1929] transition-colors py-1.5 px-2.5 sm:px-3 rounded-xl hover:bg-gray-100 shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver</span>
                  </button>
                  <span className="text-[#CBD5E1] hidden sm:inline">|</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm sm:text-base font-bold text-[#0B1929] truncate">
                      {isReadOnly ? "Consultar Evaluación Corporal" : editingId ? "Editar Evaluación Corporal" : "Nueva Evaluación Corporal"}
                    </h2>
                    <div className="text-[11px] text-[#6B7A8D] hidden sm:block truncate">
                      {selected?.nombre} • {getMetodoLabel(form.metodo_evaluacion)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={saveMetrica}
                      disabled={saving}
                      className="w-9 h-9 sm:w-auto px-0 sm:px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      title={saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar evaluación"}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <Save className="w-4 h-4 shrink-0" />
                      )}
                      <span className="hidden sm:inline">
                        {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar evaluación"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {isReadOnly && (
                <div className="bg-amber-50/90 border-t border-amber-200 px-4 md:px-8 py-2 text-xs text-amber-800 flex items-center gap-2 font-medium">
                  <Eye className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Modo consulta: Esta evaluación está vinculada a un plan anterior o histórico y se muestra en modo solo lectura.</span>
                </div>
              )}

              {/* Mobile Live Indicators Strip (< lg) */}
              {hasLiveCalc && (
                <div className="lg:hidden bg-[#F0F4FA]/90 border-t border-[#E2E8F0] px-4 py-2 flex items-center gap-3 overflow-x-auto scroll-hide text-xs">
                  <span className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider shrink-0">Cálculo en vivo:</span>
                  {liveCalculations.imc && (
                    <span className="font-bold text-[#0B1929] shrink-0">IMC <strong className="text-[var(--brand-primary)]">{liveCalculations.imc}</strong></span>
                  )}
                  {(liveCalculations.grasa_pct || form.grasa_pct) && (
                    <span className="font-bold text-[#0B1929] shrink-0">Grasa <strong className="text-[var(--brand-primary)]">{liveCalculations.grasa_pct || form.grasa_pct}%</strong></span>
                  )}
                  {liveCalculations.masa_libre_grasa && (
                    <span className="font-bold text-emerald-700 shrink-0">MLG {liveCalculations.masa_libre_grasa}kg</span>
                  )}
                  {liveCalculations.calc_masa_muscular && (
                    <span className="font-bold text-[#0B1929] shrink-0">Músculo {liveCalculations.calc_masa_muscular}kg</span>
                  )}
                  {liveCalculations.icc && (
                    <span className="font-bold text-[#0B1929] shrink-0">ICC {liveCalculations.icc}</span>
                  )}
                </div>
              )}
            </div>

            {/* Main Responsive Grid Container */}
            <div className="max-w-7xl w-full mx-auto px-0 py-2 pb-28 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6">
              {/* Left Column: Protocol & Anthropometric Fields */}
              <div className="lg:col-span-8 flex flex-col gap-5">
                {/* Paso 1: Check-in de Seguimiento */}
                {/* Paso 1: Check-in de Seguimiento */}
                <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-blue-100 p-4 sm:p-6 shadow-none md:shadow-sm relative overflow-hidden space-y-5">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--brand-primary)] to-blue-400" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--brand-primary)] uppercase tracking-wider">
                            Paso 1
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                            Check-in de Seguimiento
                          </h3>
                        </div>
                        <p className="text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Registra las sensaciones y hábitos del paciente basado en su experiencia reciente (o su día a día habitual si es consulta inicial). Pondera del 1 (lo menor o más desfavorable) al 5 (lo mayor u óptimo).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Panel Unificado de Ponderación (5 Escalas) */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl divide-y divide-[#E2E8F0] overflow-hidden">
                    {[
                      {
                        key: "checkin_energia",
                        label: "Energía diaria",
                        icon: <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />,
                        badgeColor: "bg-amber-50 text-amber-700 border-amber-200/80",
                        minHelp: "Fatiga o baja energía",
                        maxHelp: "Energía plena y constante",
                        labels: { 1: "Muy baja", 2: "Baja", 3: "Moderada", 4: "Buena", 5: "Óptima" },
                      },
                      {
                        key: "checkin_saciedad",
                        label: "Control de saciedad",
                        icon: <Utensils className="w-4 h-4 text-emerald-600" />,
                        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
                        minHelp: "Mucha hambre o ansiedad",
                        maxHelp: "Apetito bien saciado y controlado",
                        labels: { 1: "Mucha hambre", 2: "Ansiedad", 3: "Aceptable", 4: "Controlada", 5: "Excelente" },
                      },
                      {
                        key: "checkin_digestion",
                        label: "Digestión y confort estomacal",
                        icon: <Stethoscope className="w-4 h-4 text-purple-600" />,
                        badgeColor: "bg-purple-50 text-purple-700 border-purple-200/80",
                        minHelp: "Malestares o inflamación",
                        maxHelp: "Digestión ligera y sin pesadez",
                        labels: { 1: "Inflamado", 2: "Pesadez", 3: "Normal", 4: "Muy buena", 5: "Óptima" },
                      },
                      {
                        key: "checkin_descanso",
                        label: "Calidad de sueño",
                        icon: <Moon className="w-4 h-4 text-indigo-500" />,
                        badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
                        minHelp: "Insomnio o sueño interrumpido",
                        maxHelp: "Sueño profundo y reparador",
                        labels: { 1: "Deficiente", 2: "Interrumpido", 3: "Regular", 4: "Reparador", 5: "Profundo" },
                      },
                      {
                        key: "nivel_estres",
                        label: "Nivel de estrés",
                        icon: <Activity className="w-4 h-4 text-rose-500" />,
                        badgeColor: "bg-rose-50 text-rose-700 border-rose-200/80",
                        minHelp: "Mínimo / Muy relajado",
                        maxHelp: "Muy elevado / Severo",
                        labels: { 1: "Mínimo", 2: "Leve", 3: "Moderado", 4: "Alto", 5: "Severo" },
                      },
                    ].map((sc) => {
                      const currentVal = Number(form[sc.key] || (sc.key === "nivel_estres" ? 3 : 4));
                      const statusLabel = sc.labels[currentVal] || `${currentVal}/5`;
                      return (
                        <div
                          key={sc.key}
                          className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-white/70 transition-colors"
                        >
                          {/* Izquierda: Icono + Título + Badge de estado + Leyenda descriptiva */}
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs flex items-center justify-center shrink-0">
                              {sc.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-[#0B1929]">
                                  {sc.label}
                                </span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${sc.badgeColor}`}>
                                  {currentVal}/5 · {statusLabel}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#6B7A8D] mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="text-gray-400 font-medium">Escala:</span>
                                <span className="font-medium text-gray-600">1 = {sc.minHelp}</span>
                                <span className="text-gray-300">|</span>
                                <span className="font-medium text-gray-600">5 = {sc.maxHelp}</span>
                              </p>
                            </div>
                          </div>

                          {/* Derecha: Selector de 5 botones (1 al 5) */}
                          <div className="flex items-center gap-1 self-stretch md:self-auto justify-end shrink-0 bg-white p-1 rounded-xl border border-[#E2E8F0] shadow-2xs">
                            {[1, 2, 3, 4, 5].map((n) => {
                              const isSel = currentVal === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => !isReadOnly && updForm(sc.key, String(n))}
                                  className={`flex-1 md:flex-none w-9 h-8 sm:w-10 sm:h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                                    isReadOnly ? "cursor-default" : "cursor-pointer"
                                  } ${
                                    isSel
                                      ? "bg-[var(--brand-primary)] text-white shadow-xs font-extrabold scale-102"
                                      : "text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100/70"
                                  }`}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hábitos de Sueño, Agua y Actividad Física (2x2 Grid) */}
                  <div className="pt-2 border-t border-blue-100/80 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[var(--brand-primary)]" />
                      <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                        Estilo de Vida y Hábitos del Paciente
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Horas de Sueño */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                        <label className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                          <Moon className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Horas de sueño promedio</span>
                        </label>
                        <p className="text-[11px] text-[#6B7A8D]">
                          Promedio de descanso por noche.
                        </p>
                        <input
                          type="number"
                          step="0.5"
                          readOnly={isReadOnly}
                          value={form.horas_sueno || ""}
                          onChange={(e) => !isReadOnly && updForm("horas_sueno", e.target.value)}
                          placeholder="Ej. 7.5 hrs"
                          className={`w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#0B1929] shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)]"}`}
                        />
                      </div>

                      {/* Consumo de Agua */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                        <label className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-blue-500" />
                          <span>Consumo de agua estimado</span>
                        </label>
                        <p className="text-[11px] text-[#6B7A8D]">
                          Líquidos / agua natural promedio al día.
                        </p>
                        <input
                          type="text"
                          readOnly={isReadOnly}
                          value={form.consumo_agua_estimado || ""}
                          onChange={(e) => !isReadOnly && updForm("consumo_agua_estimado", e.target.value)}
                          placeholder="Ej. 2 a 2.5 L al día"
                          className={`w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#0B1929] shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)]"}`}
                        />
                      </div>

                      {/* Días de Ejercicio Actuales */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                        <label className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                          <Dumbbell className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Días de ejercicio actuales</span>
                        </label>
                        <p className="text-[11px] text-[#6B7A8D]">
                          Frecuencia semanal de entrenamiento (0 a 7 días).
                        </p>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          readOnly={isReadOnly}
                          value={form.dias_ejercicio_actual || ""}
                          onChange={(e) => !isReadOnly && updForm("dias_ejercicio_actual", e.target.value)}
                          placeholder="Ej. 3 o 4 días por semana"
                          className={`w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#0B1929] shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)]"}`}
                        />
                      </div>

                      {/* Horario Disponible para Entrenar */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                        <label className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Horario habitual de entreno</span>
                        </label>
                        <p className="text-[11px] text-[#6B7A8D]">
                          Momento del día en el que suele entrenar.
                        </p>
                        <input
                          type="text"
                          readOnly={isReadOnly}
                          value={form.horario_ejercicio || ""}
                          onChange={(e) => !isReadOnly && updForm("horario_ejercicio", e.target.value)}
                          placeholder="Ej. Mañanas (7:00 AM), Tardes (6:00 PM)..."
                          className={`w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#0B1929] shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)]"}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sensaciones y Adherencia del Ciclo (Solo para segundas evaluaciones en adelante) */}
                  {!isFirstEvaluationEver && (
                    <div className="pt-2 border-t border-blue-100/80 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[var(--brand-primary)]" />
                          <span>Sensaciones y adherencia del ciclo previo</span>
                        </label>
                        {adherenceSummary?.summaryText && (
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => {
                              if (!isReadOnly) {
                                const current = (form.checkin_observaciones || "").trim();
                                const summary = adherenceSummary.summaryText;
                                updForm(
                                  "checkin_observaciones",
                                  current && !current.includes(summary) ? `${current} | ${summary}` : summary
                                );
                              }
                            }}
                            className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Auto-completar desde app</span>
                          </button>
                        )}
                      </div>

                      {adherenceSummary && (
                        <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs text-blue-900 flex items-center justify-between gap-2 flex-wrap">
                          <span>
                            <strong>Registro en app:</strong> {adherenceSummary.summaryText}
                          </span>
                        </div>
                      )}

                      <textarea
                        rows={2}
                        readOnly={isReadOnly}
                        value={form.checkin_observaciones || ""}
                        onChange={(e) => !isReadOnly && updForm("checkin_observaciones", e.target.value)}
                        placeholder="Ej. Buena energía a lo largo del día, apego al 90%, sin hambre excesiva ni atracones..."
                        className={`w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0B1929] resize-none shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)]"}`}
                      />
                    </div>
                  )}
                </div>

                {/* Paso 2: Preferencias Alimentarias */}
                <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <Utensils className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 uppercase tracking-wider">
                            Paso 2
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                            Preferencias Alimentarias
                          </h3>
                        </div>
                        <p className="text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Anota las preferencias alimentarias del paciente para esta etapa (lo que más le gusta comer y lo que no le gusta o prefiere evitar). Esto corresponde exclusivamente a gustos personales para estructurar el mejor menú posible; las alergias o patologías clínicas ya están resguardadas en su expediente.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Exclusiones Rápidas en 1 Clic (Se conectan en automático con el Catálogo SMAE e Ingredientes) */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5 text-rose-500" />
                        <span>Restricciones Rápidas de Dieta (1 clic · Pre-filtra platillos e ingredientes SMAE):</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DIET_RESTRICTION_TAGS.map((tag) => {
                        const currentAvers = String(form.aversiones_alimentos || "");
                        const isActive = tag.keywords.some((kw) =>
                          currentAvers.toLowerCase().includes(kw.toLowerCase())
                        );
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => {
                              if (isReadOnly) return;
                              if (isActive) {
                                // Remover la etiqueta del texto de aversiones
                                let cleaned = currentAvers;
                                tag.keywords.forEach((kw) => {
                                  const regex = new RegExp(`(?:^|,\\s*|\\s*\\|\\s*)${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi");
                                  cleaned = cleaned.replace(regex, "");
                                });
                                cleaned = cleaned.replace(/^[\s,|]+|[\s,|]+$/g, "").trim();
                                updForm("aversiones_alimentos", cleaned);
                              } else {
                                const next = currentAvers.trim()
                                  ? `${currentAvers.trim()}, ${tag.shortLabel}`
                                  : tag.shortLabel;
                                updForm("aversiones_alimentos", next);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              isActive
                                ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                                : "bg-white text-[#475569] border-[#E2E8F0] hover:border-rose-300 hover:bg-rose-50/40"
                            }`}
                          >
                            <span>{tag.icon}</span>
                            <span>{tag.label}</span>
                            {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Favoritos */}
                    <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-3.5 space-y-2">
                      <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/30" />
                        <span>Alimentos e ingredientes o platillos favoritos</span>
                      </label>
                      <textarea
                        rows={3}
                        readOnly={isReadOnly}
                        value={form.preferencias_alimentos || ""}
                        onChange={(e) => !isReadOnly && updForm("preferencias_alimentos", e.target.value)}
                        placeholder="Ej. Pollo, claras de huevo, arroz basmati, aguacate, plátano, avena..."
                        className={`w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#0B1929] shadow-2xs resize-none ${isReadOnly ? "cursor-default" : "focus:outline-none focus:border-emerald-500"}`}
                      />
                    </div>

                    {/* Aversiones */}
                    <div className="bg-rose-50/40 border border-rose-200/80 rounded-xl p-3.5 space-y-2">
                      <label className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        <span>Alimentos, ingredientes o comidas que prefiero evitar</span>
                      </label>
                      <textarea
                        rows={3}
                        readOnly={isReadOnly}
                        value={form.aversiones_alimentos || ""}
                        onChange={(e) => !isReadOnly && updForm("aversiones_alimentos", e.target.value)}
                        placeholder="Ej. Pescado/mariscos, hígado, brócoli, mayonesa, cebolla cruda..."
                        className={`w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#0B1929] shadow-2xs resize-none ${isReadOnly ? "cursor-default" : "focus:outline-none focus:border-rose-500"}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Paso 3: Alimentación Diaria Habitual (R24H) */}
                <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 uppercase tracking-wider">
                            Paso 3
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                            Alimentación Diaria Habitual (R24H)
                          </h3>
                        </div>
                        <p className="text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Comprende qué suele desayunar, comer y cenar el paciente habitualmente a lo largo del día para adaptar el nuevo plan a sus horarios y rutinas reales.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {[
                      { key: "r24h_desayuno", label: "Desayuno", ph: "Ej. 2 huevos con jamón, 2 tortillas y café" },
                      { key: "r24h_colacion_m", label: "Colación matutina", ph: "Ej. Manzana con almendras o galletas" },
                      { key: "r24h_comida", label: "Comida principal", ph: "Ej. Pechuga de pollo, 1 taza de arroz, ensalada y agua" },
                      { key: "r24h_colacion_v", label: "Colación vespertina", ph: "Ej. Yogur griego con fruta o barrita" },
                      { key: "r24h_cena", label: "Cena", ph: "Ej. 2 quesadillas de panela o cereal con leche" },
                      { key: "r24h_picoteos", label: "Bebidas habituales y picoteos", ph: "Ej. Refresco regular, 2L de agua natural, café, botanas" },
                    ].map((item) => (
                      <div key={item.key}>
                        <label className="block text-[11px] font-bold text-[#0B1929] mb-1">
                          {item.label}
                        </label>
                        <input
                          type="text"
                          readOnly={isReadOnly}
                          value={form[item.key] || ""}
                          onChange={(e) => !isReadOnly && updForm(item.key, e.target.value)}
                          placeholder={item.ph}
                          className={`w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0B1929] ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)]"}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Paso 4: Enfoque u Objetivos del Paciente */}
                <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--brand-primary)] uppercase tracking-wider">
                            Paso 4
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                            Enfoque u Objetivos del Paciente
                          </h3>
                        </div>
                        <p className="text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Parámetros dinámicos exclusivos del plan actual para fijar el programa calórico y de macronutrientes de acuerdo a los objetivos generales del paciente.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Objetivo de la Etapa */}
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-[#6B7A8D] mb-1.5">
                      Objetivo Nutricional de este Ciclo
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {GOAL_PRESETS.map((g) => {
                        const isSelected = (form.eval_objetivo || liveSmartMacros.goalId) === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => !isReadOnly && updForm("eval_objetivo", g.id)}
                            className={`text-left p-2.5 rounded-xl border transition-all ${
                              isReadOnly ? "cursor-default" : "cursor-pointer"
                            } ${
                              isSelected
                                ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)] text-[#0B1929] shadow-2xs"
                                : "bg-[#F8FAFC] border-[#E2E8F0] text-[#6B7A8D] hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold ${isSelected ? "text-[var(--brand-primary)]" : "text-[#0B1929]"}`}>
                                {g.title}
                              </span>
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                isSelected
                                  ? "bg-[var(--brand-primary)] text-white"
                                  : "bg-white border border-[#E2E8F0] text-[#6B7A8D]"
                              }`}>
                                {g.pct > 0 ? `+${g.pct}%` : `${g.pct}%`}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#6B7A8D] mt-0.5 truncate">
                              {g.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Factor de Actividad Física (FAF) Proyectado conectado a Entrenamiento */}
                  <div className="pt-2 border-t border-[#F0F4FA]">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                      <label className="block text-xs font-bold text-[#6B7A8D]">
                        Factor de Actividad Física (FAF) Proyectado
                      </label>
                      {suggestedFafFromTraining.days > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-[var(--brand-primary)] border border-blue-200/60">
                          <Dumbbell className="w-3 h-3" />
                          <span>Calculado de entrenamiento: {suggestedFafFromTraining.label} (FAF {suggestedFafFromTraining.value})</span>
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {ACTIVITY_FACTORS.map((f) => {
                        const currentFafNum = Number(form.eval_faf) || liveSmartMacros.faf;
                        const isSelected = Math.abs(currentFafNum - f.value) < 0.02;
                        return (
                          <button
                            key={f.value}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => !isReadOnly && updForm("eval_faf", String(f.value))}
                            className={`text-left p-2.5 rounded-xl border transition-all ${
                              isReadOnly ? "cursor-default" : "cursor-pointer"
                            } ${
                              isSelected
                                ? "bg-amber-50/90 border-amber-400 text-[#0B1929] shadow-2xs"
                                : "bg-[#F8FAFC] border-[#E2E8F0] text-[#6B7A8D] hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold ${isSelected ? "text-amber-700" : "text-[#0B1929]"}`}>
                                {f.label}
                              </span>
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                isSelected ? "bg-amber-500 text-white" : "bg-white border border-[#E2E8F0] text-[#6B7A8D]"
                              }`}>
                                {f.value}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#6B7A8D] mt-0.5 truncate">
                              {f.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Notas de actividad física y disponibilidad */}
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-[#6B7A8D] mb-1">
                        Notas de actividad física y disponibilidad (opcional)
                      </label>
                      <textarea
                        disabled={isReadOnly}
                        value={form.eval_faf_notas || ""}
                        onChange={(e) => updForm("eval_faf_notas", e.target.value)}
                        placeholder="Ej. Paciente menciona que entrena de lunes a jueves de 5 a 7 pm (4 días), o no tiene tiempo para entrenar entre semana..."
                        rows={2}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0B1929] placeholder-[#94A3B8] focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white resize-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Paso 5: Mediciones Corporales y Antropometría */}
                <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <Ruler className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 uppercase tracking-wider shrink-0">
                            Paso 5
                          </span>

                          {/* En móvil: Fecha y Edad a la derecha de Paso 5 */}
                          <div className="sm:hidden flex items-center gap-1.5 shrink-0">
                            <span
                              className="text-[11px] font-bold text-[#475569] bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg px-2 py-0.5 whitespace-nowrap"
                              title="Edad demográfica"
                            >
                              {evalEdad} {evalEdad === 1 ? "año" : "años"}
                            </span>
                            <input
                              type="date"
                              readOnly={isReadOnly}
                              value={form.fecha}
                              onChange={e => !isReadOnly && updForm("fecha", e.target.value)}
                              className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg px-1.5 py-0.5 text-[11px] font-bold text-[#0B1929] focus:outline-none"
                            />
                          </div>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-[#0B1929] mt-1 sm:mt-0.5">
                          Mediciones Corporales y Antropometría
                        </h3>
                        <p className="text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Selecciona el protocolo de medición (Básico, Plicometría o Bioimpedancia) e ingresa las medidas corporales del paciente.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3.5 pt-1 border-t border-[#F0F4FA]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex bg-[#F0F4FA] rounded-xl p-1 w-full sm:w-auto">
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => !isReadOnly && updForm("metodo_evaluacion", "basico")}
                          className={`flex-1 sm:flex-none px-3.5 py-2 rounded-[10px] text-xs sm:text-[13px] transition-colors font-bold ${isReadOnly ? "cursor-default" : "cursor-pointer"} ${form.metodo_evaluacion === "basico" ? "bg-white shadow-sm text-[#0B1929]" : "text-[#6B7A8D] hover:text-[#0B1929]"}`}
                        >
                          Básico
                        </button>
                        {!isCivil && (
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => {
                              if (!isReadOnly && !isPlicometria) updForm("metodo_evaluacion", "plicometria_jp3");
                            }}
                            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-[10px] text-xs sm:text-[13px] transition-colors font-bold ${isReadOnly ? "cursor-default" : "cursor-pointer"} ${isPlicometria ? "bg-white shadow-sm text-[#0B1929]" : "text-[#6B7A8D] hover:text-[#0B1929]"}`}
                          >
                            Plicometría
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => !isReadOnly && updForm("metodo_evaluacion", "inbody")}
                          className={`flex-1 sm:flex-none px-3.5 py-2 rounded-[10px] text-xs sm:text-[13px] transition-colors font-bold ${isReadOnly ? "cursor-default" : "cursor-pointer"} ${form.metodo_evaluacion === "inbody" ? "bg-white shadow-sm text-[#0B1929]" : "text-[#6B7A8D] hover:text-[#0B1929]"}`}
                        >
                          Bioimpedancia
                        </button>
                      </div>

                      {/* Edad y Fecha (En escritorio se muestran aquí, en móvil ya están a la derecha de Paso 5) */}
                      <div className="hidden sm:flex flex-wrap items-center gap-2">
                        <div
                          className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 select-none"
                          title="Edad demográfica calculada a partir de la fecha de nacimiento del paciente"
                        >
                          <span className="text-xs font-bold text-[#6B7A8D]">Edad</span>
                          <span className="text-xs font-bold text-[#0B1929]">{evalEdad} {evalEdad === 1 ? "año" : "años"}</span>
                        </div>

                        <input
                          type="date"
                          readOnly={isReadOnly}
                          value={form.fecha}
                          onChange={e => !isReadOnly && updForm("fecha", e.target.value)}
                          className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
                        />
                      </div>
                    </div>

                    {/* Sub-selector de Plicometría */}
                    {!isCivil && isPlicometria && (
                      <div className="flex gap-1.5 flex-wrap pt-2 border-t border-[#F0F4FA]">
                        {[
                          { id: "plicometria_jp3", label: "3 Pliegues (Jackson-Pollock)" },
                          { id: "plicometria_dw4", label: "4 Pliegues (Durnin-Womersley)" },
                          { id: "manual", label: "ISAK Completo (4 Componentes + Somatotipo)" },
                        ].map(subP => {
                          const active = form.metodo_evaluacion === subP.id || (subP.id === "manual" && form.metodo_evaluacion === "plicometria_isak");
                          return (
                            <button
                              key={subP.id}
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => !isReadOnly && updForm("metodo_evaluacion", subP.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${isReadOnly ? "cursor-default" : "cursor-pointer"} ${
                                active
                                  ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-2xs"
                                  : "bg-[#F8FAFC] text-[#6B7A8D] border-[#E2E8F0] hover:text-[#0B1929]"
                              }`}
                            >
                              {subP.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lector IA OCR para Bioimpedancia / InBody */}
                {form.metodo_evaluacion === "inbody" && (
                  <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-blue-50/60 rounded-none md:rounded-2xl border-y md:border border-purple-200/80 p-4 sm:p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0 mt-0.5 shadow-2xs">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-purple-950">
                              Lector IA de Ticket InBody / BIA
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                              Gemini Vision OCR
                            </span>
                          </div>
                          <p className="text-xs text-purple-900/80 mt-1 leading-relaxed">
                            Sube una foto o PDF del ticket (InBody 120, 270, 370, 570, Tanita) y la IA autocompletará las mediciones de bioimpedancia al instante.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          ref={inbodyFileInputRef}
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleInbodyFileUpload(f);
                            e.target.value = "";
                          }}
                        />

                        <button
                          type="button"
                          disabled={analyzingInbody || isReadOnly}
                          onClick={() => inbodyFileInputRef.current?.click()}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                        >
                          {analyzingInbody ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Analizando ticket...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 text-white" />
                              <span>Subir PDF o Foto del Ticket</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {inbodyOcrResult && (
                      <div className={`mt-3.5 pt-3 border-t ${inbodyOcrResult.success ? "border-purple-200/80" : "border-red-200"} flex items-center justify-between text-xs font-semibold`}>
                        <div className="flex items-center gap-2">
                          {inbodyOcrResult.success ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="text-purple-950">
                                ¡{inbodyOcrResult.count} valores extraídos desde <strong>{inbodyOcrResult.fileName}</strong>
                                {inbodyOcrResult.equipo ? ` (${inbodyOcrResult.equipo})` : ""}! Revisa los campos antes de guardar.
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                              <span className="text-red-700">{inbodyOcrResult.error}</span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setInbodyOcrResult(null)}
                          className="text-purple-600 hover:text-purple-800 text-[11px] underline ml-2 shrink-0 cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Card 2: Grupos de Campos Antropométricos */}
                {activeGroups.map(group => (
                  <div key={group.label} className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm">
                    <div className="text-xs text-[#0B1929] font-bold mb-4 uppercase tracking-wider flex items-center gap-2 border-b border-[#F0F4FA] pb-2.5">
                      <span className="text-[var(--brand-primary)]">{group.icon}</span>
                      <span>{group.label}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                      {group.fields.map(f => (
                        <div key={f.key} className="flex flex-col gap-1">
                          <label className="text-xs font-bold text-[#6B7A8D]">{f.label}</label>
                          <input
                            type={f.type}
                            step={f.step || "any"}
                            readOnly={isReadOnly}
                            value={form[f.key] ?? ""}
                            placeholder={f.placeholder || ""}
                            className={`bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm font-semibold text-[#0B1929] ${isReadOnly ? "cursor-default text-gray-700" : "focus:bg-white focus:outline-none focus:border-[var(--brand-primary)]"} transition-colors`}
                            onChange={e => !isReadOnly && updForm(f.key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Card 3: Notas y Fotografías de Progreso */}
                <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">Notas y Observaciones Clínicas</label>
                    <textarea
                      readOnly={isReadOnly}
                      value={form.notas || ""}
                      onChange={e => !isReadOnly && updForm("notas", e.target.value)}
                      placeholder={(isMiPlan || isCivil) ? "Notas u observaciones de la evaluación…" : "Observaciones del nutriólogo…"}
                      className={`bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0B1929] ${isReadOnly ? "cursor-default text-gray-700" : "focus:bg-white focus:outline-none focus:border-[var(--brand-primary)]"} min-h-[90px]`}
                    />
                  </div>

                  {editingId && existingFotos.length > 0 && (
                    <div>
                      <div className="text-xs text-[#6B7A8D] font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5"><Camera className="w-4 h-4 text-[var(--brand-primary)]"/> Fotos actuales</div>
                      <div className="flex gap-2.5 flex-wrap">
                        {existingFotos.map((url, i) => (
                          <div key={i} className="relative w-20 h-20">
                            <img src={url} onClick={() => setLightbox(url)} className="w-20 h-20 object-cover rounded-xl border border-[#E2E8F0] cursor-zoom-in" alt=""/>
                            {!isReadOnly && (
                              <button onClick={() => setExistingFotos(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-5 text-center cursor-pointer border-none font-bold shadow-xs">×</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isReadOnly && (
                    <div>
                      <div className="text-xs text-[#6B7A8D] font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5"><Camera className="w-4 h-4 text-[var(--brand-primary)]"/> {editingId ? "Agregar más fotos" : "Fotos de progreso"}</div>
                      <label className="inline-flex items-center gap-2 bg-white border border-dashed border-[var(--brand-primary)] rounded-xl px-4 py-2.5 cursor-pointer text-xs sm:text-sm text-[var(--brand-primary)] font-bold hover:bg-[var(--brand-primary)]/5 transition-colors">
                        <Plus className="w-4 h-4" /> Agregar fotos
                        <input type="file" accept="image/*" multiple onChange={handleFotos} className="hidden"/>
                      </label>
                      {previewUrls.length > 0 && (
                        <div className="flex gap-2.5 flex-wrap mt-3">
                          {previewUrls.map((url, i) => (
                            <div key={i} className="relative w-20 h-20">
                              <img src={url} className="w-20 h-20 object-cover rounded-xl border-2 border-[var(--brand-primary)]" alt=""/>
                              <button onClick={() => removePendingFoto(i)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-5 text-center cursor-pointer border-none font-bold shadow-xs">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Sticky Live Clinical Summary & AI Macro Prescription */}
              <div className="lg:col-span-4 lg:sticky lg:top-20 lg:self-start flex flex-col gap-4">
                <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-4 sm:p-5 shadow-none md:shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#F0F4FA]">
                    <Activity className="w-4 h-4 text-[var(--brand-primary)]" />
                    <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                      Composición Calculada en Vivo
                    </h3>
                  </div>

                  {!hasLiveCalc ? (
                    <div className="text-center py-8 text-xs text-[#6B7A8D]">
                      Ingresa peso, estatura, perímetros o pliegues para calcular los indicadores automáticamente.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {liveCalculations.imc && (
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">IMC</div>
                          <div className="text-lg font-black text-[#0B1929] font-['Rajdhani']">{liveCalculations.imc}</div>
                          {liveCalculations.imc_info && (
                            <div className="text-[10px] font-bold text-[var(--brand-primary)]">{liveCalculations.imc_info.label}</div>
                          )}
                        </div>
                      )}
                      {(liveCalculations.grasa_pct || form.grasa_pct) && (
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">% Grasa</div>
                          <div className="text-lg font-black text-[#0B1929] font-['Rajdhani']">{liveCalculations.grasa_pct || form.grasa_pct}%</div>
                          {liveCalculations.sum_pliegues && (
                            <div className="text-[10px] text-[#6B7A8D]">Σ {liveCalculations.sum_pliegues} mm</div>
                          )}
                        </div>
                      )}
                      {liveCalculations.calc_masa_grasa && (
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">Masa Grasa</div>
                          <div className="text-lg font-black text-[#0B1929] font-['Rajdhani']">{liveCalculations.calc_masa_grasa} kg</div>
                        </div>
                      )}
                      {liveCalculations.masa_libre_grasa && (
                        <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200">
                          <div className="text-[10px] font-bold text-emerald-700 uppercase">MLG (Magra)</div>
                          <div className="text-lg font-black text-emerald-700 font-['Rajdhani']">{liveCalculations.masa_libre_grasa} kg</div>
                        </div>
                      )}
                      {liveCalculations.calc_masa_muscular && (
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">Masa Muscular</div>
                          <div className="text-lg font-black text-[#0B1929] font-['Rajdhani']">{liveCalculations.calc_masa_muscular} kg</div>
                        </div>
                      )}
                      {liveCalculations.calc_masa_osea && (
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">Masa Ósea</div>
                          <div className="text-lg font-black text-[#0B1929] font-['Rajdhani']">{liveCalculations.calc_masa_osea} kg</div>
                        </div>
                      )}
                      {liveCalculations.icc && (
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">ICC / ICE</div>
                          <div className="text-lg font-black text-[#0B1929] font-['Rajdhani']">
                            {liveCalculations.icc}{liveCalculations.ice ? ` · ${liveCalculations.ice}` : ""}
                          </div>
                          {liveCalculations.icc_info && (
                            <div className="text-[10px] font-bold text-[#6B7A8D]">{liveCalculations.icc_info.label}</div>
                          )}
                        </div>
                      )}
                      {liveCalculations.somatotipo_endo && liveCalculations.somatotipo_meso && liveCalculations.somatotipo_ecto && (
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] col-span-2">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">Somatotipo (Endo · Meso · Ecto)</div>
                          <div className="text-lg font-black text-[#0B1929] font-['Rajdhani']">
                            {liveCalculations.somatotipo_endo} - {liveCalculations.somatotipo_meso} - {liveCalculations.somatotipo_ecto}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Prescripción de Macros: Matemático, Sugerido IA o Manual */}
                <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-indigo-100 p-4 sm:p-5 shadow-none md:shadow-sm relative overflow-hidden space-y-3.5">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--brand-primary)] via-indigo-500 to-emerald-500" />
                  
                  {/* Cabecera */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#F0F4FA]">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                        Prescripción de Macros
                      </h3>
                    </div>
                    {liveSmartMacros?.formulaShort && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {liveSmartMacros.formulaShort}
                      </span>
                    )}
                  </div>

                  {/* Selector de 3 Modos: Matemático, Auditado IA, Manual */}
                  <div className="flex bg-[#F0F4FA] rounded-xl p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setPrescriptionMode("matematico")}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        prescriptionMode === "matematico"
                          ? "bg-white shadow-xs text-[#0B1929]"
                          : "text-[#6B7A8D] hover:text-[#0B1929]"
                      }`}
                    >
                      <Calculator className="w-3.5 h-3.5 text-blue-600" />
                      <span>Matemático</span>
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly || isAuditingAi}
                      onClick={() => {
                        if (aiAuditResult) {
                          setPrescriptionMode("ia");
                        } else {
                          handleAuditMacrosWithAi();
                        }
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        prescriptionMode === "ia"
                          ? "bg-indigo-600 shadow-xs text-white"
                          : "text-indigo-600 hover:text-indigo-800"
                      }`}
                    >
                      {isAuditingAi ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{aiAuditResult ? "Auditado IA" : "Auditar IA"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const prevMode = prescriptionMode;
                        setPrescriptionMode("manual");
                        if (prevMode === "ia" && aiAuditResult) {
                          setManualMacros({
                            targetKcal: String(aiAuditResult.targetKcal || ""),
                            proteinG: String(aiAuditResult.proteinG || ""),
                            carbsG: String(aiAuditResult.carbsG || ""),
                            fatsG: String(aiAuditResult.fatsG || ""),
                          });
                        } else {
                          const hasManualData = Boolean(
                            manualMacros.targetKcal &&
                            (manualMacros.proteinG || manualMacros.carbsG || manualMacros.fatsG)
                          );
                          if (!hasManualData) {
                            const base = liveSmartMacros?.matematico || liveSmartMacros || activePrescription;
                            if (base) {
                              setManualMacros({
                                targetKcal: String(base.targetKcal || ""),
                                proteinG: String(base.proteinG || ""),
                                carbsG: String(base.carbsG || ""),
                                fatsG: String(base.fatsG || ""),
                              });
                            }
                          }
                        }
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        prescriptionMode === "manual"
                          ? "bg-white shadow-xs text-[#0B1929]"
                          : "text-[#6B7A8D] hover:text-[#0B1929]"
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Manual</span>
                    </button>
                  </div>

                  {!activePrescription?.hasEnoughData ? (
                    <div className="text-center py-6 text-xs text-[#6B7A8D]">
                      Ingresa el peso corporal en las mediciones para calcular la prescripción energética de esta etapa.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Fila 1: TMB Basal, GET, Meta Etapa */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#F8FAFC] rounded-xl p-2.5 border border-[#E2E8F0] text-center">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">TMB Basal</div>
                          <div className="text-base font-black text-[#0B1929] font-['Rajdhani']">{activePrescription.tmb}</div>
                          <div className="text-[9px] text-[#6B7A8D]">kcal/día</div>
                        </div>
                        <div className="bg-[#F8FAFC] rounded-xl p-2.5 border border-[#E2E8F0] text-center">
                          <div className="text-[10px] font-bold text-[#6B7A8D] uppercase">GET (×{activePrescription.faf || liveSmartMacros.faf})</div>
                          <div className="text-base font-black text-[#0B1929] font-['Rajdhani']">{activePrescription.get}</div>
                          <div className="text-[9px] text-[#6B7A8D]">kcal/día</div>
                        </div>
                        <div className="bg-[var(--brand-primary)]/10 rounded-xl p-2.5 border border-[var(--brand-primary)]/30 text-center flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-[var(--brand-primary)] uppercase">Meta Etapa</div>
                          {prescriptionMode === "manual" ? (
                            <input
                              type="number"
                              disabled={isReadOnly}
                              value={manualMacros.targetKcal}
                              onChange={(e) => setManualMacros((p) => ({ ...p, targetKcal: e.target.value }))}
                              placeholder="Kcal"
                              className="w-full text-center text-sm font-black text-[var(--brand-primary)] bg-white border border-blue-300 rounded-lg py-0.5 px-1 focus:outline-none"
                            />
                          ) : (
                            <div className="text-base font-black text-[var(--brand-primary)] font-['Rajdhani']">
                              {activePrescription.targetKcal}
                            </div>
                          )}
                          <div className="text-[9px] font-bold text-[var(--brand-primary)]">
                            {activePrescription.goalPct > 0 ? `+${activePrescription.goalPct}%` : `${activePrescription.goalPct}%`} kcal
                          </div>
                        </div>
                      </div>

                      {/* Fila 2: Proteína, Carbos, Grasas */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Proteína */}
                        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-blue-700 uppercase">Proteína</div>
                          {prescriptionMode === "manual" ? (
                            <div className="flex items-center justify-center gap-0.5 my-0.5">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={manualMacros.proteinG}
                                onChange={(e) => setManualMacros((p) => ({ ...p, proteinG: e.target.value }))}
                                placeholder="g"
                                className="w-14 text-center text-xs font-black text-blue-900 bg-white border border-blue-300 rounded py-0.5 px-1 focus:outline-none"
                              />
                              <span className="text-[10px] font-bold text-blue-700">g</span>
                            </div>
                          ) : (
                            <div className="text-base font-black text-[#0B1929] font-['Rajdhani']">
                              {activePrescription.proteinG}g
                            </div>
                          )}
                          <div className="text-[10px] text-blue-700 font-semibold truncate">
                            {activePrescription.protGKg} g/kg · {activePrescription.proteinPct}%
                          </div>
                        </div>

                        {/* Carbos */}
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-emerald-700 uppercase">Carbos</div>
                          {prescriptionMode === "manual" ? (
                            <div className="flex items-center justify-center gap-0.5 my-0.5">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={manualMacros.carbsG}
                                onChange={(e) => setManualMacros((p) => ({ ...p, carbsG: e.target.value }))}
                                placeholder="g"
                                className="w-14 text-center text-xs font-black text-emerald-900 bg-white border border-emerald-300 rounded py-0.5 px-1 focus:outline-none"
                              />
                              <span className="text-[10px] font-bold text-emerald-700">g</span>
                            </div>
                          ) : (
                            <div className="text-base font-black text-[#0B1929] font-['Rajdhani']">
                              {activePrescription.carbsG}g
                            </div>
                          )}
                          <div className="text-[10px] text-emerald-700 font-semibold truncate">
                            {activePrescription.carbGKg} g/kg · {activePrescription.carbsPct}%
                          </div>
                        </div>

                        {/* Grasas */}
                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-amber-700 uppercase">Grasas</div>
                          {prescriptionMode === "manual" ? (
                            <div className="flex items-center justify-center gap-0.5 my-0.5">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={manualMacros.fatsG}
                                onChange={(e) => setManualMacros((p) => ({ ...p, fatsG: e.target.value }))}
                                placeholder="g"
                                className="w-14 text-center text-xs font-black text-amber-900 bg-white border border-amber-300 rounded py-0.5 px-1 focus:outline-none"
                              />
                              <span className="text-[10px] font-bold text-amber-700">g</span>
                            </div>
                          ) : (
                            <div className="text-base font-black text-[#0B1929] font-['Rajdhani']">
                              {activePrescription.fatsG}g
                            </div>
                          )}
                          <div className="text-[10px] text-amber-700 font-semibold truncate">
                            {activePrescription.fatGKg} g/kg · {activePrescription.fatsPct}%
                          </div>
                        </div>
                      </div>

                      {/* Bloque de Auditoría Clínica con FLUX IA (Genuina, bajo demanda) */}
                      {prescriptionMode !== "manual" && (
                        <div className="bg-gradient-to-br from-indigo-50/60 to-blue-50/30 border border-indigo-100 rounded-xl p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-indigo-600" />
                              <span className="text-xs font-bold text-[#0B1929]">
                                Auditoría Clínica con FLUX IA
                              </span>
                            </div>
                            {aiAuditResult?.badgeMotivo ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200/60">
                                {aiAuditResult.badgeMotivo}
                              </span>
                            ) : !isAuditingAi ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                Bajo Demanda
                              </span>
                            ) : null}
                          </div>

                          {/* Estado de Carga */}
                          {isAuditingAi && (
                            <div className="p-3 rounded-lg bg-white/90 border border-indigo-100 flex items-center gap-2.5 text-xs text-indigo-900 shadow-xs">
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                              <span className="font-medium">
                                FLUX IA está analizando el expediente médico, R24H y antropometría...
                              </span>
                            </div>
                          )}

                          {/* Mensaje de Servicio de IA Fuera de Servicio */}
                          {aiAuditError && !isAuditingAi && (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <strong className="block font-semibold">Servicio de IA:</strong>
                                <p className="text-[11px] leading-relaxed text-amber-800">{aiAuditError}</p>
                              </div>
                            </div>
                          )}

                          {/* Estado Inicial: Botón para detonar la auditoría */}
                          {!aiAuditResult && !isAuditingAi && (
                            <div className="space-y-2">
                              <p className="text-[11px] text-[#475569] leading-relaxed">
                                Contrasta el cálculo matemático estándar con el expediente clínico, las comidas del R24H y los hábitos del check-in mediante FLUX IA para obtener una recomendación adaptada a la realidad del paciente.
                              </p>
                              <button
                                type="button"
                                disabled={isReadOnly || !liveSmartMacros?.hasEnoughData}
                                onClick={handleAuditMacrosWithAi}
                                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-[var(--brand-primary)] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Auditar Prescripción con FLUX IA</span>
                              </button>
                            </div>
                          )}

                          {/* Resultado Genuino de Gemini */}
                          {aiAuditResult && !isAuditingAi && (
                            <div className="space-y-2.5">
                              {aiAuditResult.analisisClinico && (
                                <p className="text-[11px] text-[#334155] leading-relaxed bg-white/80 p-2.5 rounded-lg border border-indigo-100/80">
                                  <strong className="text-[#0B1929] block mb-0.5 font-bold">
                                    Criterio clínico emitido por FLUX IA:
                                  </strong>
                                  {aiAuditResult.analisisClinico}
                                </p>
                              )}

                              {/* Ajustes Sugeridos */}
                              {aiAuditResult.ajustesSugeridos?.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-indigo-100/70">
                                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                                    Ajustes sugeridos por la IA:
                                  </span>
                                  <ul className="text-[11px] text-[#475569] space-y-1 list-disc pl-3.5">
                                    {aiAuditResult.ajustesSugeridos.map((ajuste, idx) => (
                                      <li key={idx} className="leading-tight">{ajuste}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Estrategia de Menú */}
                              {aiAuditResult.estrategiaMenu && (
                                <div className="p-2 rounded-lg bg-white/90 border border-indigo-100/80 text-[11px] text-[#334155] flex items-start gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                  <div className="leading-snug">
                                    <strong className="text-[#0B1929]">Estrategia recomendada: </strong>
                                    {aiAuditResult.estrategiaMenu}
                                  </div>
                                </div>
                              )}

                              {/* Controles de Acción */}
                              <div className="pt-1.5 border-t border-indigo-100/70 flex items-center justify-between gap-2 flex-wrap">
                                {prescriptionMode === "ia" ? (
                                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Prescripción de la IA activa ({aiAuditResult.targetKcal} kcal)
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => !isReadOnly && setPrescriptionMode("ia")}
                                    className="py-1.5 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Aplicar prescripción de la IA ({aiAuditResult.targetKcal} kcal)</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={handleAuditMacrosWithAi}
                                  className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                                >
                                  Volver a auditar con IA
                                </button>
                              </div>

                              <div className="pt-1.5 border-t border-indigo-100/50 flex items-center justify-between gap-2 flex-wrap text-[10px] text-[#64748B]">
                                <span>Sugerencia generada por IA; valide siempre con criterio clínico profesional.</span>
                                <button
                                  type="button"
                                  onClick={() => setMsg && setMsg("✓ Respuesta de IA reportada al equipo de revisión de FLUX.")}
                                  className="text-[#64748B] hover:text-red-600 underline cursor-pointer font-semibold"
                                >
                                  Reportar respuesta IA
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bloque de Prescripción Dinámica / Simulador (Modo Manual) */}
                      {prescriptionMode === "manual" && (
                        <div className="bg-gradient-to-br from-amber-50/50 via-white to-amber-50/30 border border-amber-200/80 rounded-2xl p-4 space-y-3.5 shadow-xs">
                          {/* Cabecera del Simulador Inline */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                              <span className="text-xs font-bold text-[#0B1929]">
                                Simulador & Ajustes Manuales
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/60">
                                Ajuste Fino
                              </span>
                            </div>

                            {/* Switcher: g/kg vs % */}
                            <div className="flex bg-amber-100/60 p-0.5 rounded-lg border border-amber-200/70">
                              <button
                                type="button"
                                onClick={() => setManualSimMode("g_kg")}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                  manualSimMode === "g_kg"
                                    ? "bg-white text-amber-900 shadow-2xs"
                                    : "text-[#6B7A8D] hover:text-[#0B1929]"
                                }`}
                              >
                                g / kg
                              </button>
                              <button
                                type="button"
                                onClick={() => setManualSimMode("pct")}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                  manualSimMode === "pct"
                                    ? "bg-white text-amber-900 shadow-2xs"
                                    : "text-[#6B7A8D] hover:text-[#0B1929]"
                                }`}
                              >
                                % Calorías
                              </button>
                            </div>
                          </div>

                          {/* Presets Rápidos de Objetivo Calórico */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-[#475569]">
                                Ajuste rápido de Kcal (sobre GET {activePrescription.get} kcal):
                              </span>
                              <span className="font-bold text-amber-700 font-['Rajdhani'] text-xs">
                                {activePrescription.goalPct > 0 ? `+${activePrescription.goalPct}%` : `${activePrescription.goalPct}%`}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                              {[
                                { label: "-20% Déficit", pct: -20 },
                                { label: "-15% Déficit", pct: -15 },
                                { label: "-10% Déficit", pct: -10 },
                                { label: "0% Mant.", pct: 0 },
                                { label: "+10% Superávit", pct: 10 },
                                { label: "+15% Superávit", pct: 15 },
                              ].map((preset) => {
                                const isCurrent = Number(activePrescription.goalPct) === preset.pct;
                                return (
                                  <button
                                    key={preset.pct}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => handleSetGoalPreset(preset.pct)}
                                    className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all border text-center cursor-pointer disabled:opacity-50 ${
                                      isCurrent
                                        ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                                        : "bg-white/80 border-amber-200/80 text-[#334155] hover:bg-amber-100/60"
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Controles Dinámicos según modo g_kg vs pct */}
                          {manualSimMode === "g_kg" ? (
                            <div className="space-y-3 pt-1">
                              {/* Slider Proteína g/kg */}
                              <div className="bg-white/90 border border-blue-200/80 rounded-xl p-3 space-y-1.5 shadow-2xs">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-blue-900">
                                    Proteína (g / kg peso)
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-blue-700 font-['Rajdhani']">
                                      {activePrescription.protGKg} g/kg
                                    </span>
                                    <span className="text-[10px] text-[#6B7A8D]">
                                      ({activePrescription.proteinG}g · {activePrescription.proteinPct}%)
                                    </span>
                                    <div className="flex items-center gap-0.5 ml-1">
                                      <button
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => handleAdjustProtGKg(Math.max(1.0, Number((activePrescription.protGKg - 0.1).toFixed(1))))}
                                        className="w-5 h-5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 hover:bg-blue-100 flex items-center justify-center cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => handleAdjustProtGKg(Math.min(3.5, Number((activePrescription.protGKg + 0.1).toFixed(1))))}
                                        className="w-5 h-5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 hover:bg-blue-100 flex items-center justify-center cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <input
                                  type="range"
                                  min="1.0"
                                  max="3.5"
                                  step="0.1"
                                  disabled={isReadOnly}
                                  value={activePrescription.protGKg || 2.0}
                                  onChange={(e) => handleAdjustProtGKg(Number(e.target.value))}
                                  className="w-full accent-blue-600 cursor-pointer"
                                />
                              </div>

                              {/* Slider Grasas g/kg */}
                              <div className="bg-white/90 border border-amber-200/80 rounded-xl p-3 space-y-1.5 shadow-2xs">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-amber-900">
                                    Grasas (g / kg peso)
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-amber-700 font-['Rajdhani']">
                                      {activePrescription.fatGKg} g/kg
                                    </span>
                                    <span className="text-[10px] text-[#6B7A8D]">
                                      ({activePrescription.fatsG}g · {activePrescription.fatsPct}%)
                                    </span>
                                    <div className="flex items-center gap-0.5 ml-1">
                                      <button
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => handleAdjustFatGKg(Math.max(0.5, Number((activePrescription.fatGKg - 0.05).toFixed(2))))}
                                        className="w-5 h-5 rounded bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 flex items-center justify-center cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => handleAdjustFatGKg(Math.min(2.0, Number((activePrescription.fatGKg + 0.05).toFixed(2))))}
                                        className="w-5 h-5 rounded bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 flex items-center justify-center cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <input
                                  type="range"
                                  min="0.5"
                                  max="2.0"
                                  step="0.05"
                                  disabled={isReadOnly}
                                  value={activePrescription.fatGKg || 0.9}
                                  onChange={(e) => handleAdjustFatGKg(Number(e.target.value))}
                                  className="w-full accent-amber-500 cursor-pointer"
                                />
                              </div>

                              {/* Carbohidratos: Balance Residual */}
                              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
                                <div className="text-[11px] text-emerald-950">
                                  <strong className="block font-bold">Carbohidratos de balance:</strong>
                                  <span className="text-[#475569]">Cuadran las calorías restantes de la meta</span>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-xs font-black text-emerald-800 font-['Rajdhani']">
                                    {activePrescription.carbsG}g ({activePrescription.carbGKg} g/kg)
                                  </div>
                                  <div className="text-[10px] font-semibold text-emerald-700">
                                    {activePrescription.carbsPct}% de las kcal
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Modo Porcentual (%) */
                            <div className="space-y-2.5 pt-1">
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white/90 border border-blue-200 rounded-xl p-2.5 text-center">
                                  <div className="text-[10px] font-bold text-blue-700 uppercase mb-1">
                                    % Proteína
                                  </div>
                                  <div className="text-sm font-black text-blue-900 font-['Rajdhani']">
                                    {activePrescription.proteinPct}%
                                  </div>
                                  <input
                                    type="range"
                                    min="15"
                                    max="50"
                                    step="1"
                                    disabled={isReadOnly}
                                    value={activePrescription.proteinPct || 30}
                                    onChange={(e) => handleAdjustPct("p", Number(e.target.value))}
                                    className="w-full accent-blue-600 mt-1 cursor-pointer"
                                  />
                                </div>
                                <div className="bg-white/90 border border-emerald-200 rounded-xl p-2.5 text-center">
                                  <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">
                                    % Carbos
                                  </div>
                                  <div className="text-sm font-black text-emerald-900 font-['Rajdhani']">
                                    {activePrescription.carbsPct}%
                                  </div>
                                  <input
                                    type="range"
                                    min="10"
                                    max="70"
                                    step="1"
                                    disabled={isReadOnly}
                                    value={activePrescription.carbsPct || 45}
                                    onChange={(e) => handleAdjustPct("c", Number(e.target.value))}
                                    className="w-full accent-emerald-600 mt-1 cursor-pointer"
                                  />
                                </div>
                                <div className="bg-white/90 border border-amber-200 rounded-xl p-2.5 text-center">
                                  <div className="text-[10px] font-bold text-amber-700 uppercase mb-1">
                                    % Grasas
                                  </div>
                                  <div className="text-sm font-black text-amber-900 font-['Rajdhani']">
                                    {activePrescription.fatsPct}%
                                  </div>
                                  <input
                                    type="range"
                                    min="15"
                                    max="50"
                                    step="1"
                                    disabled={isReadOnly}
                                    value={activePrescription.fatsPct || 25}
                                    onChange={(e) => handleAdjustPct("f", Number(e.target.value))}
                                    className="w-full accent-amber-500 mt-1 cursor-pointer"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[11px] px-1">
                                <span className="text-[#6B7A8D]">Suma de porcentajes:</span>
                                <span
                                  className={`font-bold px-2 py-0.5 rounded-full ${
                                    activePrescription.proteinPct + activePrescription.carbsPct + activePrescription.fatsPct === 100
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {activePrescription.proteinPct + activePrescription.carbsPct + activePrescription.fatsPct}%
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Base de Sustento: Copiar de IA o Restaurar Matemático */}
                          <div className="space-y-2 pt-2 border-t border-amber-200/70">
                            {aiAuditResult && (
                              <div className="bg-white/90 border border-indigo-200 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
                                <div className="text-[11px] text-[#334155] leading-tight min-w-0">
                                  <div className="flex items-center gap-1 font-bold text-indigo-900">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>Prescripción IA disponible:</span>
                                    {aiAuditResult.badgeMotivo && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                                        {aiAuditResult.badgeMotivo}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[#64748B] text-[10px] mt-0.5">
                                    {aiAuditResult.targetKcal} kcal · {aiAuditResult.proteinG}g P · {aiAuditResult.carbsG}g C · {aiAuditResult.fatsG}g G
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={handleCopyFromAi}
                                  className="py-1 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Copiar de IA</span>
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={handleCopyFromMath}
                                className="font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                <span>Restablecer cálculo matemático ({liveSmartMacros?.targetKcal} kcal)</span>
                              </button>
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => !isReadOnly && setPrescriptionMode("matematico")}
                                className="font-semibold text-[#6B7A8D] hover:text-[#0B1929] hover:underline cursor-pointer"
                              >
                                Salir de manual
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Cuadro Dietosintético SMAE del Ciclo (Nace en el Paso 5 junto con los Macros) ── */}
                      {(() => {
                        const smaeTotals = calculateSmaeTotals(effectiveSmaeDistribution);
                        const activeGroups = SMAE_GROUPS.filter((g) => (Number(effectiveSmaeDistribution[g.id]) || 0) > 0);
                        const targetK = Number(activePrescription?.targetKcal) || 0;
                        const adequacyPct = targetK > 0 ? Math.round((smaeTotals.kcal / targetK) * 100) : 100;
                        return (
                          <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">🇲🇽</span>
                                <div>
                                  <div className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5 flex-wrap">
                                    <span>Equivalentes SMAE del Ciclo</span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {smaeTotals.totalEquivalentes} eq · {smaeTotals.kcal} kcal ({adequacyPct}%)
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-emerald-800/90 font-medium">
                                    {isCustomSmaeActive ? "Ajustado manualmente" : `Sincronizado en automático con ${activePrescription.modeLabel}`}:{" "}
                                    <strong className="font-mono">
                                      {smaeTotals.proteina}g P · {smaeTotals.carbohidratos}g C · {smaeTotals.grasas}g G
                                    </strong>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isCustomSmaeActive && !isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => setCustomSmaeMap(null)}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer flex items-center gap-1"
                                    title="Volver a sincronizar con las Kcal y Macros de arriba"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Sincronizar</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setShowStep5SmaeTable((v) => !v)}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span>{showStep5SmaeTable ? "Compactar" : "Personalizar eq"}</span>
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showStep5SmaeTable ? "rotate-180" : ""}`} />
                                </button>
                              </div>
                            </div>

                            {/* Chips resumen de equivalentes activos */}
                            <div className="flex flex-wrap gap-1.5">
                              {activeGroups.map((g) => (
                                <span
                                  key={g.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-emerald-200/80 text-[11px] font-semibold text-[#0B1929]"
                                >
                                  <span>{g.icono}</span>
                                  <span>{g.corto}:</span>
                                  <strong className="text-emerald-700 font-mono">{effectiveSmaeDistribution[g.id]}</strong>
                                </span>
                              ))}
                            </div>

                            {/* Tabla expandible de ajuste por grupo SMAE */}
                            {showStep5SmaeTable && (
                              <div className="pt-2 border-t border-emerald-200/60 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-0.5">
                                  {SMAE_GROUPS.map((grp) => {
                                    const eqVal = Number(effectiveSmaeDistribution[grp.id]) || 0;
                                    return (
                                      <div
                                        key={grp.id}
                                        className={`flex items-center justify-between gap-1.5 p-2 rounded-lg border transition-all ${
                                          eqVal > 0
                                            ? "bg-white border-emerald-300 shadow-2xs"
                                            : "bg-white/60 border-gray-200 opacity-75"
                                        }`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs">{grp.icono}</span>
                                            <span className="text-[11px] font-bold text-[#0B1929] truncate" title={grp.nombre}>
                                              {grp.corto}
                                            </span>
                                          </div>
                                          <div className="text-[9px] text-gray-500 font-mono">
                                            1eq={grp.kcal}kcal · {grp.proteina}P · {grp.carbohidratos}C · {grp.grasas}G
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            disabled={isReadOnly || eqVal <= 0}
                                            onClick={() => adjustStep5Smae(grp.id, -0.5)}
                                            className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center disabled:opacity-40 cursor-pointer"
                                          >
                                            -
                                          </button>
                                          <span className="w-8 text-center text-xs font-extrabold font-mono text-[#0B1929]">
                                            {eqVal}
                                          </span>
                                          <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => adjustStep5Smae(grp.id, 0.5)}
                                            className="w-5 h-5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center disabled:opacity-40 cursor-pointer"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-emerald-900 bg-white/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/70">
                                  <span>Aporte SMAE:</span>
                                  <strong>
                                    {smaeTotals.kcal} kcal · {smaeTotals.proteina}g P · {smaeTotals.carbohidratos}g C · {smaeTotals.grasas}g G
                                  </strong>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Sincronización Automática con el Plan Nutricional */}
                      {!isReadOnly && (
                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoSyncMacros}
                            onChange={(e) => setAutoSyncMacros(e.target.checked)}
                            className="mt-0.5 rounded border-indigo-300 text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                          />
                          <span className="text-[11px] font-semibold text-[#0B1929] leading-snug">
                            Sincronizar automáticamente estas metas ({activePrescription.targetKcal} kcal · {activePrescription.modeLabel}) al Plan Nutricional activo al guardar
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Expediente Clínico y Seguimiento */}
      <ExpedienteClinicoModal
        isOpen={showExpediente}
        onClose={() => setShowExpediente(false)}
        cliente={selected}
        mode="nutriologo"
        onSaved={(saved) => setClinicalRec(saved)}
      />

      {/* Lightbox */}
      {lightbox&&createPortal(
        <div onClick={()=>setLightbox(null)} className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] cursor-zoom-out">
          <img src={lightbox} className="max-w-[90vw] max-h-[90vh] rounded-[14px] object-contain shadow-2xl" alt=""/>
          <div className="absolute top-5 right-6 text-white text-3xl cursor-pointer font-bold" onClick={()=>setLightbox(null)}><X className="w-8 h-8" /></div>
        </div>,
        document.body
      )}

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

      <UpgradeModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        feature={paywallFeature}
        clienteData={selected}
        onNavigateMembresia={() => {
          setPaywallOpen(false);
          window.dispatchEvent(new CustomEvent("flux:navigate-tab", { detail: { tab: "membresia" } }));
        }}
      />

    </div>
  );
}
