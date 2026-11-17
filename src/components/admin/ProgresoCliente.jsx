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
  evaluateWeightGoalPlan,
  TMB_FORMULAS,
  BIA_FORMULA_INFO,
  getTmbFormulaInfo,
  calculateTMB,
} from "../../lib/bodyComposition";
import {
  fetchCloudSteps,
  averageSteps,
  suggestFafWithSteps,
  DEFAULT_STEP_GOAL,
} from "../../lib/steps";
import { createPortal } from "react-dom";
import { dbPeek, dbGet, dbGetFresh, updateQueryCache, invalidateCache, dbPost, dbPatch, dbUpsert, dbDel, storageUpload, storageDelete } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { useBackButton } from "../../lib/backButtonHandler";
import { generateProgresoPDF } from "../../utils/pdf";
import { parseFotos, parseLocalDateNoon, getSemanasConFecha, getCurrentCycleWeekInfo, compressImageIfNeeded } from "../../utils/helpers";
import {
  Scale, Microscope, Ruler, Stethoscope, BarChart2, Dumbbell,
  Calendar, Edit2, Eye, Camera, FileText, Activity, BicepsFlexed, Plus, Trash2, Heart, ArrowUp, ArrowDown, X, AlertCircle, CheckCircle2, Target, Lock,
  UtensilsCrossed, Droplets, Check, ChevronDown, ClipboardList, ArrowLeft, Save, Layers, Clock, Zap, Utensils, Moon, Sparkles, Flame, Calculator, Ban, Loader2, SlidersHorizontal, RotateCcw, Upload, Footprints, Info
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
  autoDistributeSmaeFromMacros,
  calculateSmaeTotals,
} from "../../lib/smaeData";
import { parseDiaMetadata } from "../../lib/mealOptions";
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

export function getGroupsForMethod(metodo, sexo = "M", hasDefinedSexo = true) {
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
    const jp3Fields = !hasDefinedSexo
      ? [
          { key: "pliegue_pectoral", label: "Pectoral (mm · H)", type: "number", step: "0.1" },
          { key: "pliegue_abdominal", label: "Abdominal (mm · H)", type: "number", step: "0.1" },
          { key: "pliegue_triceps", label: "Tricipital (mm · M)", type: "number", step: "0.1" },
          { key: "pliegue_suprailiaco", label: "Suprailíaco (mm · M)", type: "number", step: "0.1" },
          { key: "pliegue_muslo", label: "Muslo anterior (mm)", type: "number", step: "0.1" },
        ]
      : s === "M"
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
      { label: "3 Pliegues Jackson-Pollock (mm)", icon: <Target className="w-4 h-4" />, fields: jp3Fields },
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

  if (metodo === "plicometria_faulkner") {
    return [
      { label: "Antropometría Base", icon: <Scale className="w-4 h-4" />, fields: [
        ...FIELDS_BASICAS,
        ...FIELDS_CIRCUNFERENCIAS_BASE,
      ]},
      { label: "4 Pliegues Faulkner (mm)", icon: <Target className="w-4 h-4" />, fields: [
        { key: "pliegue_triceps", label: "Tricipital (mm)", type: "number", step: "0.1" },
        { key: "pliegue_subescapular", label: "Subescapular (mm)", type: "number", step: "0.1" },
        { key: "pliegue_suprailiaco", label: "Suprailíaco (mm)", type: "number", step: "0.1" },
        { key: "pliegue_abdominal", label: "Abdominal (mm)", type: "number", step: "0.1" },
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
      { key: "pliegue_triceps", label: "Tricipital (mm)", type: "number", step: "0.1" },
      { key: "pliegue_subescapular", label: "Subescapular (mm)", type: "number", step: "0.1" },
      { key: "pliegue_suprailiaco", label: "Suprailíaco (mm)", type: "number", step: "0.1" },
      { key: "pliegue_abdominal", label: "Abdominal (mm)", type: "number", step: "0.1" },
      { key: "pliegue_muslo", label: "Muslo anterior (mm)", type: "number", step: "0.1" },
      { key: "pliegue_pantorrilla", label: "Pantorrilla medial (mm)", type: "number", step: "0.1" },
      { key: "pliegue_biceps", label: "Bicipital (mm · Opcional)", type: "number", step: "0.1" },
      { key: "pliegue_pectoral", label: "Pectoral (mm · Opcional)", type: "number", step: "0.1" },
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
  eval_peso_objetivo: "",
  eval_semanas_objetivo: "",
  eval_meta_pasos: "",
  eval_tmb_formula: "auto",
  ciclo_id: "",

  // Hábitos del ciclo y actividad física actual
  horas_sueno: "",
  consumo_agua_estimado: "",
  nivel_estres: "3",
  dias_ejercicio_actual: "",
  horario_ejercicio: "",

  // Preferencias y gustos alimentarios del ciclo (16 grupos SMAE + notas específicas)
  smae_gustos: {},
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

function countActiveRoutineDays(rutinasList) {
  if (!Array.isArray(rutinasList) || rutinasList.length === 0) return 0;
  const withEx = rutinasList.filter((r) => (r.ejercicios || []).length > 0);
  const list = withEx.length > 0 ? withEx : rutinasList;
  const uniqueDays = new Set();
  list.forEach((r) => {
    const parts = (r.nombre || "").split("|");
    const dayTag = (parts.length > 1 ? parts[0] : "").trim();
    if (dayTag && dayTag !== "S/D") uniqueDays.add(dayTag.toLowerCase());
  });
  return uniqueDays.size > 0 ? uniqueDays.size : list.length;
}

const WEEK_DAY_CATALOG = [
  { code: "LUN", name: "Lunes", aliases: ["LUN", "LUNES"] },
  { code: "MAR", name: "Martes", aliases: ["MAR", "MARTES"] },
  { code: "MIE", name: "Miércoles", aliases: ["MIE", "MIÉ", "MIERCOLES", "MIÉRCOLES"] },
  { code: "JUE", name: "Jueves", aliases: ["JUE", "JUEVES"] },
  { code: "VIE", name: "Viernes", aliases: ["VIE", "VIERNES"] },
  { code: "SAB", name: "Sábado", aliases: ["SAB", "SÁB", "SABADO", "SÁBADO"] },
  { code: "DOM", name: "Domingo", aliases: ["DOM", "DOMINGO"] },
];

function formatWeekDaysSummary(rawDayCodes) {
  if (!Array.isArray(rawDayCodes) || rawDayCodes.length === 0) return "";
  const indexSet = new Set();
  rawDayCodes.forEach((raw) => {
    const norm = String(raw || "").trim().toUpperCase();
    if (!norm || norm === "S/D") return;
    const idx = WEEK_DAY_CATALOG.findIndex((d) => d.aliases.includes(norm));
    if (idx !== -1) indexSet.add(idx);
  });
  const indices = Array.from(indexSet).sort((a, b) => a - b);
  if (indices.length === 0) return "";
  if (indices.length === 1) return WEEK_DAY_CATALOG[indices[0]].name;
  const isContiguous = indices.every((val, i) => i === 0 || val === indices[i - 1] + 1);
  if (isContiguous && indices.length >= 3) {
    return `${WEEK_DAY_CATALOG[indices[0]].name} a ${WEEK_DAY_CATALOG[indices[indices.length - 1]].name}`;
  }
  const names = indices.map((i) => WEEK_DAY_CATALOG[i].name);
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function buildAdherenceSnapshot({
  cicloEvaluado = null,
  nutriDiasCiclo = [],
  nutriProgresoRows = [],
  rutinasCiclo = [],
  progresoRows = [],
}) {
  const cicloNombreRaw = String(cicloEvaluado?.nombre || "").split("|")[0].trim();
  const cicloNombre = cicloNombreRaw || "Plan actual";

  // 1. Nutrición e Hidratación filtrada al ciclo evaluado (incluyendo días/semanas nulos como 0/N)
  const diasList = Array.isArray(nutriDiasCiclo) ? nutriDiasCiclo : [];
  const validDiaIds = new Set(diasList.map((d) => String(d.id)));
  const npMap = {};
  let maxLoggedNutriWeek = 0;
  let metaAguaBase = 2000;

  (nutriProgresoRows || []).forEach((r) => {
    if (!r || r.dia_id == null || !validDiaIds.has(String(r.dia_id))) return;
    const sem = Number(r.semana) || 1;
    npMap[`${r.dia_id}-${sem}`] = r;
    if (sem > maxLoggedNutriWeek) maxLoggedNutriWeek = sem;
    if (Number(r.meta_agua_ml) > 0) metaAguaBase = Number(r.meta_agua_ml);
  });

  const semanasCalc = getSemanasConFecha((rutinasCiclo && rutinasCiclo[0]) || null, cicloEvaluado);
  const currentWeekIdx = semanasCalc.findIndex((s) => s.isCurrent);
  const currentWeekNum = currentWeekIdx !== -1 ? (semanasCalc[currentWeekIdx]?.weekNum || 1) : (semanasCalc[semanasCalc.length - 1]?.weekNum || 1);
  let validWeeks = currentWeekIdx !== -1
    ? semanasCalc.filter((s) => s.weekNum <= currentWeekNum)
    : (semanasCalc.length > 0 ? semanasCalc : [{ weekNum: 1, label: "Sem 1", isCurrent: true }]);

  if (maxLoggedNutriWeek > (validWeeks[validWeeks.length - 1]?.weekNum || 0)) {
    const existingNums = new Set(validWeeks.map((w) => w.weekNum));
    for (let w = 1; w <= maxLoggedNutriWeek; w++) {
      if (!existingNums.has(w)) {
        const found = semanasCalc.find((s) => s.weekNum === w);
        validWeeks.push(found || { weekNum: w, label: `Sem ${w}`, isCurrent: false });
      }
    }
    validWeeks.sort((a, b) => a.weekNum - b.weekNum);
  }

  let totalComidas = 0;
  let comidasRealizadas = 0;
  let totalAguaMl = 0;
  let totalMetaAguaMl = 0;
  let diasRegistrados = 0;
  let diasTotalesPeriodo = 0;
  const nutriSemanas = [];

  if (diasList.length > 0) {
    validWeeks.forEach((s) => {
      let semComidas = 0;
      let semTotalComidas = 0;
      let semAguaMl = 0;
      let semMetaAguaMl = 0;
      let semDiasActivos = 0;

      diasList.forEach((d) => {
        const r = npMap[`${d.id}-${s.weekNum}`];
        const totalC = (d.comidas || []).length;
        const doneMap = (r && typeof r.comidas_done === "object" && r.comidas_done !== null) ? r.comidas_done : {};
        let doneCount = (d.comidas || []).filter((c, ci) => Boolean(
          (c.id && doneMap[c.id]) ||
          doneMap[ci] ||
          doneMap[String(ci)] ||
          (c.orden != null && doneMap[c.orden])
        )).length;
        if (doneCount === 0 && Number(r?.comidas_realizadas) > 0) {
          doneCount = totalC > 0 ? Math.min(Number(r.comidas_realizadas), totalC) : Number(r.comidas_realizadas);
        }
        const agua = Number(r?.agua_ml) || 0;
        const metaAgua = Number(r?.meta_agua_ml) || metaAguaBase;

        if (doneCount > 0 || agua > 0) {
          diasRegistrados++;
          semDiasActivos++;
        }

        diasTotalesPeriodo++;
        semComidas += doneCount;
        semTotalComidas += totalC;
        semAguaMl += agua;
        semMetaAguaMl += metaAgua;

        comidasRealizadas += doneCount;
        totalComidas += totalC;
        totalAguaMl += agua;
        totalMetaAguaMl += metaAgua;
      });

      nutriSemanas.push({
        semana: s.weekNum,
        label: s.label || `Sem ${s.weekNum}`,
        comidasRealizadas: semComidas,
        comidasTotal: semTotalComidas,
        pctComidas: semTotalComidas > 0 ? Math.min(100, Math.round((semComidas / semTotalComidas) * 100)) : 0,
        promedioAguaL: diasList.length > 0 ? (semAguaMl / (diasList.length * 1000)).toFixed(2) : "0.00",
        pctAgua: semMetaAguaMl > 0 ? Math.min(100, Math.round((semAguaMl / semMetaAguaMl) * 100)) : 0,
        dias: semDiasActivos,
        diasTotales: diasList.length,
      });
    });
  }

  const pctComidas = totalComidas > 0 ? Math.min(100, Math.round((comidasRealizadas / totalComidas) * 100)) : 0;
  const pctAgua = totalMetaAguaMl > 0 ? Math.min(100, Math.round((totalAguaMl / totalMetaAguaMl) * 100)) : 0;
  const promedioAguaL = diasTotalesPeriodo > 0 ? (totalAguaMl / (diasTotalesPeriodo * 1000)).toFixed(2) : "0.00";
  const promedioAguaDiasActivosL = diasRegistrados > 0 ? (totalAguaMl / (diasRegistrados * 1000)).toFixed(2) : "0.00";

  // 2. Entrenamiento filtrado al ciclo evaluado (incluyendo semanas nulas como 0/N)
  const rsRaw = Array.isArray(rutinasCiclo) ? rutinasCiclo : [];
  const rsWithEx = rsRaw.filter((r) => (r.ejercicios || []).length > 0);
  const rs = rsWithEx.length > 0 ? rsWithEx : rsRaw;
  const uDays = new Set();
  const entrenoDayCodes = [];
  const ejToRutina = {};
  rs.forEach((r) => {
    const parts = (r.nombre || "").split("|");
    const dayTag = (parts.length > 1 ? parts[0] : "").trim();
    if (dayTag && dayTag !== "S/D") {
      uDays.add(dayTag.toLowerCase());
      entrenoDayCodes.push(dayTag);
    }
    (r.ejercicios || []).forEach((e) => {
      ejToRutina[String(e.id)] = r.id;
    });
  });
  const daysAssigned = rs.length > 0 ? (uDays.size > 0 ? uDays.size : rs.length) : 0;
  const entrenoDiasDetalle = formatWeekDaysSummary(entrenoDayCodes);
  const nutriDayCodes = diasList.map((d) => parseDiaMetadata(d.dia || d.nombre || "").dayCode);
  const nutriDiasDetalle = formatWeekDaysSummary(nutriDayCodes);

  const sessionKeys = new Set();
  const weeksWithWorkouts = new Set();
  const sessionsByWeek = {};
  (progresoRows || []).forEach((p) => {
    if (!p || p.valor === undefined || p.valor === null) return;
    const valStr = String(p.valor).trim();
    if (!valStr || valStr === "-" || valStr === "—" || valStr === "N/A" || valStr === "Falta" || valStr === "ALT" || valStr === "ORG") return;
    // Evita que un registro automático de "Falté a esta serie" (reps='Falta', peso='0') marque sesión realizada
    if (p.tipo === "peso" && Number(valStr) <= 0) return;
    const rId = ejToRutina[String(p.ejercicio_id)];
    if (!rId) return;
    // En la tabla `progreso`, `semana` se guarda como índice 0-based (wi = 0 -> Semana 1)
    const rawSem = Number(p.semana);
    const sem = Number.isFinite(rawSem) ? rawSem + 1 : 1;
    const sKey = `${rId}-${sem}`;
    if (!sessionKeys.has(sKey)) {
      sessionKeys.add(sKey);
      weeksWithWorkouts.add(sem);
      sessionsByWeek[sem] = (sessionsByWeek[sem] || 0) + 1;
    }
  });

  const maxWeekLogged = weeksWithWorkouts.size > 0 ? Math.max(...Array.from(weeksWithWorkouts)) : 0;
  let validWeeksEntreno = validWeeks.map((w) => ({ ...w }));
  if (maxWeekLogged > (validWeeksEntreno[validWeeksEntreno.length - 1]?.weekNum || 0)) {
    const existingNums = new Set(validWeeksEntreno.map((w) => w.weekNum));
    for (let w = 1; w <= maxWeekLogged; w++) {
      if (!existingNums.has(w)) {
        const found = semanasCalc.find((s) => s.weekNum === w);
        validWeeksEntreno.push(found || { weekNum: w, label: `Sem ${w}`, isCurrent: false });
      }
    }
    validWeeksEntreno.sort((a, b) => a.weekNum - b.weekNum);
  }

  const semanasActivas = Math.max(validWeeksEntreno.length, 1);
  let sesionesCompletadas = 0;
  const entrenoSemanas = [];
  if (daysAssigned > 0) {
    validWeeksEntreno.forEach((s) => {
      const done = Math.min(daysAssigned, sessionsByWeek[s.weekNum] || 0);
      sesionesCompletadas += done;
      entrenoSemanas.push({
        semana: s.weekNum,
        label: s.label || `Sem ${s.weekNum}`,
        completadas: done,
        esperadas: daysAssigned,
        pct: Math.min(100, Math.round((done / daysAssigned) * 100)),
      });
    });
  }
  const sesionesEsperadas = daysAssigned * semanasActivas;
  const pctEntreno = sesionesEsperadas > 0 ? Math.min(100, Math.round((sesionesCompletadas / sesionesEsperadas) * 100)) : 0;

  return {
    ciclo_evaluado_id: cicloEvaluado?.id || null,
    ciclo_evaluado_nombre: cicloNombre,
    capturado_en: new Date().toISOString(),
    nutricion: {
      hasPlan: diasList.length > 0,
      dias_asignados: diasList.length,
      dias_detalle: nutriDiasDetalle,
      dias_registrados: diasRegistrados,
      dias_totales: diasTotalesPeriodo,
      pct_comidas: pctComidas,
      comidas_realizadas: comidasRealizadas,
      comidas_total: totalComidas,
      pct_agua: pctAgua,
      promedio_agua_l: promedioAguaL,
      promedio_agua_activos_l: promedioAguaDiasActivosL,
      semanas: nutriSemanas,
    },
    entrenamiento: {
      hasPlan: daysAssigned > 0,
      dias_asignados: daysAssigned,
      dias_detalle: entrenoDiasDetalle,
      semanas_evaluadas: semanasActivas,
      sesiones_completadas: sesionesCompletadas,
      sesiones_esperadas: sesionesEsperadas,
      pct_cumplimiento: pctEntreno,
      semanas: entrenoSemanas,
    },
  };
}

export function ProgresoCliente({ selected, setMsg, isMiPlan, mode, cicloActivo, initialNutriDias, initialRutinas, isReadOnly: propReadOnly, onOpenCreatePlan }) {
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
  const [evalSexo,     setEvalSexo]     = useState(() => {
    const clin = peekClinicalRecord(selected?.id);
    return normalizeSexo(
      selected?.genero || selected?.sexo || clin?.anamnesis?.sexo || clin?.anamnesis?.genero
    );
  });
  const [evalEdad,     setEvalEdad]     = useState(() => {
    const clin = peekClinicalRecord(selected?.id);
    return calcEdadFromBirthdate(
      selected?.fecha_nacimiento || clin?.anamnesis?.fecha_nacimiento,
      Number(selected?.edad) || Number(clin?.anamnesis?.edad) || 25
    );
  });
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
  const [gKgDraft, setGKgDraft] = useState({ prot: null, fat: null, goalPct: null, goalSign: null });
  const [patientStepsHistory, setPatientStepsHistory] = useState({});
  const [aiAuditResult, setAiAuditResult] = useState(null);
  const [isAuditingAi, setIsAuditingAi] = useState(false);
  const [aiAuditError, setAiAuditError] = useState(null);
  const [customSmaeMap, setCustomSmaeMap] = useState(null);
  const [showStep5SmaeTable, setShowStep5SmaeTable] = useState(false);
  const [draggedSmaeId, setDraggedSmaeId] = useState(null);
  const [showSmaeBoardInFollowUp, setShowSmaeBoardInFollowUp] = useState(false);
  const [showFullR24hInFollowUp, setShowFullR24hInFollowUp] = useState(false);
  const [adherenceSnapshot, setAdherenceSnapshot] = useState(null);
  const [loadingAdherenceSnapshot, setLoadingAdherenceSnapshot] = useState(false);
  const [showFormulaPopover, setShowFormulaPopover] = useState(false);

  const getSmaeGroupPref = (groupId) => (form.smae_gustos && form.smae_gustos[groupId]) || "neutro";
  const setSmaeGroupPref = (groupId, pref) => {
    if (isReadOnly) return;
    setForm((prev) => {
      const next = { ...(prev.smae_gustos || {}) };
      if (!pref || pref === "neutro") {
        delete next[groupId];
      } else {
        next[groupId] = pref;
      }
      return { ...prev, smae_gustos: next };
    });
  };
  const resetAllSmaePrefs = () => {
    if (isReadOnly) return;
    setForm((prev) => ({ ...prev, smae_gustos: {} }));
  };
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

  const [promoteModal, setPromoteModal] = useState(null);

  const originalHasData = (ejId) => {
    return Object.keys(progreso).some(key => {
      if (key.startsWith(`${ejId}-`) && key.endsWith("-original")) {
        const val = progreso[key];
        if (val == null) return false;
        const str = String(val).trim().toUpperCase();
        return str !== "" && str !== "—" && str !== "-" && str !== "ALT" && str !== "ORG";
      }
      return false;
    });
  };

  const handleConfirmPromote = async () => {
    if (!promoteModal) return;
    const { rutina, ej, altIdx, alt, hasOrigData } = promoteModal;
    setPromoteModal(null);
    setLoading(true);
    try {
      const targetAltVid = `alt_${altIdx}`;

      const nextNombre = alt.nombre;
      const nextGrupo = alt.grupo_muscular || ej.grupo_muscular || "";
      const nextGif = alt.gif_url || "";
      const nextBibliotecaId = alt.biblioteca_id || null;

      let nextAlternativas = [];
      if (hasOrigData) {
        const oldMainAsAlt = {
          biblioteca_id: ej.biblioteca_id || null,
          nombre: ej.nombre,
          grupo_muscular: ej.grupo_muscular || "",
          gif_url: ej.gif_url || "",
          reps_sugeridas: ej.reps_sugeridas || 10,
          peso_sugerido: ej.peso_sugerido || "",
          unidad: ej.unidad || "kg"
        };
        nextAlternativas = (ej.alternativas || []).map((a, idx) => idx === altIdx ? oldMainAsAlt : a);
      } else {
        nextAlternativas = (ej.alternativas || []).filter((_, idx) => idx !== altIdx);
      }

      await dbPatch(`ejercicios?id=eq.${ej.id}`, {
        nombre: nextNombre,
        grupo_muscular: nextGrupo,
        gif_url: nextGif,
        biblioteca_id: nextBibliotecaId,
        alternativas: nextAlternativas
      });

      if (selected?.id) {
        if (hasOrigData) {
          await dbPatch(
            `progreso?cliente_id=eq.${selected.id}&ejercicio_id=eq.${ej.id}&variante_id=eq.original`,
            { variante_id: "temp_swap" }
          );
          await dbPatch(
            `progreso?cliente_id=eq.${selected.id}&ejercicio_id=eq.${ej.id}&variante_id=eq.${targetAltVid}`,
            { variante_id: "original" }
          );
          await dbPatch(
            `progreso?cliente_id=eq.${selected.id}&ejercicio_id=eq.${ej.id}&variante_id=eq.temp_swap`,
            { variante_id: targetAltVid }
          );
        } else {
          await dbDel(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=eq.${ej.id}&variante_id=eq.original`).catch(() => {});
          await dbPatch(
            `progreso?cliente_id=eq.${selected.id}&ejercicio_id=eq.${ej.id}&variante_id=eq.${targetAltVid}`,
            { variante_id: "original" }
          );
          const origAlts = ej.alternativas || [];
          for (let i = altIdx + 1; i < origAlts.length; i++) {
            await dbPatch(
              `progreso?cliente_id=eq.${selected.id}&ejercicio_id=eq.${ej.id}&variante_id=eq.alt_${i}`,
              { variante_id: `alt_${i - 1}` }
            ).catch(() => {});
          }
        }
      }

      setRutinas(prev => prev.map(r => {
        if (r.id !== rutina.id) return r;
        return {
          ...r,
          ejercicios: (r.ejercicios || []).map(e => {
            if (e.id !== ej.id) return e;
            return {
              ...e,
              nombre: nextNombre,
              grupo_muscular: nextGrupo,
              gif_url: nextGif,
              biblioteca_id: nextBibliotecaId,
              alternativas: nextAlternativas
            };
          })
        };
      }));

      invalidateCache("progreso");
      invalidateCache("rutinas");
      invalidateCache("ejercicios");

      await loadCicloData(cicloSel, true);
      setMsg(<div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Ejercicio promovido a principal exitosamente</div>);
    } catch (err) {
      console.error("Error al promover ejercicio:", err);
      setMsg("❌ Error al promover ejercicio: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    let alive = true;
    if (!selected?.id) {
      setPatientStepsHistory({});
      return;
    }
    fetchCloudSteps(selected.id, 14).then((hist) => {
      if (alive) setPatientStepsHistory(hist || {});
    });
    return () => { alive = false; };
  }, [selected?.id, showModal]);

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
  const canEditTracking = !(propReadOnly ?? Boolean(currentCiclo && !currentCiclo.activo));

  const [nutriEditModal, setNutriEditModal] = useState(null);
  const [rutinaEditModal, setRutinaEditModal] = useState(null);
  const [savingTracking, setSavingTracking] = useState(false);

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
  useBackButton(!!nutriEditModal, () => !savingTracking && setNutriEditModal(null), 60);
  useBackButton(!!rutinaEditModal, () => !savingTracking && setRutinaEditModal(null), 60);
  useBackButton(showModal, () => setShowModal(false), 20);
  useBackButton(showExpediente, () => setShowExpediente(false), 25);

  const openNutriEditCell = useCallback((dia, semanaObj) => {
    if (!canEditTracking || !dia || !semanaObj) return;
    const r = nutriProgreso[`${dia.id}-${semanaObj.weekNum}`];
    const existingMap = (r && typeof r.comidas_done === "object" && r.comidas_done !== null) ? r.comidas_done : {};
    const initialDone = {};
    (dia.comidas || []).forEach((c, ci) => {
      const key = c.id || String(ci);
      initialDone[key] = Boolean(
        (c.id && existingMap[c.id]) ||
        existingMap[ci] ||
        existingMap[String(ci)] ||
        (c.orden != null && existingMap[c.orden])
      );
    });
    const aguaMl = Number(r?.agua_ml) || 0;
    setNutriEditModal({
      dia,
      semanaObj,
      comidasDone: initialDone,
      aguaLitros: aguaMl > 0 ? String(Number((aguaMl / 1000).toFixed(2))) : "",
    });
  }, [canEditTracking, nutriProgreso]);

  const handleSaveNutriTracking = async () => {
    if (!nutriEditModal || !selected?.id || savingTracking) return;
    setSavingTracking(true);
    try {
      const { dia, semanaObj, comidasDone, aguaLitros } = nutriEditModal;
      const weekNum = Number(semanaObj.weekNum) || 1;
      const comidasList = dia.comidas || [];
      const existingRec = nutriProgreso[`${dia.id}-${weekNum}`];

      const comidasDonePayload = {};
      let doneCount = 0;
      comidasList.forEach((c, ci) => {
        const key = c.id || String(ci);
        const isDone = Boolean(comidasDone?.[key]);
        if (isDone) doneCount++;
        comidasDonePayload[ci] = isDone;
        comidasDonePayload[String(ci)] = isDone;
        if (c.id) comidasDonePayload[c.id] = isDone;
        if (c.orden != null) comidasDonePayload[c.orden] = isDone;
      });

      const litrosNum = parseFloat(String(aguaLitros || "0").replace(",", "."));
      const aguaMl = Math.max(0, Math.round((isNaN(litrosNum) ? 0 : litrosNum) * 1000));
      const metaAguaMl = Number(existingRec?.meta_agua_ml) ||
        (selected?.peso ? Math.round((parseFloat(selected.peso) * 35) / 50) * 50 : 2500);

      const record = {
        cliente_id: selected.id,
        dia_id: dia.id,
        semana: weekNum,
        agua_ml: aguaMl,
        meta_agua_ml: metaAguaMl,
        comidas_done: comidasDonePayload,
        comidas_realizadas: doneCount,
        total_comidas: comidasList.length,
        updated_at: new Date().toISOString(),
      };

      await dbUpsert("nutricion_progreso?on_conflict=cliente_id,dia_id,semana", [record], {
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      });

      const mapKey = `${dia.id}-${weekNum}`;
      setNutriProgreso((prev) => ({ ...prev, [mapKey]: record }));

      try {
        localStorage.setItem(
          `flux_nutri_habits_${selected.id}_s${weekNum}_dia_${dia.id}`,
          JSON.stringify({ agua: aguaMl, comidasDone: comidasDonePayload })
        );
      } catch {}

      window.dispatchEvent(new CustomEvent("flux:plan-updated", { detail: { clienteId: selected.id } }));
      setNutriEditModal(null);
      setMsg(
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Registro nutricional actualizado</span>
        </div>
      );
    } catch (err) {
      console.error("Error guardando tracking nutricional:", err);
      setMsg("❌ Error al guardar tracking nutricional: " + (err?.message || err));
    } finally {
      setSavingTracking(false);
    }
  };

  const openRutinaEditCell = useCallback(({ rutina, ej, exObj, vid, si, wi, semanaLabel, focusField = "peso" }) => {
    if (!canEditTracking || !ej) return;
    const pVal = progreso[`${ej.id}-${wi}-${si}-peso-${vid}`] || "";
    const rVal = progreso[`${ej.id}-${wi}-${si}-reps-${vid}`] || "";
    const isFalta = rVal === "Falta";
    const formattedPeso = (!isFalta && pVal) ? formatTrackingWeight(pVal, trackingWeightUnit) : "";
    setRutinaEditModal({
      rutina,
      ej,
      exObj,
      vid: vid || "original",
      si,
      wi,
      semanaLabel,
      pesoInput: formattedPeso === "—" ? "" : formattedPeso,
      repsInput: isFalta ? "" : (rVal === "—" ? "" : String(rVal)),
      isFalta,
      unit: trackingWeightUnit,
      focusField,
    });
  }, [canEditTracking, progreso, trackingWeightUnit]);

  const handleSaveRutinaTracking = async (modeOverride = null) => {
    if (!rutinaEditModal || !selected?.id || savingTracking) return;
    setSavingTracking(true);
    try {
      const { ej, vid, si, wi, pesoInput, repsInput, unit } = rutinaEditModal;
      const markFalta = modeOverride === "falta" ? true : (modeOverride === "clear" ? false : rutinaEditModal.isFalta);
      const isClear = modeOverride === "clear";

      let dbPeso = "";
      let dbReps = "";

      if (isClear) {
        dbPeso = "";
        dbReps = "";
      } else if (markFalta) {
        dbPeso = "0";
        dbReps = "Falta";
      } else {
        const cleanPeso = String(pesoInput ?? "").trim().replace(",", ".");
        if (cleanPeso !== "") {
          const parsed = parseFloat(cleanPeso);
          if (!isNaN(parsed)) {
            dbPeso = unit === "lb" ? (parsed * 0.45359237).toFixed(4) : String(parsed);
          }
        }
        dbReps = String(repsInput ?? "").trim();
      }

      const nowIso = new Date().toISOString();
      const records = [
        {
          ejercicio_id: ej.id,
          cliente_id: selected.id,
          semana: parseInt(wi, 10),
          serie: parseInt(si, 10),
          tipo: "peso",
          valor: dbPeso,
          variante_id: vid || "original",
          updated_at: nowIso,
        },
        {
          ejercicio_id: ej.id,
          cliente_id: selected.id,
          semana: parseInt(wi, 10),
          serie: parseInt(si, 10),
          tipo: "reps",
          valor: dbReps,
          variante_id: vid || "original",
          updated_at: nowIso,
        },
      ];

      try {
        await dbUpsert(
          "progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo,variante_id",
          records,
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
          await dbUpsert(
            "progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo",
            records,
            { headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }
          );
        } else {
          throw err;
        }
      }

      const vKey = vid || "original";
      setProgreso((prev) => ({
        ...prev,
        [`${ej.id}-${wi}-${si}-peso-${vKey}`]: dbPeso,
        [`${ej.id}-${wi}-${si}-reps-${vKey}`]: dbReps,
      }));

      window.dispatchEvent(new CustomEvent("flux:plan-updated", { detail: { clienteId: selected.id } }));
      setRutinaEditModal(null);
      setMsg(
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{isClear ? "Serie limpiada" : "Registro de serie actualizado"}</span>
        </div>
      );
    } catch (err) {
      console.error("Error guardando tracking de rutina:", err);
      setMsg("❌ Error al guardar tracking de rutina: " + (err?.message || err));
    } finally {
      setSavingTracking(false);
    }
  };

  const loadCicloData = useCallback(async (ciclo, force = false) => {
    if (!selected) return;
    const cicloFiltro = ciclo ? `ciclo_id=eq.${ciclo.id}` : `ciclo_id=is.null`;

    // 1. Rutinas y progreso de pesas (solo si mode no es "nutricion")
    if (mode !== "nutricion") {
      let rsFull = (!force && Array.isArray(initialRutinas) && initialRutinas.length > 0) ? initialRutinas : null;
      if (!rsFull) {
        const rs = await (force ? dbGetFresh : dbGet)(`rutinas?cliente_id=eq.${selected.id}&${cicloFiltro}&select=*,ejercicios(*)&order=orden.asc`).catch(() => []);
        rsFull = await Promise.all((rs || []).map(async (r) => {
          const ejs = Array.isArray(r.ejercicios)
            ? [...r.ejercicios].sort((a, b) => (a.orden || 0) - (b.orden || 0))
            : await (force ? dbGetFresh : dbGet)(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`).catch(() => []);
          return { ...r, ejercicios: ejs };
        }));
        setRutinas(rsFull);
      }

      const allIds = rsFull.flatMap(r => (r.ejercicios || []).map(e => e.id));
      if (allIds.length) {
        const ps = await (force ? dbGetFresh : dbGet)(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=in.(${allIds.join(",")})&limit=3000`).catch(() => []);
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
  }, [selected?.id]);

  useEffect(() => {
    const anam = clinicalRec?.anamnesis || peekClinicalRecord(selected?.id)?.anamnesis || {};
    setEvalSexo(
      normalizeSexo(
        anam?.sexo || anam?.genero || selected?.genero || selected?.sexo
      )
    );
    setEvalEdad(
      calcEdadFromBirthdate(
        anam?.fecha_nacimiento || selected?.fecha_nacimiento,
        Number(selected?.edad) || Number(anam?.edad) || 25
      )
    );
  }, [
    selected?.id,
    selected?.genero,
    selected?.sexo,
    selected?.fecha_nacimiento,
    selected?.edad,
    clinicalRec?.anamnesis?.sexo,
    clinicalRec?.anamnesis?.genero,
    clinicalRec?.anamnesis?.fecha_nacimiento,
    clinicalRec?.anamnesis?.edad,
  ]);

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

  const fetchFreshAdherenceSnapshot = useCallback(async (targetCicloObj) => {
    if (!selected?.id) return;
    setLoadingAdherenceSnapshot(true);
    try {
      const fetchCicloResources = async (cObj) => {
        const cFilter = cObj?.id ? `ciclo_id=eq.${cObj.id}` : `ciclo_id=is.null`;
        const [ns, rs] = await Promise.all([
          dbGetFresh(`nutricion?cliente_id=eq.${selected.id}&${cFilter}`).catch(() => []),
          dbGetFresh(`rutinas?cliente_id=eq.${selected.id}&${cFilter}&select=*,ejercicios(*)&order=orden.asc`).catch(() => []),
        ]);

        let ds = [];
        if (Array.isArray(ns) && ns.length > 0) {
          const rawDs = await dbGetFresh(`nutricion_dias?nutricion_id=eq.${ns[0].id}&select=*,comidas(*)&order=orden.asc`).catch(() => []);
          ds = (rawDs || []).map((d) => ({
            ...d,
            comidas: (d.comidas || []).sort((a, b) => (a.orden || 0) - (b.orden || 0)),
          }));
        }

        const rsFull = Array.isArray(rs) ? rs : [];
        const allEjIds = rsFull.flatMap((r) => (r.ejercicios || []).map((e) => e.id)).filter(Boolean);
        let ps = [];
        if (allEjIds.length > 0) {
          ps = await dbGetFresh(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=in.(${allEjIds.join(",")})&limit=3000`).catch(() => []);
        }
        return { ds: ds || [], rs: rsFull, ps: ps || [] };
      };

      const npRows = await dbGetFresh(`nutricion_progreso?cliente_id=eq.${selected.id}&limit=1000`).catch(() => []);
      const validNp = Array.isArray(npRows) ? npRows : [];

      const currentRes = await fetchCicloResources(targetCicloObj);
      const currDiaIds = new Set(currentRes.ds.map((d) => String(d.id)));
      const currHasNutriActivity = validNp.some((r) => {
        if (!r || r.dia_id == null || !currDiaIds.has(String(r.dia_id))) return false;
        const hasDoneObj = r.comidas_done && typeof r.comidas_done === "object" && Object.values(r.comidas_done).some(Boolean);
        return hasDoneObj || (Number(r.comidas_realizadas) || 0) > 0 || (Number(r.agua_ml) || 0) > 0;
      });
      const currHasEntrenoActivity = currentRes.ps.some((p) => p && p.valor !== undefined && p.valor !== null && p.valor !== "");

      let cicloEvaluado = targetCicloObj;
      let chosenRes = currentRes;

      // Si el ciclo actual recién se creó (0 actividad) y existe un ciclo previo, evaluamos el ciclo inmediato anterior con datos
      if (!currHasNutriActivity && !currHasEntrenoActivity) {
        const allCiclos = await dbGetFresh(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`).catch(() => ciclos || []);
        const list = Array.isArray(allCiclos) && allCiclos.length > 0 ? allCiclos : (ciclos || []);
        const prevCandidates = list.filter((c) => String(c.id) !== String(targetCicloObj?.id));
        for (const cand of prevCandidates) {
          const candRes = await fetchCicloResources(cand);
          if (candRes.ds.length > 0 || candRes.rs.length > 0) {
            cicloEvaluado = cand;
            chosenRes = candRes;
            break;
          }
          if (!cicloEvaluado || String(cicloEvaluado.id) === String(targetCicloObj?.id)) {
            cicloEvaluado = cand;
            chosenRes = candRes;
          }
        }
      }

      const snapshot = buildAdherenceSnapshot({
        cicloEvaluado,
        nutriDiasCiclo: chosenRes.ds,
        nutriProgresoRows: validNp,
        rutinasCiclo: chosenRes.rs,
        progresoRows: chosenRes.ps,
      });

      setAdherenceSnapshot(snapshot);
      let historicalTrainingDays = snapshot?.entrenamiento?.dias_asignados || countActiveRoutineDays(chosenRes.rs);
      if (historicalTrainingDays === 0) {
        const latestRutinas = await dbGetFresh(
          `rutinas?cliente_id=eq.${selected.id}&select=id,nombre,ciclo_id&order=created_at.desc&limit=40`
        ).catch(() => []);
        if (Array.isArray(latestRutinas) && latestRutinas.length > 0) {
          const latestCicloId = latestRutinas[0]?.ciclo_id ?? null;
          const sameCycleRutinas = latestRutinas.filter(
            (r) => String(r.ciclo_id ?? "") === String(latestCicloId ?? "")
          );
          historicalTrainingDays = countActiveRoutineDays(sameCycleRutinas);
        }
      }
      if (historicalTrainingDays > 0) {
        setForm((prev) => ({
          ...prev,
          dias_ejercicio_actual: prev.dias_ejercicio_actual || String(historicalTrainingDays),
        }));
      }
    } catch (err) {
      console.warn("Error consultando snapshot de adherencia:", err);
    } finally {
      setLoadingAdherenceSnapshot(false);
    }
  }, [selected?.id, ciclos]);

  const openNewEvaluation = useCallback((explicitCiclo = null) => {
    const base = emptyForm();
    const targetCiclo = explicitCiclo || cicloActivo || cicloSel;
    if (targetCiclo?.id) {
      base.ciclo_id = targetCiclo.id;
    }
    base.metodo_evaluacion = isCivil ? "basico" : "basico";

    // Objetivo, FAF y días actuales según datos actuales del cliente o entrenamiento activo
    const fallbackGoal = inferGoalFromText(selected?.objetivo || targetCiclo?.nombre || "");
    const matchesLoadedCycle = !explicitCiclo || String(explicitCiclo.id) === String((cicloActivo || cicloSel)?.id || "");
    const trainingDays = matchesLoadedCycle ? countActiveRoutineDays(rutinas) : 0;
    let calculatedFaf = null;
    if (trainingDays > 0) {
      if (trainingDays <= 1) calculatedFaf = 1.2;
      else if (trainingDays <= 3) calculatedFaf = 1.375;
      else if (trainingDays <= 5) calculatedFaf = 1.55;
      else calculatedFaf = 1.725;
      base.dias_ejercicio_actual = String(trainingDays);
    }
    base.eval_objetivo = fallbackGoal || "recomposicion";
    base.eval_faf = String(calculatedFaf || 1.375);
    base.eval_faf_notas = "";
    base.eval_semanas_objetivo = String(cycleInfo.semanas || 4);
    base.eval_meta_pasos = String(DEFAULT_STEP_GOAL);

    const latestPrev = (allLinkedMetricas && allLinkedMetricas[0]) || (metricas && metricas[0]) || null;
    if (latestPrev?.estatura) {
      base.estatura = String(latestPrev.estatura);
    }
    if (latestPrev?.metodo_evaluacion) {
      base.metodo_evaluacion = latestPrev.metodo_evaluacion;
    }
    if (latestPrev?.smae_gustos && typeof latestPrev.smae_gustos === "object") {
      base.smae_gustos = { ...latestPrev.smae_gustos };
    }
    if (latestPrev?.preferencias_alimentos) {
      base.preferencias_alimentos = latestPrev.preferencias_alimentos;
    }
    if (latestPrev?.aversiones_alimentos) {
      base.aversiones_alimentos = latestPrev.aversiones_alimentos;
    }

    if (latestPrev) {
      if (latestPrev.eval_meta_pasos) {
        base.eval_meta_pasos = String(latestPrev.eval_meta_pasos);
      }
    }

    const clin = clinicalRec || peekClinicalRecord(selected?.id);
    setEvalSexo(normalizeSexo(selected?.genero || selected?.sexo || clin?.anamnesis?.genero));
    setEvalEdad(calcEdadFromBirthdate(selected?.fecha_nacimiento || clin?.anamnesis?.fecha_nacimiento, 25));
    setForm(base);
    setShowSmaeBoardInFollowUp(false);
    setShowFullR24hInFollowUp(false);
    setShowFormulaPopover(false);
    setAdherenceSnapshot(null);
    if (latestPrev) {
      fetchFreshAdherenceSnapshot(targetCiclo);
    }
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
  }, [isCivil, cicloActivo, cicloSel, selected?.objetivo, selected?.genero, selected?.sexo, selected?.fecha_nacimiento, clinicalRec, rutinas, allLinkedMetricas, metricas, cycleInfo.semanas, fetchFreshAdherenceSnapshot, selected?.id]);

  const showModalRef = useRef(false);
  useEffect(() => {
    showModalRef.current = showModal;
  }, [showModal]);

  const handleTriggerCreatePlan = useCallback(() => {
    if (typeof onOpenCreatePlan === "function") {
      onOpenCreatePlan();
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("flux:request-create-plan", { detail: { clienteId: selected?.id } })
      );
    }
  }, [onOpenCreatePlan, selected?.id]);

  const lastOpenEventTsRef = useRef(0);
  useEffect(() => {
    const handleOpen = (ev) => {
      const explicitCiclo = ev?.detail?.ciclo;
      const targetClienteId = ev?.detail?.clienteId || explicitCiclo?.cliente_id;
      if (targetClienteId && selected?.id && String(targetClienteId) !== String(selected.id)) return;

      const now = Date.now();
      if (now - lastOpenEventTsRef.current < 250) return;
      lastOpenEventTsRef.current = now;

      // Si el modal de evaluación YA está abierto (ej. el nutriólogo creó un Nuevo Plan desde el Paso 5),
      // conservamos el 100% de los datos capturados y vinculamos esta evaluación como 1ª evaluación del nuevo plan.
      if (showModalRef.current && explicitCiclo?.id) {
        setCiclos((prev) => [
          explicitCiclo,
          ...(Array.isArray(prev) ? prev : [])
            .filter((c) => String(c.id) !== String(explicitCiclo.id))
            .map((c) => ({ ...c, activo: false })),
        ]);
        setCicloSel(explicitCiclo);
        const parts = String(explicitCiclo.nombre || "").split("|");
        const newWeeks = Math.max(1, parseInt(parts[1], 10) || 4);
        const newEnfoque = (parts[4] || "").trim();
        setForm((prev) => ({
          ...prev,
          ciclo_id: explicitCiclo.id,
          eval_semanas_objetivo: String(newWeeks),
          ...(newEnfoque ? { eval_objetivo: inferGoalFromText(newEnfoque) } : {}),
        }));
        if (setMsg) {
          setMsg(
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Nuevo plan vinculado · Los datos capturados pasaron a la 1ª evaluación del nuevo plan</span>
            </div>
          );
        }
        return;
      }

      openNewEvaluation(explicitCiclo);
    };
    window.addEventListener("flux:open-new-evaluation", handleOpen);
    window.addEventListener("flux:open-checkin", handleOpen);
    return () => {
      window.removeEventListener("flux:open-new-evaluation", handleOpen);
      window.removeEventListener("flux:open-checkin", handleOpen);
    };
  }, [openNewEvaluation, selected?.id, setMsg]);

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
    if (
      (key === "eval_tmb_formula" || key === "eval_faf" || key === "eval_objetivo") &&
      String(form[key] || "") !== String(val || "")
    ) {
      setAiAuditResult(null);
      if (prescriptionMode === "ia") {
        setPrescriptionMode("matematico");
      }
    }
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

  const hasDefinedSexo = Boolean(
    selected?.genero ||
      selected?.sexo ||
      clinicalRec?.anamnesis?.sexo ||
      clinicalRec?.anamnesis?.genero ||
      form?.sexo
  );
  const hasDefinedEdad = Boolean(
    selected?.fecha_nacimiento ||
      clinicalRec?.anamnesis?.fecha_nacimiento ||
      selected?.edad ||
      clinicalRec?.anamnesis?.edad ||
      form?.edad
  );

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
      cliente: {
        ...selected,
        genero: evalSexo === "F" ? "Femenino" : "Masculino",
        edad: evalEdad,
        hasDefinedSexo,
      },
      metrica: enrichedDraft,
      clinicalRec,
      ciclo: currentCiclo,
    });
  }, [form, liveCalculations, selected, evalSexo, evalEdad, hasDefinedSexo, clinicalRec, currentCiclo]);

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

      // Diametros óseos (cm)
      const diamArr = [];
      if (form.diametro_muneca) diamArr.push(`Muñeca: ${form.diametro_muneca} cm`);
      if (form.diametro_codo) diamArr.push(`Codo: ${form.diametro_codo} cm`);
      if (form.diametro_rodilla) diamArr.push(`Rodilla: ${form.diametro_rodilla} cm`);
      const diamStr = diamArr.join(", ");

      // Gustos por grupo SMAE (Paso 2)
      const smaePrefList = [];
      const smaeAvoidList = [];
      if (form.smae_gustos && typeof form.smae_gustos === "object") {
        Object.entries(form.smae_gustos).forEach(([gId, pref]) => {
          const grp = SMAE_GROUPS.find((g) => g.id === gId);
          const lbl = grp ? grp.shortLabel || grp.label : gId;
          if (pref === "favorito" || pref === "prefiere") smaePrefList.push(lbl);
          else if (pref === "evitar" || pref === "no_gusta") smaeAvoidList.push(lbl);
        });
      }
      const smaeGustosStr = [
        smaePrefList.length > 0 ? `Grupos preferidos: ${smaePrefList.join(", ")}` : "",
        smaeAvoidList.length > 0 ? `Grupos a evitar: ${smaeAvoidList.join(", ")}` : "",
      ].filter(Boolean).join(" | ");

      // Evolución contra evaluación previa (si es seguimiento)
      const evalList = (allLinkedMetricas && allLinkedMetricas.length > 0) ? allLinkedMetricas : metricas;
      const prevEval = !editingId
        ? (evalList[0] || null)
        : (() => {
            const idx = evalList.findIndex((x) => String(x?.id) === String(editingId));
            return idx >= 0 ? (evalList[idx + 1] || null) : null;
          })();

      const curPesoNum = parseFloat(form.peso || selected?.peso) || 0;
      const curGrasaNum = parseFloat(liveCalculations.grasa_pct || form.grasa_pct) || 0;
      const curMlgNum = parseFloat(liveCalculations.masa_libre_grasa) || 0;
      const curCinturaNum = parseFloat(form.cintura) || 0;

      const evolucionPrevia = (!isFirstEvaluationEver && prevEval) ? {
        fechaPrevia: prevEval.fecha || "",
        pesoPrevio: prevEval.peso || "",
        deltaPeso: (curPesoNum > 0 && parseFloat(prevEval.peso) > 0)
          ? (curPesoNum - parseFloat(prevEval.peso)).toFixed(2)
          : null,
        grasaPrevia: prevEval.grasa_pct || "",
        deltaGrasa: (curGrasaNum > 0 && parseFloat(prevEval.grasa_pct) > 0)
          ? (curGrasaNum - parseFloat(prevEval.grasa_pct)).toFixed(1)
          : null,
        mlgPrevia: prevEval.masa_libre_grasa || "",
        deltaMlg: (curMlgNum > 0 && parseFloat(prevEval.masa_libre_grasa) > 0)
          ? (curMlgNum - parseFloat(prevEval.masa_libre_grasa)).toFixed(2)
          : null,
        cinturaPrevia: prevEval.cintura || "",
        deltaCintura: (curCinturaNum > 0 && parseFloat(prevEval.cintura) > 0)
          ? (curCinturaNum - parseFloat(prevEval.cintura)).toFixed(1)
          : null,
        kcalPrevias: prevEval.prescribed_macros?.targetKcal || prevEval.ai_audit_result?.targetKcal || "",
      } : null;

      // Adherencia real medida en la app (Seguimiento)
      const entSnap = adherenceSnapshot?.entrenamiento;
      const nutSnap = adherenceSnapshot?.nutricion;
      const adherenciaEntrenoStr = entSnap?.tiene_plan
        ? `Cumplimiento global: ${entSnap.cumplimiento_pct ?? 0}% (${entSnap.semanas_cumplidas || 0}/${entSnap.semanas_evaluadas || 0} semanas; días asignados: ${(entSnap.dias_asignados || []).join(", ") || "N/A"})${
            Array.isArray(entSnap.por_semana) && entSnap.por_semana.length > 0
              ? ` · Desglose semanal: ${entSnap.por_semana.map((w) => `S${w.semana}: ${w.pct}%`).join(", ")}`
              : ""
          }`
        : "";
      const adherenciaNutriStr = nutSnap?.tiene_plan
        ? `Comidas cumplidas: ${nutSnap.comidas_pct ?? 0}% (${
            Array.isArray(nutSnap.por_semana) && nutSnap.por_semana.length > 0
              ? nutSnap.por_semana.map((w) => `S${w.semana}: ${w.comidas_pct}%`).join(", ")
              : "sin desglose"
          }) | Hidratación: ${nutSnap.agua_pct ?? 0}% (promedio ${((nutSnap.agua_promedio_ml || 0) / 1000).toFixed(1)} L/día de ${((nutSnap.agua_meta_ml || 0) / 1000).toFixed(1)} L meta${
            Array.isArray(nutSnap.por_semana) && nutSnap.por_semana.length > 0
              ? `; por semana: ${nutSnap.por_semana.map((w) => `S${w.semana}: ${w.agua_pct ?? 0}% (${((w.agua_promedio_ml || 0) / 1000).toFixed(1)}L)`).join(", ")}`
              : ""
          })`
        : "";

      const res = await auditMacroPrescriptionWithAi({
        cliente: { ...selected, genero: evalSexo === "F" ? "Femenino" : "Masculino", edad: evalEdad },
        anamnesis: clinicalRec?.anamnesis || {},
        metrica: {
          ...form,
          ...liveCalculations,
          es_seguimiento: !isFirstEvaluationEver,
          tipo_consulta: isFirstEvaluationEver ? "1ª Evaluación Inicial" : "Evaluación de Seguimiento",
          evolucion_previa: evolucionPrevia,
          peso: form.peso || selected?.peso || "",
          estatura: form.estatura || selected?.estatura || "",
          imc: liveCalculations.imc || form.imc || "",
          imc_clasificacion: liveCalculations.imc_info?.label || "",
          grasa_pct: liveCalculations.grasa_pct || form.grasa_pct || "",
          masa_grasa_kg: liveCalculations.calc_masa_grasa || form.calc_masa_grasa || "",
          masa_libre_grasa: liveCalculations.masa_libre_grasa || "",
          masa_muscular_kg: liveCalculations.calc_masa_muscular || form.calc_masa_muscular || form.inbody_smm || "",
          masa_osea_kg: liveCalculations.calc_masa_osea || form.calc_masa_osea || form.inbody_mineral_oseo || "",
          masa_residual_kg: liveCalculations.calc_masa_residual || form.calc_masa_residual || "",
          icc: liveCalculations.icc || form.icc || "",
          icc_riesgo: liveCalculations.icc_info?.label || "",
          ice: liveCalculations.ice || "",
          somatotipo_str:
            liveCalculations.somatotipo_endo && liveCalculations.somatotipo_meso && liveCalculations.somatotipo_ecto
              ? `Endomorfo ${liveCalculations.somatotipo_endo} · Mesomorfo ${liveCalculations.somatotipo_meso} · Ectomorfo ${liveCalculations.somatotipo_ecto}`
              : "",
          pliegues_str: plieguesStr,
          sum_pliegues: liveCalculations.sum_pliegues || "",
          circunferencias_str: circStr,
          diametros_str: diamStr,
          inbody_bmr: form.inbody_bmr || "",
          inbody_grasa_visceral: form.inbody_grasa_visceral || "",
          inbody_tbw: form.inbody_tbw || "",
          inbody_proteina: form.inbody_proteina || "",
          inbody_score: form.inbody_score || "",
          glucosa: form.glucosa || "",
          presion_arterial: form.presion_arterial || "",
          notas_clinicas: form.notas || "",
          metodo_label: getMetodoLabel(form.metodo_evaluacion),
          sexo: evalSexo,
          edad: evalEdad,
        },
        r24h: {
          desayuno: form.r24h_desayuno || liveSmartMacros.contextoClinico?.r24h?.desayuno || "",
          colacion_m: form.r24h_colacion_m || liveSmartMacros.contextoClinico?.r24h?.colacion_m || "",
          comida: form.r24h_comida || liveSmartMacros.contextoClinico?.r24h?.comida || "",
          colacion_v: form.r24h_colacion_v || liveSmartMacros.contextoClinico?.r24h?.colacion_v || "",
          cena: form.r24h_cena || liveSmartMacros.contextoClinico?.r24h?.cena || "",
          picoteos: form.r24h_picoteos || liveSmartMacros.contextoClinico?.r24h?.picoteos || "",
        },
        habitos: {
          ...(liveSmartMacros.contextoClinico?.habitos || {}),
          horas_sueno: form.horas_sueno || liveSmartMacros.contextoClinico?.habitos?.horas_sueno || "7.5",
          dias_ejercicio_actuales: form.dias_ejercicio_actual || liveSmartMacros.contextoClinico?.habitos?.dias_ejercicio_actuales || "0",
          horario_ejercicio: form.horario_ejercicio || prevEvalHorario || "No especificado",
          checkin_energia: form.checkin_energia || 4,
          checkin_saciedad: form.checkin_saciedad || 4,
          checkin_digestion: form.checkin_digestion || 4,
          checkin_descanso: form.checkin_descanso || 4,
          nivel_estres: form.nivel_estres || 3,
          checkin_observaciones: form.checkin_observaciones || "",
          checkin_ajustes: form.checkin_ajustes || "",
          adherencia_entrenamiento: adherenciaEntrenoStr,
          adherencia_nutricion: adherenciaNutriStr,
          faf_proyectado_etapa: liveSmartMacros.fafInfo?.label || "Moderado (3 a 5 días/semana)",
          faf_notas: form.eval_faf_notas || "",
          pasos_promedio_7d: patientStepsStats?.avg || 0,
          meta_pasos_diarios: form.eval_meta_pasos || DEFAULT_STEP_GOAL,
          plan_meta_peso: liveWeightGoalPlan
            ? `Meta: ${form.eval_peso_objetivo} kg en ${form.eval_semanas_objetivo || 4} semanas (${liveWeightGoalPlan.message})`
            : "",
        },
        calcMatematico: {
          formulaLabel: liveSmartMacros.formulaLabel,
          formulaShort: liveSmartMacros.formulaShort,
          formulaMode: liveSmartMacros.formulaMode,
          tmbSubstituted: liveSmartMacros.tmbSubstituted,
          recommendationReason: liveSmartMacros.recommendationReason,
          manualComparisonNote: liveSmartMacros.manualComparisonNote,
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
        preferencias: [
          form.preferencias_alimentos || liveSmartMacros.contextoClinico?.preferencias || clinicalRec?.anamnesis?.preferencias_alimentos || "",
          smaeGustosStr,
        ].filter(Boolean).join(" · "),
        aversiones: form.aversiones_alimentos || liveSmartMacros.contextoClinico?.aversiones || clinicalRec?.anamnesis?.aversiones_alimentos || "",
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

  const routineDaysCount = useMemo(() => countActiveRoutineDays(rutinas), [rutinas]);

  const suggestedFafFromTraining = useMemo(() => {
    const days = routineDaysCount > 0
      ? routineDaysCount
      : (parseInt(form.dias_ejercicio_actual, 10) || 0);

    if (days <= 1) return { value: 1.2, days, label: days === 0 ? "0–1 día (Sedentario)" : "1 día programado (Sedentario)" };
    if (days <= 3) return { value: 1.375, days, label: `${days} días programados (Ligero)` };
    if (days <= 5) return { value: 1.55, days, label: `${days} días programados (Moderado)` };
    return { value: 1.725, days, label: `${days} días programados (Activo/Intenso)` };
  }, [routineDaysCount, form.dias_ejercicio_actual]);

  const patientStepsStats = useMemo(
    () => averageSteps(patientStepsHistory, 7, false),
    [patientStepsHistory]
  );

  const neatFafSuggestion = useMemo(() => {
    if (!patientStepsStats || patientStepsStats.avg <= 0) return null;
    return suggestFafWithSteps({
      avgSteps: patientStepsStats.avg,
      trainingFaf: suggestedFafFromTraining.days > 0 ? suggestedFafFromTraining.value : null,
    });
  }, [patientStepsStats, suggestedFafFromTraining]);

  const evalCiclo = useMemo(() => {
    if (form.ciclo_id && Array.isArray(ciclos) && ciclos.length > 0) {
      const found = ciclos.find((c) => String(c.id) === String(form.ciclo_id));
      if (found) return found;
    }
    return currentCiclo || null;
  }, [form.ciclo_id, ciclos, currentCiclo]);

  const planTimeStatus = useMemo(() => {
    if (!evalCiclo) {
      return {
        hasPlan: false,
        isExpired: true,
        remainingWeeks: 0,
        totalWeeks: 0,
        elapsedWeeks: 0,
        planTitle: "Sin plan activo",
        badgeText: "Sin plan",
        statusText: "No hay un plan activo configurado",
        endDateLabel: "",
      };
    }
    const parts = String(evalCiclo.nombre || "").split("|");
    const planTitle = (parts[0] || "Plan actual").trim();
    const totalWeeks = Math.max(1, parseInt(parts[1], 10) || 4);
    const totalDays = Math.max(1, parseInt(parts[3], 10) || totalWeeks * 7);
    const startNoon = parseLocalDateNoon(evalCiclo.fecha_inicio);
    const evalNoon =
      parseLocalDateNoon(form.fecha) ||
      parseLocalDateNoon(new Date().toISOString().split("T")[0]);

    if (!startNoon || !evalNoon) {
      return {
        hasPlan: true,
        isExpired: false,
        remainingWeeks: totalWeeks,
        totalWeeks,
        elapsedWeeks: 0,
        planTitle,
        badgeText: `Plan de ${totalWeeks} sem`,
        statusText: `${totalWeeks} ${totalWeeks === 1 ? "semana" : "semanas"} del plan activo`,
        endDateLabel: "",
      };
    }

    const endNoon = new Date(startNoon.getTime());
    endNoon.setDate(endNoon.getDate() + totalDays - 1);
    const endDateLabel = endNoon.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    });

    const elapsedDays = Math.floor((evalNoon.getTime() - startNoon.getTime()) / 86400000);

    // Si la evaluación ocurre antes o al inicio del plan (primeros 2 días)
    if (elapsedDays <= 2) {
      return {
        hasPlan: true,
        isExpired: false,
        remainingWeeks: totalWeeks,
        totalWeeks,
        elapsedWeeks: 0,
        planTitle,
        badgeText: `Vence ${endDateLabel}`,
        statusText: `Plan completo (${totalWeeks} sem · vence ${endDateLabel})`,
        endDateLabel,
      };
    }

    const remainingDays = totalDays - elapsedDays;
    const elapsedWeeks = Math.min(totalWeeks, Math.round(elapsedDays / 7));
    const remainingWeeks = Math.max(0, totalWeeks - elapsedWeeks);

    if (remainingDays <= 2 || remainingWeeks <= 0 || (!editingId && evalCiclo.activo === false)) {
      return {
        hasPlan: true,
        isExpired: true,
        remainingWeeks: 0,
        totalWeeks,
        elapsedWeeks: totalWeeks,
        planTitle,
        badgeText: `0 de ${totalWeeks} sem`,
        statusText: `Plan concluido (venció ${endDateLabel})`,
        endDateLabel,
      };
    }

    return {
      hasPlan: true,
      isExpired: false,
      remainingWeeks,
      totalWeeks,
      elapsedWeeks,
      planTitle,
      badgeText:
        remainingWeeks < totalWeeks
          ? `Restan de ${totalWeeks} sem · Fin ${endDateLabel}`
          : `Vence ${endDateLabel}`,
      statusText:
        remainingWeeks < totalWeeks
          ? `Restan ${remainingWeeks} de ${totalWeeks} sem (vence ${endDateLabel})`
          : `Plan completo (${totalWeeks} sem · vence ${endDateLabel})`,
      endDateLabel,
    };
  }, [evalCiclo, form.fecha, editingId]);

  useEffect(() => {
    if (!showModal) return;
    const targetW = planTimeStatus.remainingWeeks > 0 ? String(planTimeStatus.remainingWeeks) : "0";
    if (String(form.eval_semanas_objetivo || "") !== targetW) {
      setForm((prev) => ({ ...prev, eval_semanas_objetivo: targetW }));
    }
  }, [showModal, planTimeStatus.remainingWeeks, form.eval_semanas_objetivo]);

  const effectivePlanWeeks =
    planTimeStatus.remainingWeeks > 0
      ? planTimeStatus.remainingWeeks
      : parseFloat(form.eval_semanas_objetivo) || cycleInfo.semanas || 4;

  const weightGoalPlaceholder = useMemo(() => {
    const curPeso = parseFloat(form.peso) || parseFloat(selected?.peso) || 0;
    if (curPeso <= 0) {
      return "Captura el peso en Paso 4 para ver recomendación";
    }
    if (planTimeStatus.isExpired || planTimeStatus.remainingWeeks <= 0) {
      return "Genera un nuevo plan para proyectar en semanas";
    }
    const w = planTimeStatus.remainingWeeks;
    const currentGoalId = form.eval_objetivo || liveSmartMacros?.goalId || "cut_15";
    if (String(currentGoalId).startsWith("bulk")) {
      const low = (curPeso * (1 + 0.0025 * w)).toFixed(1);
      const high = (curPeso * (1 + 0.005 * w)).toFixed(1);
      return `Se recomienda: ${low}–${high} kg considerando el plazo de ${w} sem`;
    }
    if (currentGoalId === "maint") {
      return `Se recomienda: ${curPeso.toFixed(1)} kg considerando el plazo de ${w} sem`;
    }
    const low = (curPeso * (1 - 0.01 * w)).toFixed(1);
    const high = (curPeso * (1 - 0.005 * w)).toFixed(1);
    return `Se recomienda: ${low}–${high} kg considerando el plazo de ${w} sem`;
  }, [form.peso, selected?.peso, planTimeStatus.isExpired, planTimeStatus.remainingWeeks, form.eval_objetivo, liveSmartMacros?.goalId]);

  const liveWeightGoalPlan = useMemo(() => {
    const curPeso = parseFloat(form.peso) || parseFloat(selected?.peso) || 0;
    const goalPeso = parseFloat(form.eval_peso_objetivo) || 0;
    if (curPeso <= 0 || goalPeso <= 0 || effectivePlanWeeks <= 0) return null;
    return evaluateWeightGoalPlan({
      peso: curPeso,
      pesoObjetivo: goalPeso,
      semanas: effectivePlanWeeks,
      get: liveSmartMacros?.get || 0,
    });
  }, [form.peso, selected?.peso, form.eval_peso_objetivo, effectivePlanWeeks, liveSmartMacros?.get]);

  const recommendedCycleGoalId = useMemo(() => {
    if (liveWeightGoalPlan?.recommendedGoalId) {
      return liveWeightGoalPlan.recommendedGoalId;
    }
    const curPeso = parseFloat(form.peso) || parseFloat(selected?.peso) || 0;
    const est = parseFloat(form.estatura) || parseFloat(liveSmartMacros?.estatura) || 0;
    const grasa = parseFloat(liveCalculations?.grasa_pct) || parseFloat(form.grasa_pct) || 0;
    const imc = curPeso > 0 && est > 0 ? curPeso / Math.pow(est / 100, 2) : 0;
    const w = effectivePlanWeeks;

    if (curPeso > 0 && w > 0) {
      const highAdiposity =
        grasa > 0
          ? (evalSexo === "M" && grasa >= 25) || (evalSexo === "F" && grasa >= 32)
          : imc >= 27;
      if (highAdiposity) {
        return w <= 3 ? "cut_20" : "cut_15";
      }
      if (imc > 0 && imc < 19) {
        return "bulk_10";
      }
      if (
        grasa > 0 &&
        ((evalSexo === "M" && grasa >= 12 && grasa < 18) ||
          (evalSexo === "F" && grasa >= 20 && grasa < 26))
      ) {
        return "cut_10";
      }
    }
    const cycleEnfoque = String(evalCiclo?.nombre || "").split("|")[4] || "";
    return (
      inferGoalFromText(
        cycleEnfoque ||
          clinicalRec?.anamnesis?.objetivo_principal ||
          selected?.objetivo ||
          ""
      ) || "cut_15"
    );
  }, [
    liveWeightGoalPlan?.recommendedGoalId,
    form.peso,
    selected?.peso,
    form.estatura,
    liveSmartMacros?.estatura,
    liveCalculations?.grasa_pct,
    form.grasa_pct,
    effectivePlanWeeks,
    evalSexo,
    evalCiclo?.nombre,
    clinicalRec?.anamnesis?.objetivo_principal,
    selected?.objetivo,
  ]);

  const isFirstEvaluationEver = !editingId
    ? allLinkedMetricas.length === 0
    : (allLinkedMetricas.length <= 1 || String(allLinkedMetricas[allLinkedMetricas.length - 1]?.id) === String(editingId));

  const prevEvalHorario = useMemo(() => {
    const list = (allLinkedMetricas && allLinkedMetricas.length > 0) ? allLinkedMetricas : metricas;
    if (!Array.isArray(list) || list.length === 0) return "";
    if (!editingId) return String(list[0]?.horario_ejercicio || "").trim();
    const idx = list.findIndex((x) => String(x?.id) === String(editingId));
    const prev = idx >= 0 ? list[idx + 1] : null;
    return String(prev?.horario_ejercicio || "").trim();
  }, [allLinkedMetricas, metricas, editingId]);

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
        "checkin_observaciones", "checkin_ajustes", "eval_objetivo", "eval_faf", "eval_faf_notas", "eval_tmb_formula",
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
      rawData.smae_gustos = form.smae_gustos || {};
      if (adherenceSnapshot) {
        rawData.adherencia_snapshot = adherenceSnapshot;
      }

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
          formula: liveSmartMacros?.formula || null,
          formulaShort: liveSmartMacros?.formulaShort || null,
          formulaLabel: liveSmartMacros?.formulaLabel || null,
          formulaMode: liveSmartMacros?.formulaMode || "auto",
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
    setShowSmaeBoardInFollowUp(false);
    setShowFullR24hInFollowUp(false);
    setShowFormulaPopover(false);
    setInbodyOcrResult(null);
    setAnalyzingInbody(false);
    setAdherenceSnapshot(null);
    setLoadingAdherenceSnapshot(false);
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
      } else if (m.pliegue_triceps && m.pliegue_subescapular && m.pliegue_suprailiaco && m.pliegue_abdominal && !m.pliegue_muslo && !m.pliegue_pantorrilla) {
        metodo = "plicometria_faulkner";
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
    if (!filled.eval_semanas_objetivo) {
      filled.eval_semanas_objetivo = String(cycleInfo.semanas || 4);
    }
    if (!filled.eval_meta_pasos) {
      filled.eval_meta_pasos = String(DEFAULT_STEP_GOAL);
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
    filled.smae_gustos = (typeof m.smae_gustos === "object" && m.smae_gustos) ? m.smae_gustos : {};
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
    setShowSmaeBoardInFollowUp(false);
    setShowFullR24hInFollowUp(false);
    setAdherenceSnapshot(m.adherencia_snapshot || m.adherenciaSnapshot || null);
    setLoadingAdherenceSnapshot(false);

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
                      const formulaShort =
                        m.prescribed_macros?.formulaShort ||
                        (m.eval_tmb_formula && m.eval_tmb_formula !== "auto"
                          ? getTmbFormulaInfo(m.eval_tmb_formula)?.shortLabel
                          : null);
                      const baseLabel =
                        mode === "ia" ? "Auditado IA" : mode === "manual" ? "Manual" : "Matemático";
                      const label =
                        mode === "matematico" && formulaShort
                          ? `${baseLabel} · ${formulaShort}`
                          : m.prescribed_macros?.modeLabel || baseLabel;
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
            const startRaw = r?.fecha_inicio || cicloSel?.fecha_inicio || cicloSel?.created_at || r?.created_at;
            const { currentCycleWeek, isFuture: isCycleFuture } = getCurrentCycleWeekInfo(startRaw);
            const currentWeekIdx = isCycleFuture ? -1 : Math.max(0, (currentCycleWeek || 1) - 1);
            const numSemanas = Math.max(1, semanas.length);
            const metricColPercent = (62 / (numSemanas * 2)).toFixed(2);
            const tableMinPx = Math.max(740, 240 + 50 + (numSemanas * 2 * 56));
            const tieneData = r.ejercicios.some(ej =>
              Object.entries(progreso).some(([key, val]) => key.startsWith(`${ej.id}-`) && val !== "" && val != null)
            );
            const showTable = tieneData || (canEditTracking && (r.ejercicios || []).length > 0);
            return (
              <div key={r.id} className="mb-6">
                <div className="font-bold text-[15px] mb-2.5 text-[var(--brand-primary)] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4" /> {r.nombre}
                    {!tieneData && <span className="text-[11px] text-[#6B7A8D] font-normal">Sin registros aún</span>}
                  </div>
                  {canEditTracking && (r.ejercicios || []).length > 0 && (
                    <span className="text-[11px] text-[#6B7A8D] font-medium flex items-center gap-1">
                      <Edit2 className="w-3 h-3 text-[var(--brand-primary)]" />
                      Toca cualquier celda de Peso o Reps para editar
                    </span>
                  )}
                </div>
                {showTable && (
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
                              className={`px-1 py-1.5 border border-[#E2E8F0] text-center text-[10px] font-bold whitespace-nowrap ${
                                s.isCurrent
                                  ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                                  : "bg-gray-50 text-[var(--brand-primary)]"
                              }`}
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <span>{s.label}</span>
                                {s.isCurrent && (
                                  <span className="text-[8px] px-1.5 py-0.2 rounded-full bg-[var(--brand-primary)] text-white font-extrabold uppercase leading-tight">
                                    Actual
                                  </span>
                                )}
                              </div>
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
                            if (key.startsWith(`${ej.id}-`) && progreso[key] !== "" && progreso[key] != null) {
                              const match = key.match(/-(?:peso|reps)-(.+)$/);
                              if (match && match[1]) {
                                variantsWithData.add(match[1]);
                              }
                            }
                          }
                          const activeVariants = Array.from(variantsWithData).sort();

                          const variantWorkedWeek = (targetVid, targetWi) => {
                            const isTgtOrig = targetVid === "original";
                            const tgtAltIdx = isTgtOrig ? -1 : parseInt(targetVid.replace("alt_", ""), 10);
                            const tgtObj = isTgtOrig ? ej : (ej.alternativas || [])[tgtAltIdx] || ej;
                            const maxSets = Math.max(tgtObj.num_series || 0, ej.num_series || 4);
                            for (let k = 0; k < maxSets; k++) {
                              const pv = progreso[`${ej.id}-${targetWi}-${k}-peso-${targetVid}`];
                              const rv = progreso[`${ej.id}-${targetWi}-${k}-reps-${targetVid}`];
                              if ((pv !== undefined && pv !== null && pv !== "") || (rv !== undefined && rv !== null && rv !== "")) {
                                return true;
                              }
                            }
                            return false;
                          };

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
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div 
                                        onClick={() => exObj.gif_url && setLightbox(exObj.gif_url)}
                                        className={`w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center ${exObj.gif_url ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
                                        title={exObj.gif_url ? "Ver demostración en grande" : ""}
                                      >
                                        {exObj.gif_url ? (
                                          /\.(mp4|webm|mov)($|\?)/i.test(exObj.gif_url) ? (
                                            <video src={exObj.gif_url} autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none" />
                                          ) : (
                                            <img src={exObj.gif_url} alt="" className="w-full h-full object-cover pointer-events-none" />
                                          )
                                        ) : (
                                          <Dumbbell className="w-4 h-4 text-slate-400" />
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                                          <span className="text-[#0B1929] leading-tight break-words">{exObj.nombre}</span>
                                          {!isOriginal && (
                                            <div className="inline-flex items-center gap-1 shrink-0">
                                              <span className="text-[9px] bg-[var(--brand-primary)] text-white px-1 py-0.5 rounded font-bold">ALT</span>
                                              {!isReadOnly && altIdx >= 0 && (
                                                <button
                                                  type="button"
                                                  onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    const hasOrig = originalHasData(ej.id);
                                                    setPromoteModal({
                                                      rutina: r,
                                                      ej,
                                                      altIdx,
                                                      alt: exObj,
                                                      hasOrigData: hasOrig
                                                    });
                                                  }}
                                                  className="inline-flex items-center gap-0.5 text-[9px] bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer shadow-2xs"
                                                  title="Promover este ejercicio a principal"
                                                >
                                                  <ArrowUp className="w-2.5 h-2.5" />
                                                  Promover
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-[#6B7A8D] font-normal mt-0.5 truncate">{GRUPO_LABELS[normalizeMuscleGroup(exObj.grupo_muscular || ej.grupo_muscular)] || exObj.grupo_muscular || ej.grupo_muscular}</div>
                                      </div>
                                    </div>
                                  </td>
                                )}
                                <td className="px-2 py-1.5 border border-[#E2E8F0] text-center text-[var(--brand-primary)] font-bold font-['Rajdhani']">{si+1}</td>
                                {semanas.map((s, wi) => {
                                  const pVal = progreso[`${ej.id}-${wi}-${si}-peso-${vid}`] || "";
                                  const rVal = progreso[`${ej.id}-${wi}-${si}-reps-${vid}`] || "";
                                  const isManualFalta = rVal === "Falta";

                                  let emptyText = "—";
                                  let emptyColorClass = "text-[#CBD5E1]";
                                  let emptyWeightClass = "font-normal";
                                  let isAutoFalta = false;

                                  if (!pVal && !rVal) {
                                    const otherVariantWorkedWeek = activeVariants.some(
                                      (otherVid) => otherVid !== vid && variantWorkedWeek(otherVid, wi)
                                    );
                                    if (otherVariantWorkedWeek) {
                                      emptyText = isOriginal ? "ALT" : "ORG";
                                      emptyColorClass = "text-[#6B7A8D]";
                                      emptyWeightClass = "font-bold";
                                    } else {
                                      const isWeekClosed = !isCycleFuture && wi < currentWeekIdx;
                                      const thisVariantWorkedWeek = variantWorkedWeek(vid, wi);
                                      if (isWeekClosed && (isOriginal || thisVariantWorkedWeek)) {
                                        isAutoFalta = true;
                                      }
                                    }
                                  }

                                  const isFaltaCell = isManualFalta || isAutoFalta;

                                  return (
                                    <Fragment key={`w${wi}`}>
                                      <td
                                        key={`p${wi}`}
                                        onClick={() => canEditTracking && openRutinaEditCell({ rutina: r, ej, exObj, vid, si, wi, semanaLabel: s.label, focusField: "peso" })}
                                        title={canEditTracking ? `Editar serie ${si + 1} (${s.label})` : ""}
                                        className={`px-1 py-1.5 border border-[#E2E8F0] text-center ${
                                          isFaltaCell ? "bg-red-50/50" : (pVal ? "bg-[var(--brand-primary)]/10" : "")
                                        } ${canEditTracking ? "cursor-pointer hover:bg-[var(--brand-primary)]/15 transition-colors" : ""}`}
                                      >
                                        <span className={`text-[11px] ${
                                          isFaltaCell
                                            ? "text-red-300 font-semibold"
                                            : (pVal ? "text-[var(--brand-primary)] font-bold" : `${emptyColorClass} ${emptyWeightClass}`)
                                        }`}>
                                          {isFaltaCell ? "—" : (pVal ? formatTrackingWeight(pVal, trackingWeightUnit) : emptyText)}
                                        </span>
                                      </td>
                                      <td
                                        key={`r${wi}`}
                                        onClick={() => canEditTracking && openRutinaEditCell({ rutina: r, ej, exObj, vid, si, wi, semanaLabel: s.label, focusField: "reps" })}
                                        title={canEditTracking ? `Editar serie ${si + 1} (${s.label})` : ""}
                                        className={`px-1 py-1.5 border border-[#E2E8F0] text-center ${
                                          isFaltaCell ? "bg-red-50/50" : (rVal ? "bg-[var(--brand-primary)]/5" : "")
                                        } ${canEditTracking ? "cursor-pointer hover:bg-blue-50 transition-colors" : ""}`}
                                      >
                                        <span className={`text-[11px] ${
                                          isFaltaCell
                                            ? "text-red-500 font-bold"
                                            : (rVal ? "text-[#3B82F6] font-bold" : `${emptyColorClass} ${emptyWeightClass}`)
                                        }`}>
                                          {isFaltaCell ? "Falta" : (rVal || emptyText)}
                                        </span>
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
                  {canEditTracking && (
                    <span className="text-[11px] text-[#6B7A8D] font-medium flex items-center gap-1">
                      <Edit2 className="w-3 h-3 text-[var(--brand-primary)]" />
                      Toca cualquier día para editar comidas o agua
                    </span>
                  )}
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
                                  onClick={() => canEditTracking && openNutriEditCell(d, s)}
                                  title={canEditTracking ? `Editar ${d.nombre || d.dia_semana || `Día ${idx + 1}`} · ${s.label}` : ""}
                                  className={`px-2 py-2 border-b border-r border-[#E2E8F0] text-center group relative ${
                                    s.isCurrent ? "bg-[var(--brand-primary)]/5" : ""
                                  } ${canEditTracking ? "cursor-pointer hover:bg-[var(--brand-primary)]/10 transition-colors" : ""}`}
                                >
                                  <div className="flex flex-col items-center gap-0.5 leading-tight">
                                    <span className={`font-bold ${hasAny ? "text-emerald-600" : "text-[#94A3B8]"}`}>
                                      {doneCount}/{totalC} com.
                                    </span>
                                    <span className={`text-[10px] font-semibold ${hasAny ? "text-sky-600" : "text-[#94A3B8]"}`}>
                                      {(agua / 1000).toFixed(2)} L
                                    </span>
                                  </div>
                                  {canEditTracking && (
                                    <Edit2 className="w-2.5 h-2.5 text-[var(--brand-primary)] opacity-0 group-hover:opacity-70 transition-opacity absolute top-1 right-1 pointer-events-none" />
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
                              <div className="flex flex-col items-center gap-0.5 leading-tight">
                                <span className={`font-extrabold ${hasData ? "text-emerald-700" : "text-[#94A3B8]"}`}>
                                  {semComidas}/{semTotalComidas} com.
                                </span>
                                <span className={`text-[10px] font-bold ${hasData ? "text-sky-700" : "text-[#94A3B8]"}`}>
                                  {promAgua} L/día prom.
                                </span>
                              </div>
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
        const isPlicometria = ["plicometria_jp3", "plicometria_dw4", "plicometria_faulkner", "manual", "plicometria_isak"].includes(form.metodo_evaluacion);
        const effectiveMethod = isCivil
          ? (form.metodo_evaluacion === "inbody" ? "inbody" : "basico")
          : form.metodo_evaluacion;
        const activeGroups = getGroupsForMethod(effectiveMethod, evalSexo, hasDefinedSexo);
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
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-[#0B1929] truncate">
                        {isReadOnly
                          ? "Consultar Evaluación Corporal"
                          : editingId
                          ? "Editar Evaluación Corporal"
                          : isFirstEvaluationEver
                          ? "Nueva Evaluación Inicial"
                          : "Nueva Evaluación de Seguimiento"}
                      </h2>
                      {!isReadOnly && (
                        <span className={`hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          isFirstEvaluationEver
                            ? "bg-blue-50 text-[var(--brand-primary)] border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {isFirstEvaluationEver ? "1ª Consulta" : "Seguimiento"}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#6B7A8D] hidden sm:block truncate">
                      {selected?.nombre} • {getMetodoLabel(form.metodo_evaluacion)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                  {/* Selector de Fecha de Evaluación (a la izquierda del botón de guardar) */}
                  <div
                    className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2 sm:px-3 py-1.5 shadow-2xs"
                    title="Fecha de la evaluación corporal"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#6B7A8D] shrink-0" />
                    <input
                      type="date"
                      readOnly={isReadOnly}
                      value={form.fecha}
                      onChange={(e) => !isReadOnly && updForm("fecha", e.target.value)}
                      className="bg-transparent text-xs sm:text-sm font-bold text-[#0B1929] focus:outline-none cursor-pointer"
                    />
                  </div>

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
            <div className="max-w-7xl w-full mx-auto px-0 py-0 pb-28 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-0 md:gap-6">
              {/* Left Column: Protocol & Anthropometric Fields */}
              <div className="lg:col-span-8 flex flex-col gap-0 md:gap-5">
                {/* Paso 1: Check-in de Seguimiento */}
                <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-blue-100 p-4 sm:p-6 shadow-none md:shadow-sm relative overflow-hidden space-y-4 sm:space-y-5">
                  <div className="hidden md:block absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--brand-primary)] to-blue-400" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="hidden sm:flex w-10 h-10 rounded-xl bg-blue-50 text-[var(--brand-primary)] items-center justify-center shrink-0">
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
                        <p className="hidden md:block text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Registra las sensaciones y hábitos del paciente basado en su experiencia reciente (o su día a día habitual si es consulta inicial). Pondera del 1 (lo menor o más desfavorable) al 5 (lo mayor u óptimo).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Panel Unificado de Ponderación (5 Escalas) */}
                  <div className="-mx-4 sm:mx-0 bg-white sm:bg-[#F8FAFC] border-t sm:border border-[#E2E8F0] rounded-none sm:rounded-2xl divide-y divide-[#E2E8F0] overflow-hidden">
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
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs items-center justify-center shrink-0">
                              {sc.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-[#0B1929] flex items-center gap-1.5">
                                  <span className="sm:hidden shrink-0">{sc.icon}</span>
                                  <span>{sc.label}</span>
                                </span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${sc.badgeColor}`}>
                                  {currentVal}/5 · {statusLabel}
                                </span>
                              </div>
                              <p className="hidden sm:flex text-[11px] text-[#6B7A8D] mt-0.5 items-center gap-1.5 flex-wrap">
                                <span className="text-gray-400 font-medium">Escala:</span>
                                <span className="font-medium text-gray-600">1 = {sc.minHelp}</span>
                                <span className="text-gray-300">|</span>
                                <span className="font-medium text-gray-600">5 = {sc.maxHelp}</span>
                              </p>
                            </div>
                          </div>

                          {/* Derecha: Selector de 5 botones (1 al 5) */}
                          <div className="flex items-center gap-1 self-stretch md:self-auto justify-end shrink-0 bg-[#F8FAFC] sm:bg-white p-1 rounded-xl border border-[#E2E8F0] shadow-none sm:shadow-2xs">
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

                  {/* Hábitos de Sueño y Actividad Física */}
                  <div className="pt-2 border-t border-blue-100/80 space-y-2.5 sm:space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[var(--brand-primary)]" />
                      <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                        Estilo de Vida y Hábitos del Paciente
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
                      {/* Horas de Sueño */}
                      <div className="flex flex-col justify-between gap-1 sm:gap-2 sm:bg-[#F8FAFC] sm:border sm:border-[#E2E8F0] sm:rounded-xl sm:p-3">
                        <div className="space-y-0.5">
                          <label className="text-[11px] sm:text-xs font-bold text-[#6B7A8D] sm:text-[#0B1929] flex items-center gap-1.5">
                            <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>Horas de sueño promedio</span>
                          </label>
                          <p className="hidden sm:block text-[11px] text-[#6B7A8D] leading-snug">
                            Promedio de descanso por noche.
                          </p>
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          readOnly={isReadOnly}
                          value={form.horas_sueno || ""}
                          onChange={(e) => !isReadOnly && updForm("horas_sueno", e.target.value)}
                          placeholder="Ej. 7.5 hrs"
                          className={`w-full bg-[#F8FAFC] sm:bg-white border border-[#E2E8F0] rounded-xl sm:rounded-lg px-3 py-2 text-xs sm:text-sm placeholder:text-xs text-[#0B1929] shadow-none sm:shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white"}`}
                        />
                      </div>

                      {/* Días de Ejercicio Actuales */}
                      <div className="flex flex-col justify-between gap-1 sm:gap-2 sm:bg-[#F8FAFC] sm:border sm:border-[#E2E8F0] sm:rounded-xl sm:p-3">
                        <div className="space-y-0.5">
                          <label className="text-[11px] sm:text-xs font-bold text-[#6B7A8D] sm:text-[#0B1929] flex items-center gap-1.5">
                            <Dumbbell className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Días de ejercicio actuales</span>
                          </label>
                          <p className="hidden sm:block text-[11px] text-[#6B7A8D] leading-snug">
                            Promedio semanal de entrenamiento.
                          </p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          readOnly={isReadOnly}
                          value={form.dias_ejercicio_actual || ""}
                          onChange={(e) => !isReadOnly && updForm("dias_ejercicio_actual", e.target.value)}
                          placeholder="Ej. 3 o 4 días por semana"
                          className={`w-full bg-[#F8FAFC] sm:bg-white border border-[#E2E8F0] rounded-xl sm:rounded-lg px-3 py-2 text-xs sm:text-sm placeholder:text-xs text-[#0B1929] shadow-none sm:shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white"}`}
                        />
                      </div>

                      {/* Horario Disponible para Entrenar */}
                      <div className="flex flex-col justify-between gap-1 sm:gap-2 sm:bg-[#F8FAFC] sm:border sm:border-[#E2E8F0] sm:rounded-xl sm:p-3">
                        <div className="space-y-0.5">
                          <label className="text-[11px] sm:text-xs font-bold text-[#6B7A8D] sm:text-[#0B1929] flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Horario habitual de entreno</span>
                          </label>
                          <p className="hidden sm:block text-[11px] text-[#6B7A8D] leading-snug">
                            Hora de entrenamiento diaria.
                          </p>
                        </div>
                        <input
                          type="text"
                          readOnly={isReadOnly}
                          value={form.horario_ejercicio || ""}
                          onChange={(e) => !isReadOnly && updForm("horario_ejercicio", e.target.value)}
                          placeholder={prevEvalHorario ? `Última consulta: ${prevEvalHorario}` : "Ej. 7:00 am"}
                          title={prevEvalHorario ? `En la última consulta se comentó: ${prevEvalHorario}` : undefined}
                          className={`w-full bg-[#F8FAFC] sm:bg-white border border-[#E2E8F0] rounded-xl sm:rounded-lg px-3 py-2 text-xs sm:text-sm placeholder:text-xs text-[#0B1929] shadow-none sm:shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white"}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Adherencia de Entrenamiento y Observaciones del Ciclo (Solo para segundas evaluaciones en adelante) */}
                  {!isFirstEvaluationEver && (
                    <div className="pt-2 border-t border-blue-100/80 space-y-3">
                      {loadingAdherenceSnapshot && (
                        <div className="py-2 text-xs text-blue-800 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-primary)] shrink-0" />
                          <span>Consultando histórico de entrenamiento en la app...</span>
                        </div>
                      )}

                      {!loadingAdherenceSnapshot && adherenceSnapshot && (
                        <div className="pt-2 sm:rounded-xl sm:bg-[#F8FAFC] sm:border sm:border-[#E2E8F0] sm:p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                            <span className="font-bold text-[#0B1929] flex items-center gap-1.5">
                              <BarChart2 className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                              <span>Histórico de entrenamiento: {adherenceSnapshot.ciclo_evaluado_nombre}</span>
                            </span>
                            {adherenceSnapshot.capturado_en && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[#6B7A8D]">
                                Corte: {fmtDate(String(adherenceSnapshot.capturado_en).split("T")[0])}
                              </span>
                            )}
                          </div>

                          <div className="pt-2.5 border-t border-[#E2E8F0]/80 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                                <Dumbbell className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Entrenamiento</span>
                              </span>
                              {adherenceSnapshot.entrenamiento?.hasPlan && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                  {adherenceSnapshot.entrenamiento.dias_asignados} {adherenceSnapshot.entrenamiento.dias_asignados === 1 ? "día" : "días"}/sem{adherenceSnapshot.entrenamiento.dias_detalle ? ` · ${adherenceSnapshot.entrenamiento.dias_detalle}` : ""}
                                </span>
                              )}
                            </div>

                            {adherenceSnapshot.entrenamiento?.hasPlan ? (
                              <div className="space-y-2">
                                <div>
                                  <div className="flex items-center justify-between text-[11px] mb-1">
                                    <span className="text-[#6B7A8D] font-medium">
                                      Sesiones ({adherenceSnapshot.entrenamiento.sesiones_completadas}/{adherenceSnapshot.entrenamiento.sesiones_esperadas})
                                    </span>
                                    <span className="font-bold text-[#0B1929]">{adherenceSnapshot.entrenamiento.pct_cumplimiento}%</span>
                                  </div>
                                  <div className="w-full h-2 rounded-full bg-white border border-[#E2E8F0]/80 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-indigo-500 transition-all"
                                      style={{ width: `${adherenceSnapshot.entrenamiento.pct_cumplimiento}%` }}
                                    />
                                  </div>
                                </div>

                                {adherenceSnapshot.entrenamiento.semanas?.length > 0 && (
                                  <div className={`pt-2 border-t border-[#E2E8F0]/70 grid gap-1.5 ${
                                    adherenceSnapshot.entrenamiento.semanas.length > 4
                                      ? "grid-cols-4 sm:grid-cols-8"
                                      : "grid-cols-4"
                                  }`}>
                                    {adherenceSnapshot.entrenamiento.semanas.map((w) => (
                                      <div key={w.semana} className="text-center">
                                        <div className="h-8 bg-white border border-[#E2E8F0]/80 rounded-md flex items-end overflow-hidden p-0.5">
                                          <div
                                            className={`w-full rounded-sm ${w.pct > 0 ? "bg-indigo-400" : "bg-slate-200"}`}
                                            style={{ height: `${Math.max(8, w.pct)}%` }}
                                          />
                                        </div>
                                        <div className="text-[9px] font-bold text-[#0B1929] mt-0.5 leading-tight">
                                          S{w.semana} · {w.pct}%
                                        </div>
                                        <div className="text-[9px] text-[#6B7A8D] leading-tight">
                                          {w.completadas}/{w.esperadas}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-[#6B7A8D] py-1">
                                Sin rutinas asignadas en la app para este ciclo.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-[#0B1929] mb-1">
                          Justificación de faltas, desviaciones del entrenamiento o sensaciones (Opcional)
                        </label>
                        <textarea
                          rows={2}
                          readOnly={isReadOnly}
                          value={form.checkin_observaciones || ""}
                          onChange={(e) => !isReadOnly && updForm("checkin_observaciones", e.target.value)}
                          placeholder="Ej. Faltó en semanas 3 y 6 por viaje de trabajo, molestia leve en rodilla en sentadilla, buena energía y recuperación..."
                          className={`w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0B1929] resize-none shadow-2xs ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)]"}`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Paso 2: Preferencias Alimentarias (16 Grupos SMAE en 3 Estados: Favoritos, Neutro, Disgusto) */}
                <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <div className="hidden sm:flex w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 items-center justify-center shrink-0">
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
                        <p className="hidden md:block text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Clasifica los 16 grupos del SMAE según las preferencias del paciente para priorizar o advertir en la prescripción y armado de dietas. Por defecto todos están en <strong>Neutro</strong>. Puedes arrastrarlos o usar los botones rápidos.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isFirstEvaluationEver && showSmaeBoardInFollowUp && (
                        <button
                          type="button"
                          onClick={() => setShowSmaeBoardInFollowUp(false)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <span>Contraer</span>
                        </button>
                      )}
                      {!isReadOnly && (isFirstEvaluationEver || showSmaeBoardInFollowUp) && Object.keys(form.smae_gustos || {}).length > 0 && (
                        <button
                          type="button"
                          onClick={resetAllSmaePrefs}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                          title="Restablecer todos los grupos a Neutro"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span className="hidden sm:inline">Restablecer a neutro</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resumen Compacto en Seguimiento (Colapsado por defecto) */}
                  {!isFirstEvaluationEver && !showSmaeBoardInFollowUp ? (
                    (() => {
                      const favCount = SMAE_GROUPS.filter((g) => form.smae_gustos?.[g.id] === "favorito").length;
                      const disCount = SMAE_GROUPS.filter((g) => form.smae_gustos?.[g.id] === "disgusto").length;
                      const neuCount = SMAE_GROUPS.length - favCount - disCount;
                      return (
                        <div className="pt-2.5 border-t border-[#F0F4FA] sm:bg-[#F8FAFC] sm:border sm:border-[#E2E8F0] sm:rounded-xl sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-bold text-[#0B1929]">Heredado del ciclo anterior:</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                {favCount} Favoritos
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                {disCount} Evitar
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[#6B7A8D] text-[11px] font-medium">
                                {neuCount} Neutro
                              </span>
                            </div>
                            {(form.preferencias_alimentos || form.aversiones_alimentos) && (
                              <p className="text-[11px] text-[#6B7A8D] truncate">
                                {form.preferencias_alimentos ? `Gustos: ${form.preferencias_alimentos}` : ""}
                                {form.preferencias_alimentos && form.aversiones_alimentos ? " · " : ""}
                                {form.aversiones_alimentos ? `Evitar: ${form.aversiones_alimentos}` : ""}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowSmaeBoardInFollowUp(true)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[var(--brand-primary)] text-xs font-bold text-[#0B1929] hover:text-[var(--brand-primary)] transition-colors cursor-pointer shrink-0 shadow-2xs"
                          >
                            {isReadOnly ? "Ver tablero completo" : "Modificar preferencias"}
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                  <>
                  {/* TABLERO INTERACTIVO DE 3 ESTADOS (DRAG & DROP / 1-TAP) */}
                  {(() => {
                    const favGroups = SMAE_GROUPS.filter((g) => form.smae_gustos?.[g.id] === "favorito");
                    const disgustoGroups = SMAE_GROUPS.filter((g) => form.smae_gustos?.[g.id] === "disgusto");
                    const neutroGroups = SMAE_GROUPS.filter((g) => !form.smae_gustos?.[g.id] || form.smae_gustos[g.id] === "neutro");

                    const renderCard = (grp, currentBucket) => {
                      return (
                        <div
                          key={grp.id}
                          draggable={!isReadOnly}
                          onDragStart={(e) => {
                            setDraggedSmaeId(grp.id);
                            try { e.dataTransfer.setData("text/plain", grp.id); } catch {}
                          }}
                          className={`flex items-center justify-between gap-1.5 p-2 rounded-xl border transition-all select-none ${
                            currentBucket === "favorito"
                              ? "bg-white border-emerald-300 shadow-2xs hover:border-emerald-400"
                              : currentBucket === "disgusto"
                              ? "bg-white border-rose-300 shadow-2xs hover:border-rose-400"
                              : "bg-white border-gray-200 shadow-2xs hover:border-gray-300"
                          } ${isReadOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-sm shrink-0">{grp.icono}</span>
                            <span className="text-xs font-bold text-[#0B1929] truncate" title={grp.nombre}>
                              {grp.corto}
                            </span>
                          </div>

                          {!isReadOnly && (
                            <div className="flex items-center gap-1 shrink-0">
                              {currentBucket !== "favorito" && (
                                <button
                                  type="button"
                                  onClick={() => setSmaeGroupPref(grp.id, "favorito")}
                                  className="w-6 h-6 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Marcar como Favorito"
                                >
                                  <Heart className="w-3 h-3 fill-emerald-600/30" />
                                </button>
                              )}

                              {currentBucket !== "neutro" && (
                                <button
                                  type="button"
                                  onClick={() => setSmaeGroupPref(grp.id, "neutro")}
                                  className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Volver a Neutro"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}

                              {currentBucket !== "disgusto" && (
                                <button
                                  type="button"
                                  onClick={() => setSmaeGroupPref(grp.id, "disgusto")}
                                  className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Marcar como Disgusto / Evitar"
                                >
                                  <Ban className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* COLUMNA 1: FAVORITOS */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            try { e.dataTransfer.dropEffect = "move"; } catch {}
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            let gId = null;
                            try { gId = e.dataTransfer.getData("text/plain"); } catch {}
                            const finalId = gId || draggedSmaeId;
                            if (finalId) setSmaeGroupPref(finalId, "favorito");
                            setDraggedSmaeId(null);
                          }}
                          className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3 flex flex-col space-y-2.5 transition-colors"
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/80">
                            <div className="flex items-center gap-1.5">
                              <Heart className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Favoritos</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {favGroups.length}
                            </span>
                          </div>

                          <div className="space-y-1.5 flex-1 min-h-[140px] max-h-72 overflow-y-auto pr-0.5">
                            {favGroups.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center p-3 text-emerald-700/60 border border-dashed border-emerald-300/80 rounded-xl min-h-[120px]">
                                <Heart className="w-5 h-5 mb-1 stroke-1" />
                                <span className="text-[11px] font-medium leading-tight">
                                  Arrastra aquí o toca 💚 para priorizar
                                </span>
                              </div>
                            ) : (
                              favGroups.map((grp) => renderCard(grp, "favorito"))
                            )}
                          </div>
                        </div>

                        {/* COLUMNA 2: NEUTRO (POR DEFECTO) */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            try { e.dataTransfer.dropEffect = "move"; } catch {}
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            let gId = null;
                            try { gId = e.dataTransfer.getData("text/plain"); } catch {}
                            const finalId = gId || draggedSmaeId;
                            if (finalId) setSmaeGroupPref(finalId, "neutro");
                            setDraggedSmaeId(null);
                          }}
                          className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col space-y-2.5 transition-colors"
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-gray-500" />
                              <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">Neutro / Indiferente</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 border border-gray-300">
                              {neutroGroups.length}
                            </span>
                          </div>

                          <div className="space-y-1.5 flex-1 min-h-[140px] max-h-72 overflow-y-auto pr-0.5">
                            {neutroGroups.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center p-3 text-gray-400 border border-dashed border-gray-300 rounded-xl min-h-[120px]">
                                <span className="text-[11px] font-medium leading-tight">
                                  Todos los grupos clasificados
                                </span>
                              </div>
                            ) : (
                              neutroGroups.map((grp) => renderCard(grp, "neutro"))
                            )}
                          </div>
                        </div>

                        {/* COLUMNA 3: DISGUSTO / EVITAR */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            try { e.dataTransfer.dropEffect = "move"; } catch {}
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            let gId = null;
                            try { gId = e.dataTransfer.getData("text/plain"); } catch {}
                            const finalId = gId || draggedSmaeId;
                            if (finalId) setSmaeGroupPref(finalId, "disgusto");
                            setDraggedSmaeId(null);
                          }}
                          className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3 flex flex-col space-y-2.5 transition-colors"
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-rose-200/80">
                            <div className="flex items-center gap-1.5">
                              <Ban className="w-4 h-4 text-rose-600" />
                              <span className="text-xs font-bold text-rose-950 uppercase tracking-wider">Disgusto / Evitar</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              {disgustoGroups.length}
                            </span>
                          </div>

                          <div className="space-y-1.5 flex-1 min-h-[140px] max-h-72 overflow-y-auto pr-0.5">
                            {disgustoGroups.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center p-3 text-rose-700/60 border border-dashed border-rose-300/80 rounded-xl min-h-[120px]">
                                <Ban className="w-5 h-5 mb-1 stroke-1" />
                                <span className="text-[11px] font-medium leading-tight">
                                  Arrastra aquí o toca 🚫 para evitar
                                </span>
                              </div>
                            ) : (
                              disgustoGroups.map((grp) => renderCard(grp, "disgusto"))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* EXCEPCIONES ESPECÍFICAS DE ALIMENTOS O PLATILLOS (NOTAS PUNTUALES) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E2E8F0]">
                    {/* Favoritos puntuales */}
                    <div className="space-y-1.5 sm:bg-emerald-50/30 sm:border sm:border-emerald-200/70 sm:rounded-xl sm:p-3">
                      <label className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/30" />
                        <span>Comentarios o platillos favoritos específicos</span>
                      </label>
                      <textarea
                        rows={2}
                        readOnly={isReadOnly}
                        value={form.preferencias_alimentos || ""}
                        onChange={(e) => !isReadOnly && updForm("preferencias_alimentos", e.target.value)}
                        placeholder="Ej. Le encanta la avena con canela, claras con espinaca, café negro..."
                        className={`w-full bg-[#F8FAFC] sm:bg-white border border-emerald-200 rounded-xl sm:rounded-lg px-3 py-1.5 text-xs text-[#0B1929] shadow-none sm:shadow-2xs resize-none ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-emerald-500 focus:bg-white"}`}
                      />
                    </div>

                    {/* Aversiones puntuales */}
                    <div className="space-y-1.5 sm:bg-rose-50/30 sm:border sm:border-rose-200/70 sm:rounded-xl sm:p-3">
                      <label className="text-[11px] font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        <span>Aversiones o ingredientes específicos a evitar</span>
                      </label>
                      <textarea
                        rows={2}
                        readOnly={isReadOnly}
                        value={form.aversiones_alimentos || ""}
                        onChange={(e) => !isReadOnly && updForm("aversiones_alimentos", e.target.value)}
                        placeholder="Ej. No le gusta la cebolla cruda, pescado blanco, mayonesa..."
                        className={`w-full bg-[#F8FAFC] sm:bg-white border border-rose-200 rounded-xl sm:rounded-lg px-3 py-1.5 text-xs text-[#0B1929] shadow-none sm:shadow-2xs resize-none ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-rose-500 focus:bg-white"}`}
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                {/* Paso 3: Alimentación Diaria Habitual (R24H) o Adherencia en Seguimiento */}
                {(() => {
                  const hasR24hFilled = Boolean(
                    form.r24h_desayuno || form.r24h_colacion_m || form.r24h_comida || form.r24h_colacion_v || form.r24h_cena
                  );
                  const showFollowUpView = !isFirstEvaluationEver && !showFullR24hInFollowUp && !hasR24hFilled;
                  return (
                    <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                          <div className="hidden sm:flex w-9 h-9 rounded-xl bg-purple-50 text-purple-600 items-center justify-center shrink-0">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 uppercase tracking-wider">
                                Paso 3
                              </span>
                              <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                                {showFollowUpView ? "Adherencia y Desviaciones del Plan" : "Alimentación Diaria Habitual (R24H)"}
                              </h3>
                            </div>
                            <p className="hidden md:block text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                              {showFollowUpView
                                ? "En consultas de seguimiento ya conocemos el menú asignado. Registra únicamente desviaciones frecuentes o comidas fuera del plan."
                                : "Comprende qué suele desayunar, comer y cenar el paciente habitualmente a lo largo del día para adaptar el nuevo plan a sus horarios y rutinas reales."}
                            </p>
                          </div>
                        </div>

                        {!isFirstEvaluationEver && !hasR24hFilled && (
                          <button
                            type="button"
                            onClick={() => setShowFullR24hInFollowUp((v) => !v)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer shrink-0 transition-colors"
                          >
                            {showFullR24hInFollowUp ? "Vista simplificada" : "Capturar R24H completo"}
                          </button>
                        )}
                      </div>

                      {!isFirstEvaluationEver && (
                        <>
                          {loadingAdherenceSnapshot && (
                            <div className="py-2 text-xs text-purple-900 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
                              <span>Consultando histórico nutricional en la app...</span>
                            </div>
                          )}

                          {!loadingAdherenceSnapshot && adherenceSnapshot && (
                            <div className="pt-2 sm:rounded-xl sm:bg-[#F8FAFC] sm:border sm:border-[#E2E8F0] sm:p-3.5 space-y-2.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                                <span className="font-bold text-[#0B1929] flex items-center gap-1.5">
                                  <BarChart2 className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Histórico de hidratación y nutrición: {adherenceSnapshot.ciclo_evaluado_nombre}</span>
                                </span>
                                {adherenceSnapshot.capturado_en && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[#6B7A8D]">
                                    Corte: {fmtDate(String(adherenceSnapshot.capturado_en).split("T")[0])}
                                  </span>
                                )}
                              </div>

                              <div className="pt-2.5 border-t border-[#E2E8F0]/80 space-y-3">
                                {(() => {
                                  const nutriDiasSem = adherenceSnapshot.nutricion?.dias_asignados ?? adherenceSnapshot.nutricion?.semanas?.[0]?.diasTotales ?? 0;
                                  const nutriDetalle = adherenceSnapshot.nutricion?.dias_detalle || "";
                                  return (
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                                        <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Nutrición e Hidratación</span>
                                      </span>
                                      {adherenceSnapshot.nutricion?.hasPlan && (
                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                          {nutriDiasSem > 0 && (
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                              {nutriDiasSem} {nutriDiasSem === 1 ? "día" : "días"}/sem{nutriDetalle ? ` · ${nutriDetalle}` : ""}
                                            </span>
                                          )}
                                          <span className="text-[10px] font-semibold text-[#6B7A8D] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded-full">
                                            {adherenceSnapshot.nutricion.dias_registrados}/{adherenceSnapshot.nutricion.dias_totales ?? adherenceSnapshot.nutricion.dias_registrados} días reg.
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {adherenceSnapshot.nutricion?.hasPlan ? (
                                  <div className="space-y-3">
                                    {/* Cumplimiento de menú + desglose semanal */}
                                    <div className="space-y-2">
                                      <div>
                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                          <span className="text-[#6B7A8D] font-medium">
                                            Cumplimiento de menú ({adherenceSnapshot.nutricion.comidas_realizadas}/{adherenceSnapshot.nutricion.comidas_total} com.)
                                          </span>
                                          <span className="font-bold text-[#0B1929]">{adherenceSnapshot.nutricion.pct_comidas}%</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-white border border-[#E2E8F0]/80 overflow-hidden">
                                          <div
                                            className="h-full rounded-full bg-emerald-500 transition-all"
                                            style={{ width: `${adherenceSnapshot.nutricion.pct_comidas}%` }}
                                          />
                                        </div>
                                      </div>

                                      {adherenceSnapshot.nutricion.semanas?.length > 0 && (
                                        <div className={`pt-1.5 border-t border-[#E2E8F0]/70 grid gap-1.5 ${
                                          adherenceSnapshot.nutricion.semanas.length > 4
                                            ? "grid-cols-4 sm:grid-cols-8"
                                            : "grid-cols-4"
                                        }`}>
                                          {adherenceSnapshot.nutricion.semanas.map((w) => (
                                            <div key={`food-${w.semana}`} className="text-center">
                                              <div className="h-8 bg-white border border-[#E2E8F0]/80 rounded-md flex items-end overflow-hidden p-0.5">
                                                <div
                                                  className={`w-full rounded-sm ${w.pctComidas > 0 ? "bg-emerald-400" : "bg-slate-200"}`}
                                                  style={{ height: `${Math.max(8, w.pctComidas)}%` }}
                                                />
                                              </div>
                                              <div className="text-[9px] font-bold text-[#0B1929] mt-0.5 leading-tight">
                                                S{w.semana} · {w.pctComidas}%
                                              </div>
                                              {w.comidasTotal != null && (
                                                <div className="text-[9px] text-[#6B7A8D] leading-tight">
                                                  {w.comidasRealizadas}/{w.comidasTotal}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Hidratación + desglose semanal */}
                                    <div className="pt-2.5 border-t border-[#E2E8F0]/80 space-y-2">
                                      <div>
                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                          <span className="text-[#6B7A8D] font-medium">
                                            Hidratación ({adherenceSnapshot.nutricion.promedio_agua_l} L/día prom.)
                                          </span>
                                          <span className="font-bold text-[#0B1929]">{adherenceSnapshot.nutricion.pct_agua}%</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-white border border-[#E2E8F0]/80 overflow-hidden">
                                          <div
                                            className="h-full rounded-full bg-blue-500 transition-all"
                                            style={{ width: `${adherenceSnapshot.nutricion.pct_agua}%` }}
                                          />
                                        </div>
                                      </div>

                                      {adherenceSnapshot.nutricion.semanas?.length > 0 && (
                                        <div className={`pt-1.5 border-t border-[#E2E8F0]/70 grid gap-1.5 ${
                                          adherenceSnapshot.nutricion.semanas.length > 4
                                            ? "grid-cols-4 sm:grid-cols-8"
                                            : "grid-cols-4"
                                        }`}>
                                          {adherenceSnapshot.nutricion.semanas.map((w) => {
                                            const pctW = Number(w.pctAgua) || 0;
                                            return (
                                              <div key={`water-${w.semana}`} className="text-center">
                                                <div className="h-8 bg-white border border-[#E2E8F0]/80 rounded-md flex items-end overflow-hidden p-0.5">
                                                  <div
                                                    className={`w-full rounded-sm ${pctW > 0 ? "bg-blue-400" : "bg-slate-200"}`}
                                                    style={{ height: `${Math.max(8, pctW)}%` }}
                                                  />
                                                </div>
                                                <div className="text-[9px] font-bold text-[#0B1929] mt-0.5 leading-tight">
                                                  S{w.semana} · {pctW}%
                                                </div>
                                                <div className="text-[9px] text-[#6B7A8D] leading-tight">
                                                  {w.promedioAguaL || "0.00"} L/d
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-[#6B7A8D] py-1">
                                    Sin plan de nutrición asignado en la app para este ciclo.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {showFollowUpView ? (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-xs font-bold text-[#0B1929] mb-1">
                              ¿Hubo cambios o desviaciones frecuentes fuera del menú? (Opcional)
                            </label>
                            <textarea
                              rows={2}
                              readOnly={isReadOnly}
                              value={form.r24h_picoteos || ""}
                              onChange={(e) => !isReadOnly && updForm("r24h_picoteos", e.target.value)}
                              placeholder="Ej. Cenas sociales los fines de semana, omitió la colación vespertina por trabajo, aumentó café..."
                              className={`w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0B1929] resize-none ${isReadOnly ? "cursor-default text-gray-700" : "focus:outline-none focus:border-[var(--brand-primary)]"}`}
                            />
                          </div>
                        </div>
                      ) : (
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
                      )}
                    </div>
                  );
                })()}

                {/* Paso 4: Mediciones Corporales y Antropometría */}
                <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      <div className="hidden sm:flex w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 items-center justify-center shrink-0">
                        <Ruler className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 uppercase tracking-wider inline-block">
                          Paso 4
                        </span>

                        <h3 className="text-sm sm:text-base font-bold text-[#0B1929] mt-1 sm:mt-0.5">
                          Mediciones Corporales y Antropometría
                        </h3>
                        <p className="hidden md:block text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Selecciona el protocolo de medición (Básico, Plicometría o Bioimpedancia) e ingresa las medidas corporales del paciente.
                        </p>
                      </div>
                    </div>

                    {/* Marcador de Sexo y Edad detectados del expediente */}
                    <div
                      className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 sm:px-3 py-1.5 shrink-0 select-none shadow-2xs"
                      title="Sexo y edad demográfica tomados del perfil/expediente del paciente para discretizar pliegues y ecuaciones"
                    >
                      <span className="text-xs font-bold text-[#0B1929]">
                        {hasDefinedSexo ? (evalSexo === "F" ? "Mujer" : "Hombre") : "Sexo s/d"}
                      </span>
                      <span className="text-xs text-[#CBD5E1]">·</span>
                      <span className="text-xs font-bold text-[#0B1929]">{evalEdad} {evalEdad === 1 ? "año" : "años"}</span>
                    </div>
                  </div>

                  {(!hasDefinedSexo || !hasDefinedEdad) && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        <strong>Expediente incompleto:</strong> No se ha definido{" "}
                        {!hasDefinedSexo && !hasDefinedEdad
                          ? "el sexo ni la fecha de nacimiento"
                          : !hasDefinedSexo
                          ? "el sexo"
                          : "la fecha de nacimiento"}{" "}
                        del paciente en su Expediente Clínico. Regístralo en su expediente para discretizar pliegues y constantes por edad/sexo con exactitud.
                      </span>
                    </div>
                  )}

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

                      {/* Botón de subir ticket InBody en el espacio donde estaban los 2 banners (Edad y Fecha) */}
                      {form.metodo_evaluacion === "inbody" && (
                        <div className="flex items-center gap-2">
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
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
                            title="Sube una foto o PDF del ticket (InBody 120, 270, 370, 570, Tanita) para autocompletar con IA"
                          >
                            {analyzingInbody ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                <span>Analizando ticket...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5 text-white" />
                                <span>Subir PDF o Foto del Ticket</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Banner de resultado de lectura OCR (si se acaba de procesar un ticket) */}
                    {form.metodo_evaluacion === "inbody" && inbodyOcrResult && (
                      <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
                        inbodyOcrResult.success
                          ? "bg-purple-50/90 border-purple-200 text-purple-950"
                          : "bg-red-50 border-red-200 text-red-800"
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {inbodyOcrResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <span className="truncate">
                            {inbodyOcrResult.success ? (
                              <>
                                ¡<strong>{inbodyOcrResult.count} valores extraídos</strong> desde <strong>{inbodyOcrResult.fileName}</strong>
                                {inbodyOcrResult.equipo ? ` (${inbodyOcrResult.equipo})` : ""}! Revisa los campos antes de guardar.
                              </>
                            ) : (
                              inbodyOcrResult.error
                            )}
                          </span>
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

                    {/* Sub-selector de Plicometría */}
                    {!isCivil && isPlicometria && (
                      <div className="flex gap-1.5 flex-wrap pt-2 border-t border-[#F0F4FA]">
                        {[
                          { id: "plicometria_jp3", label: "3 Pliegues (Jackson-Pollock)" },
                          { id: "plicometria_dw4", label: "4 Pliegues (Durnin-Womersley)" },
                          { id: "plicometria_faulkner", label: "4 Pliegues (Faulkner)" },
                          { id: "manual", label: "ISAK Completo (Carter 6 + Somatotipo)" },
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

                    {/* Diagnóstico de completitud del protocolo elegido */}
                    {(() => {
                      const diag = liveCalculations?.compositionDiagnostics;
                      if (!diag || !diag.missingLabels?.length) return null;
                      const showAlert =
                        (isPlicometria && diag.hasAny) ||
                        (effectiveMethod === "basico" && diag.hintTarget) ||
                        (effectiveMethod === "inbody" && (Boolean(form.peso) || diag.hasAny) && !diag.isComplete);
                      if (!showAlert) return null;
                      return (
                        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">
                            {isPlicometria ? (
                              <>
                                <strong>{diag.protocol}:</strong> faltan {diag.missingLabels.length}{" "}
                                {diag.missingLabels.length === 1 ? "pliegue" : "pliegues"} ({diag.missingLabels.join(", ")}) para calcular % grasa y MLG. Mientras tanto la TMB se respalda con fórmula general.
                              </>
                            ) : effectiveMethod === "inbody" ? (
                              <>
                                <strong>Bioimpedancia:</strong> falta {diag.missingLabels.join(" o ")} para usar lectura directa o Katch-McArdle sobre MLG.
                              </>
                            ) : (
                              <>
                                <strong>{diag.hintTarget}:</strong> falta {diag.missingLabels.join(", ")} para completar la estimación por circunferencias.
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Card 2: Grupos de Campos Antropométricos */}
                {activeGroups.map(group => (
                  <div key={group.label} className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm">
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
                <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-5">
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

                {/* Paso 5: Enfoque y Prescripción del Ciclo */}
                <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <div className="hidden sm:flex w-9 h-9 rounded-xl bg-blue-50 text-[var(--brand-primary)] items-center justify-center shrink-0">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--brand-primary)] uppercase tracking-wider">
                            Paso 5
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                            Enfoque y Prescripción del Ciclo
                          </h3>
                        </div>
                        <p className="hidden md:block text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                          Parámetros dinámicos exclusivos del plan actual para fijar el programa calórico y de macronutrientes de acuerdo a los objetivos generales del paciente.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Meta Ponderada (Peso Objetivo, Plazo Ligado al Plan y Meta Diaria de Pasos NEAT) */}
                  <div className="pt-1 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7A8D] mb-1">
                          Peso Objetivo (kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="25"
                          max="250"
                          disabled={isReadOnly}
                          value={form.eval_peso_objetivo || ""}
                          onChange={(e) => updForm("eval_peso_objetivo", e.target.value)}
                          placeholder={weightGoalPlaceholder}
                          title={weightGoalPlaceholder}
                          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-bold text-[#0B1929] placeholder:text-[10.5px] placeholder:font-medium placeholder-[#94A3B8] focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white transition-colors"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <label className="block text-[11px] font-bold text-[#6B7A8D] truncate">
                            Plazo Estimado (semanas)
                          </label>
                          {!isReadOnly && !planTimeStatus.isExpired && (
                            <button
                              type="button"
                              onClick={handleTriggerCreatePlan}
                              title="Iniciar un nuevo plan y pasar esta evaluación al nuevo ciclo"
                              className="text-[10px] font-bold text-[var(--brand-primary)] hover:underline cursor-pointer shrink-0"
                            >
                              + Nuevo plan
                            </button>
                          )}
                        </div>
                        {planTimeStatus.isExpired ? (
                          <div className="w-full bg-amber-50/80 border border-amber-300 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 min-h-[34px]">
                            <div className="min-w-0">
                              <span className="block text-[11px] font-extrabold text-amber-900 leading-tight truncate">
                                0 sem restantes
                              </span>
                              <span className="block text-[9.5px] text-amber-700 font-medium leading-tight truncate">
                                {planTimeStatus.hasPlan ? "Plan actual concluido" : "Sin plan activo"}
                              </span>
                            </div>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={handleTriggerCreatePlan}
                                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--brand-primary)] text-white text-[10.5px] font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Generar Nuevo Plan</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div
                            title={`${planTimeStatus.planTitle} · ${planTimeStatus.statusText}`}
                            className="w-full bg-[#F1F5F9]/80 border border-[#CBD5E1] rounded-xl px-3 py-2 flex items-center justify-between gap-2 min-h-[34px] select-none"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                              <span className="text-xs font-extrabold text-[#0B1929] truncate">
                                {planTimeStatus.remainingWeeks} {planTimeStatus.remainingWeeks === 1 ? "semana" : "semanas"}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-[#475569] border border-[#E2E8F0] truncate shrink-0">
                              {planTimeStatus.badgeText}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7A8D] mb-1 flex items-center gap-1">
                          <Footprints className="w-3 h-3 text-emerald-600" />
                          <span>Meta de Pasos / día (NEAT)</span>
                        </label>
                        <input
                          type="number"
                          step="500"
                          min="1000"
                          max="35000"
                          disabled={isReadOnly}
                          value={form.eval_meta_pasos || ""}
                          onChange={(e) => updForm("eval_meta_pasos", e.target.value)}
                          placeholder={String(DEFAULT_STEP_GOAL)}
                          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-bold text-[#0B1929] placeholder-[#94A3B8] focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white transition-colors"
                        />
                      </div>
                    </div>

                    {liveWeightGoalPlan && (() => {
                      const recInfo = getGoalPresetInfo(liveWeightGoalPlan.recommendedGoalId);
                      const isCurrentRec = (form.eval_objetivo || liveSmartMacros?.goalId) === liveWeightGoalPlan.recommendedGoalId;
                      const styleByStatus =
                        liveWeightGoalPlan.status === "agresivo"
                          ? "bg-amber-50/90 border-amber-300 text-amber-950"
                          : liveWeightGoalPlan.status === "lento"
                          ? "bg-indigo-50/80 border-indigo-200 text-indigo-950"
                          : "bg-emerald-50/80 border-emerald-200 text-emerald-950";
                      return (
                        <div className={`rounded-xl border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${styleByStatus}`}>
                          <div className="flex items-start gap-2 min-w-0">
                            {liveWeightGoalPlan.status === "agresivo" ? (
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            )}
                            <p className="text-[11px] leading-relaxed font-medium">
                              {liveWeightGoalPlan.message}
                            </p>
                          </div>
                          {recInfo && !isReadOnly && (
                            <button
                              type="button"
                              onClick={() => updForm("eval_objetivo", recInfo.id)}
                              className={`shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                isCurrentRec
                                  ? "bg-white/80 border-emerald-300 text-emerald-800"
                                  : "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] hover:opacity-90 shadow-2xs"
                              }`}
                            >
                              {isCurrentRec
                                ? `✓ Aplicado: ${recInfo.title} (${recInfo.pct > 0 ? "+" : ""}${recInfo.pct}%)`
                                : `Aplicar: ${recInfo.title} (${recInfo.pct > 0 ? "+" : ""}${recInfo.pct}%)`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Objetivo de la Etapa */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                      <label className="block text-xs font-bold text-[#6B7A8D]">
                        Objetivo Nutricional de este Ciclo
                      </label>
                      {recommendedCycleGoalId && (() => {
                        const recPreset = getGoalPresetInfo(recommendedCycleGoalId);
                        if (!recPreset) return null;
                        return (
                          <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                            Sugerido ({effectivePlanWeeks} sem): <strong>{recPreset.title} ({recPreset.pct > 0 ? `+${recPreset.pct}%` : `${recPreset.pct}%`})</strong>
                          </span>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {GOAL_PRESETS.map((g) => {
                        const isSelected = (form.eval_objetivo || liveSmartMacros.goalId) === g.id;
                        const isRecommended = recommendedCycleGoalId === g.id;
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
                                : isRecommended
                                ? "bg-emerald-50/40 border-emerald-300 text-[#0B1929] hover:border-emerald-400"
                                : "bg-[#F8FAFC] border-[#E2E8F0] text-[#6B7A8D] hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-xs font-bold truncate ${isSelected ? "text-[var(--brand-primary)]" : "text-[#0B1929]"}`}>
                                  {g.title}
                                </span>
                                {isRecommended && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider shrink-0">
                                    Recomendado
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ${
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

                  {/* Factor de Actividad Física (FAF) Proyectado */}
                  <div className="pt-2 border-t border-[#F0F4FA]">
                    <label className="block text-xs font-bold text-[#6B7A8D] mb-1.5">
                      Factor de Actividad Física (FAF) Proyectado
                    </label>
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
              </div>

              {/* Right Column: Sticky Live Clinical Summary & AI Macro Prescription */}
              <div className="lg:col-span-4 lg:sticky lg:top-20 lg:self-start flex flex-col gap-0 md:gap-4">
                <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] p-4 sm:p-5 shadow-none md:shadow-sm">
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
                <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-indigo-100 p-4 sm:p-5 shadow-none md:shadow-sm relative space-y-3.5">
                  <div className="hidden md:block absolute top-0 left-0 right-0 h-1 md:rounded-t-2xl bg-gradient-to-r from-[var(--brand-primary)] via-indigo-500 to-emerald-500" />
                  
                  {/* Cabecera */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#F0F4FA]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Calculator className="w-4 h-4 text-indigo-600 shrink-0" />
                      <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider truncate">
                        Prescripción de Macros
                      </h3>
                    </div>
                    {liveSmartMacros?.formulaShort && (
                      <button
                        type="button"
                        onClick={() => setShowFormulaPopover((v) => !v)}
                        aria-expanded={showFormulaPopover}
                        title="Clic para abrir o cerrar el comparador de ecuaciones TMB debajo de los macros"
                        className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          prescriptionMode === "ia"
                            ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-2xs"
                            : prescriptionMode === "manual"
                            ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                            : liveSmartMacros.formulaFallbackWarning
                            ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                            : liveSmartMacros.formulaMode === "manual"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                        }`}
                      >
                        {prescriptionMode === "ia" ? (
                          <>
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span>Auditado IA</span>
                            <span className="opacity-80 font-semibold">
                              · Base {liveSmartMacros.formulaShort}
                            </span>
                          </>
                        ) : prescriptionMode === "manual" ? (
                          <>
                            <Edit2 className="w-3 h-3 shrink-0" />
                            <span>Manual</span>
                            <span className="opacity-75 font-semibold">
                              · Base {liveSmartMacros.formulaShort}
                            </span>
                          </>
                        ) : (
                          <>
                            <Calculator className="w-3 h-3 shrink-0" />
                            <span>{liveSmartMacros.formulaShort}</span>
                            <span className="opacity-70 font-semibold">
                              · {liveSmartMacros.formulaMode === "manual" ? "Manual" : "Auto"}
                            </span>
                          </>
                        )}
                        <ChevronDown
                          className={`w-3 h-3 shrink-0 opacity-75 transition-transform duration-150 ${
                            showFormulaPopover ? "rotate-180" : ""
                          }`}
                        />
                      </button>
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
                      Ingresa el peso y la estatura en las mediciones para calcular la prescripción energética de esta etapa.
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
                            <div className="flex items-center justify-center gap-0.5 bg-white border border-blue-300 rounded-lg py-0.5 px-1.5 my-1 mx-auto w-full max-w-[4.75rem]">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={manualMacros.proteinG}
                                onChange={(e) => setManualMacros((p) => ({ ...p, proteinG: e.target.value }))}
                                placeholder="0"
                                className="w-full text-center text-xs font-black text-blue-900 bg-transparent focus:outline-none"
                              />
                              <span className="text-[10px] font-bold text-blue-700 shrink-0">g</span>
                            </div>
                          ) : (
                            <div className="text-base font-black text-[#0B1929] font-['Rajdhani']">
                              {activePrescription.proteinG}g
                            </div>
                          )}
                          <div className="text-[10px] text-blue-700 font-semibold whitespace-nowrap truncate">
                            {activePrescription.protGKg} g/kg · {activePrescription.proteinPct}%
                          </div>
                        </div>

                        {/* Carbos */}
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-emerald-700 uppercase">Carbos</div>
                          {prescriptionMode === "manual" ? (
                            <div className="flex items-center justify-center gap-0.5 bg-white border border-emerald-300 rounded-lg py-0.5 px-1.5 my-1 mx-auto w-full max-w-[4.75rem]">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={manualMacros.carbsG}
                                onChange={(e) => setManualMacros((p) => ({ ...p, carbsG: e.target.value }))}
                                placeholder="0"
                                className="w-full text-center text-xs font-black text-emerald-900 bg-transparent focus:outline-none"
                              />
                              <span className="text-[10px] font-bold text-emerald-700 shrink-0">g</span>
                            </div>
                          ) : (
                            <div className="text-base font-black text-[#0B1929] font-['Rajdhani']">
                              {activePrescription.carbsG}g
                            </div>
                          )}
                          <div className="text-[10px] text-emerald-700 font-semibold whitespace-nowrap truncate">
                            {activePrescription.carbGKg} g/kg · {activePrescription.carbsPct}%
                          </div>
                        </div>

                        {/* Grasas */}
                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-amber-700 uppercase">Grasas</div>
                          {prescriptionMode === "manual" ? (
                            <div className="flex items-center justify-center gap-0.5 bg-white border border-amber-300 rounded-lg py-0.5 px-1.5 my-1 mx-auto w-full max-w-[4.75rem]">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={manualMacros.fatsG}
                                onChange={(e) => setManualMacros((p) => ({ ...p, fatsG: e.target.value }))}
                                placeholder="0"
                                className="w-full text-center text-xs font-black text-amber-900 bg-transparent focus:outline-none"
                              />
                              <span className="text-[10px] font-bold text-amber-700 shrink-0">g</span>
                            </div>
                          ) : (
                            <div className="text-base font-black text-[#0B1929] font-['Rajdhani']">
                              {activePrescription.fatsG}g
                            </div>
                          )}
                          <div className="text-[10px] text-amber-700 font-semibold whitespace-nowrap truncate">
                            {activePrescription.fatGKg} g/kg · {activePrescription.fatsPct}%
                          </div>
                        </div>
                      </div>

                      {/* Bloque de Sustento y Comparador Integrado de Ecuaciones TMB (Debajo de los Macros, sin taparlos jamás) */}
                      {(prescriptionMode === "matematico" || showFormulaPopover) && !isAuditingAi && (
                        <div className="pt-3 border-t border-[#E2E8F0] sm:bg-[#F8FAFC] sm:border sm:rounded-xl sm:p-3.5 space-y-2.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Calculator className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="text-xs font-extrabold text-[#0B1929]">
                              {liveSmartMacros.activeFormulaInfo?.label || liveSmartMacros.formulaLabel}
                            </span>
                          </div>

                          {liveSmartMacros.formulaFallbackWarning && (
                            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5 leading-snug">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>{liveSmartMacros.formulaFallbackWarning}</span>
                            </div>
                          )}

                          <div className="space-y-1 text-[11px] leading-snug">
                            <p className="text-[#64748B] text-[10.5px]">
                              {liveSmartMacros.activeFormulaInfo?.populationText}
                            </p>
                            <p className="text-[#334155]">
                              {liveSmartMacros.formulaMode === "manual" && liveSmartMacros.manualComparisonNote
                                ? liveSmartMacros.manualComparisonNote
                                : liveSmartMacros.recommendationReason}
                            </p>
                          </div>

                          {liveSmartMacros.tmbSubstituted && (
                            <div className="bg-white rounded-lg border border-[#E2E8F0] px-2.5 py-2 space-y-1">
                              <div className="text-[10px] font-mono text-[#64748B] leading-snug break-words">
                                {liveSmartMacros.tmbEquationText || liveSmartMacros.activeFormulaInfo?.equationText}
                              </div>
                              <div className="pt-1 border-t border-[#F0F4FA] flex flex-col gap-0.5 text-[11px]">
                                <div className="font-bold text-[#0B1929]">
                                  TMB: {liveSmartMacros.tmbSubstituted}
                                </div>
                                {liveSmartMacros.matematico?.get > 0 && (
                                  <div className="text-[10.5px] font-semibold text-indigo-700">
                                    GET = {liveSmartMacros.matematico.tmb} × {liveSmartMacros.faf} (FAF) = {liveSmartMacros.matematico.get} kcal/día
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Acordeón integrado de fórmulas con previsualización de kcal en vivo */}
                          {showFormulaPopover && (
                            <div className="pt-2.5 border-t border-[#E2E8F0] space-y-2.5 animate-in fade-in duration-150">
                              {[
                                { id: "clinicas", title: "Clínicas y Generales", items: TMB_FORMULAS.filter((f) => f.group === "clinicas") },
                                { id: "composicion", title: "Composición Corporal y Deportivas", items: [BIA_FORMULA_INFO, ...TMB_FORMULAS.filter((f) => f.group === "composicion")] },
                              ].map((grp) => (
                                <div key={grp.id} className="space-y-1.5">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                                    {grp.title}
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {grp.items.map((f) => {
                                      const missingMlg = f.requiresMLG && !(liveSmartMacros.mlg > 0);
                                      const missingBia = f.requiresInBody && !(liveSmartMacros.biaBmr > 0);
                                      const missingHeight = f.requiresHeight && !(liveSmartMacros.estatura > 0);
                                      const unavailable = missingMlg || missingBia || missingHeight;
                                      const isRecommended = liveSmartMacros.recommendedFormula === f.id;
                                      const isSelected = liveSmartMacros.formula === f.id;
                                      const fTmb = !unavailable
                                        ? calculateTMB({
                                            formula: f.id,
                                            peso: liveSmartMacros.peso,
                                            estatura: liveSmartMacros.estatura,
                                            edad: liveSmartMacros.edad,
                                            sexo: liveSmartMacros.sexo,
                                            mlg: liveSmartMacros.mlg,
                                            biaBmr: liveSmartMacros.biaBmr,
                                          })
                                        : 0;
                                      const fGet = fTmb > 0 ? Math.round(fTmb * (liveSmartMacros.faf || 1.55)) : 0;

                                      return (
                                        <button
                                          key={f.id}
                                          type="button"
                                          disabled={isReadOnly || unavailable}
                                          title={
                                            missingBia
                                              ? "Requiere método Bioimpedancia con TMB Basal capturado"
                                              : missingMlg
                                              ? "Requiere % de grasa / MLG completo en Paso 4"
                                              : missingHeight
                                              ? "Requiere ingresar estatura en Paso 4"
                                              : f.populationText
                                          }
                                          onClick={() => {
                                            if (isReadOnly || unavailable) return;
                                            updForm("eval_tmb_formula", isRecommended ? "auto" : f.id);
                                            if (prescriptionMode !== "matematico") setPrescriptionMode("matematico");
                                          }}
                                          className={`px-2.5 py-1.5 rounded-xl text-left border transition-all ${
                                            unavailable
                                              ? "bg-gray-50/80 text-gray-300 border-gray-200 cursor-not-allowed"
                                              : isSelected && isRecommended
                                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs cursor-pointer"
                                              : isSelected
                                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs cursor-pointer"
                                              : isRecommended
                                              ? "bg-indigo-50/70 text-indigo-950 border-indigo-200 hover:border-indigo-400 cursor-pointer"
                                              : isReadOnly
                                              ? "bg-white text-[#0B1929] border-[#E2E8F0] cursor-default"
                                              : "bg-white text-[#0B1929] border-[#E2E8F0] hover:border-indigo-300 cursor-pointer"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="text-[11px] font-bold truncate">
                                              {f.shortLabel || f.label}
                                            </span>
                                            {isSelected ? (
                                              <span className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold uppercase px-1 py-0.2 rounded bg-white/20 text-white shrink-0">
                                                {isRecommended ? "Auto" : "Manual"}
                                                <Check className="w-2.5 h-2.5" />
                                              </span>
                                            ) : isRecommended && !unavailable ? (
                                              <span className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold uppercase px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 shrink-0">
                                                Auto
                                              </span>
                                            ) : null}
                                          </div>
                                          <div
                                            className={`text-[9.5px] font-semibold truncate mt-0.5 ${
                                              unavailable
                                                ? "text-gray-400"
                                                : isSelected
                                                ? "text-white/85"
                                                : "text-[#64748B]"
                                            }`}
                                          >
                                            {unavailable
                                              ? missingBia
                                                ? "Requiere TMB BIA"
                                                : missingMlg
                                                ? "Requiere MLG"
                                                : "Requiere Estatura"
                                              : `TMB ${fTmb} · GET ${fGet} kcal`}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {aiAuditError && (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 mt-1">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <strong className="block font-semibold">Servicio de IA:</strong>
                                <p className="text-[11px] leading-relaxed text-amber-800">{aiAuditError}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bloque de Auditoría Clínica con FLUX IA (Solo visible cuando está activo Auditado IA o cargando) */}
                      {(prescriptionMode === "ia" || isAuditingAi) && (
                        <div className="pt-3 border-t border-indigo-100 sm:bg-gradient-to-br sm:from-indigo-50/60 sm:to-blue-50/30 sm:border sm:border-indigo-100 sm:rounded-xl sm:p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-indigo-600" />
                              <span className="text-xs font-bold text-[#0B1929]">
                                Auditoría Clínica con FLUX IA
                              </span>
                            </div>
                            {aiAuditResult?.badgeMotivo && !isAuditingAi ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200/60">
                                {aiAuditResult.badgeMotivo}
                              </span>
                            ) : null}
                          </div>

                          {/* Estado de Carga */}
                          {isAuditingAi && (
                            <div className="p-3 rounded-lg bg-white/90 border border-indigo-100 flex items-center gap-2.5 text-xs text-indigo-900 shadow-xs">
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                              <span className="font-medium">
                                FLUX IA está auditando expediente, check-in, adherencia, R24H y antropometría...
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
                                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Prescripción IA activa ({aiAuditResult.targetKcal} kcal · Base {liveSmartMacros.formulaShort})
                                </span>

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
                        <div className="pt-3 border-t border-amber-200/70 sm:bg-gradient-to-br sm:from-amber-50/50 sm:via-white sm:to-amber-50/30 sm:border sm:border-amber-200/80 sm:rounded-2xl sm:p-3.5 space-y-2.5 sm:shadow-xs">
                          {/* Cabecera del Simulador Inline en una sola línea sin la píldora Ajuste Fino */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <SlidersHorizontal className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="text-xs font-bold text-[#0B1929] truncate">
                                Simulador Manual
                              </span>
                            </div>

                            {/* Switcher: g/kg vs % */}
                            <div className="flex bg-amber-100/60 p-0.5 rounded-lg border border-amber-200/70 shrink-0">
                              <button
                                type="button"
                                onClick={() => setManualSimMode("g_kg")}
                                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-all cursor-pointer whitespace-nowrap ${
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
                                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                  manualSimMode === "pct"
                                    ? "bg-white text-amber-900 shadow-2xs"
                                    : "text-[#6B7A8D] hover:text-[#0B1929]"
                                }`}
                              >
                                % Calorías
                              </button>
                            </div>
                          </div>

                          {/* Campo abierto de porcentaje sobre GET (- / + %) en una sola fila compacta */}
                          {(() => {
                            const curGoalPct = Number(activePrescription.goalPct) || 0;
                            const activeSign = gKgDraft.goalSign || (curGoalPct > 0 ? "+" : "−");
                            const absPctVal =
                              gKgDraft.goalPct !== null && gKgDraft.goalPct !== undefined
                                ? gKgDraft.goalPct
                                : Math.abs(curGoalPct);
                            return (
                              <div className="bg-white/90 border border-amber-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-2xs">
                                <div className="min-w-0">
                                  <span className="block text-[11px] font-bold text-[#0B1929] truncate">
                                    Ajuste sobre GET ({activePrescription.get} kcal)
                                  </span>
                                  <span className="block text-[10px] font-semibold text-[#6B7A8D] truncate">
                                    {curGoalPct < 0
                                      ? `Déficit (${curGoalPct}%) → ${activePrescription.targetKcal} kcal`
                                      : curGoalPct > 0
                                      ? `Superávit (+${curGoalPct}%) → ${activePrescription.targetKcal} kcal`
                                      : `Mantenimiento (0%) → ${activePrescription.targetKcal} kcal`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className="inline-flex bg-amber-100/70 p-0.5 rounded-lg border border-amber-200/80">
                                    <button
                                      type="button"
                                      disabled={isReadOnly}
                                      onClick={() => {
                                        setGKgDraft((d) => ({ ...d, goalSign: "−" }));
                                        const n = parseFloat(absPctVal);
                                        if (!isNaN(n) && n > 0) handleSetGoalPreset(-Math.abs(n));
                                      }}
                                      title="Déficit (−%)"
                                      className={`px-2 py-0.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                                        activeSign === "−"
                                          ? "bg-amber-600 text-white shadow-2xs"
                                          : "text-[#6B7A8D] hover:text-[#0B1929]"
                                      }`}
                                    >
                                      −
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isReadOnly}
                                      onClick={() => {
                                        setGKgDraft((d) => ({ ...d, goalSign: "+" }));
                                        const n = parseFloat(absPctVal);
                                        if (!isNaN(n) && n > 0) handleSetGoalPreset(Math.abs(n));
                                      }}
                                      title="Superávit (+%)"
                                      className={`px-2 py-0.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                                        activeSign === "+"
                                          ? "bg-emerald-600 text-white shadow-2xs"
                                          : "text-[#6B7A8D] hover:text-[#0B1929]"
                                      }`}
                                    >
                                      +
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-0.5 bg-[#F8FAFC] border border-amber-300 rounded-lg px-2 py-0.5">
                                    <input
                                      type="number"
                                      step="1"
                                      min="0"
                                      max="60"
                                      disabled={isReadOnly}
                                      value={absPctVal}
                                      placeholder="0"
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        let nextSign = activeSign;
                                        if (raw.startsWith("-")) nextSign = "−";
                                        else if (raw.startsWith("+")) nextSign = "+";
                                        const cleanRaw = raw.replace(/^[+-]/, "");
                                        setGKgDraft((d) => ({ ...d, goalPct: cleanRaw, goalSign: nextSign }));
                                        const num = parseFloat(cleanRaw);
                                        if (!isNaN(num) && num >= 0 && num <= 70) {
                                          handleSetGoalPreset(num === 0 ? 0 : nextSign === "+" ? num : -num);
                                        }
                                      }}
                                      onBlur={() => setGKgDraft((d) => ({ ...d, goalPct: null }))}
                                      className="w-9 text-center text-xs font-black text-[#0B1929] bg-transparent focus:outline-none"
                                    />
                                    <span className="text-[11px] font-extrabold text-amber-800">%</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Controles Dinámicos según modo g_kg vs pct */}
                          {manualSimMode === "g_kg" ? (
                            <div className="space-y-2.5">
                              {/* Slider Proteína g/kg */}
                              {(() => {
                                const protVal = Math.min(3.5, Math.max(1.0, Number(activePrescription.protGKg) || 2.0));
                                const protFillPct = Math.round(((protVal - 1.0) / (3.5 - 1.0)) * 100);
                                return (
                                  <div className="bg-white/90 border border-blue-200/80 rounded-xl px-3 py-2.5 space-y-2 shadow-2xs">
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-xs font-bold text-blue-900">Proteína</span>
                                        <span className="text-[10.5px] font-semibold text-[#64748B]">
                                          {activePrescription.proteinG}g · {activePrescription.proteinPct}%
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-xs font-black text-blue-700 font-['Rajdhani']">
                                          {activePrescription.protGKg} g/kg
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => handleAdjustProtGKg(Math.max(1.0, Number((activePrescription.protGKg - 0.1).toFixed(1))))}
                                            className="w-5 h-5 rounded-md bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 hover:bg-blue-100 flex items-center justify-center cursor-pointer"
                                          >
                                            −
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => handleAdjustProtGKg(Math.min(3.5, Number((activePrescription.protGKg + 0.1).toFixed(1))))}
                                            className="w-5 h-5 rounded-md bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 hover:bg-blue-100 flex items-center justify-center cursor-pointer"
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
                                      value={protVal}
                                      onChange={(e) => handleAdjustProtGKg(Number(e.target.value))}
                                      style={{
                                        background: `linear-gradient(to right, #2563EB 0%, #2563EB ${protFillPct}%, #DBEAFE ${protFillPct}%, #DBEAFE 100%)`,
                                      }}
                                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:shadow-sm"
                                    />
                                  </div>
                                );
                              })()}

                              {/* Slider Grasas g/kg */}
                              {(() => {
                                const fatVal = Math.min(2.0, Math.max(0.5, Number(activePrescription.fatGKg) || 0.9));
                                const fatFillPct = Math.round(((fatVal - 0.5) / (2.0 - 0.5)) * 100);
                                return (
                                  <div className="bg-white/90 border border-amber-200/80 rounded-xl px-3 py-2.5 space-y-2 shadow-2xs">
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-xs font-bold text-amber-900">Grasas</span>
                                        <span className="text-[10.5px] font-semibold text-[#64748B]">
                                          {activePrescription.fatsG}g · {activePrescription.fatsPct}%
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-xs font-black text-amber-700 font-['Rajdhani']">
                                          {activePrescription.fatGKg} g/kg
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => handleAdjustFatGKg(Math.max(0.5, Number((activePrescription.fatGKg - 0.05).toFixed(2))))}
                                            className="w-5 h-5 rounded-md bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 flex items-center justify-center cursor-pointer"
                                          >
                                            −
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => handleAdjustFatGKg(Math.min(2.0, Number((activePrescription.fatGKg + 0.05).toFixed(2))))}
                                            className="w-5 h-5 rounded-md bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 flex items-center justify-center cursor-pointer"
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
                                      value={fatVal}
                                      onChange={(e) => handleAdjustFatGKg(Number(e.target.value))}
                                      style={{
                                        background: `linear-gradient(to right, #D97706 0%, #D97706 ${fatFillPct}%, #FEF3C7 ${fatFillPct}%, #FEF3C7 100%)`,
                                      }}
                                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-600 [&::-webkit-slider-thumb]:shadow-sm"
                                    />
                                  </div>
                                );
                              })()}

                              {/* Carbohidratos: Balance Residual */}
                              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                                <div className="text-[11px] text-emerald-950 min-w-0">
                                  <strong className="block font-bold truncate">Carbohidratos de balance</strong>
                                  <span className="text-[10px] text-[#475569] block truncate">Cuadran las calorías restantes</span>
                                </div>
                                <div className="text-right shrink-0 whitespace-nowrap">
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
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-3 gap-2">
                                {(() => {
                                  const pPct = Math.min(50, Math.max(15, Number(activePrescription.proteinPct) || 30));
                                  const pFill = Math.round(((pPct - 15) / (50 - 15)) * 100);
                                  return (
                                    <div className="bg-white/90 border border-blue-200 rounded-xl p-2.5 text-center space-y-1.5">
                                      <div className="text-[10px] font-bold text-blue-700 uppercase">
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
                                        value={pPct}
                                        onChange={(e) => handleAdjustPct("p", Number(e.target.value))}
                                        style={{
                                          background: `linear-gradient(to right, #2563EB 0%, #2563EB ${pFill}%, #DBEAFE ${pFill}%, #DBEAFE 100%)`,
                                        }}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:shadow-sm"
                                      />
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const cPct = Math.min(70, Math.max(10, Number(activePrescription.carbsPct) || 45));
                                  const cFill = Math.round(((cPct - 10) / (70 - 10)) * 100);
                                  return (
                                    <div className="bg-white/90 border border-emerald-200 rounded-xl p-2.5 text-center space-y-1.5">
                                      <div className="text-[10px] font-bold text-emerald-700 uppercase">
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
                                        value={cPct}
                                        onChange={(e) => handleAdjustPct("c", Number(e.target.value))}
                                        style={{
                                          background: `linear-gradient(to right, #059669 0%, #059669 ${cFill}%, #D1FAE5 ${cFill}%, #D1FAE5 100%)`,
                                        }}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-600 [&::-webkit-slider-thumb]:shadow-sm"
                                      />
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const fPct = Math.min(50, Math.max(15, Number(activePrescription.fatsPct) || 25));
                                  const fFill = Math.round(((fPct - 15) / (50 - 15)) * 100);
                                  return (
                                    <div className="bg-white/90 border border-amber-200 rounded-xl p-2.5 text-center space-y-1.5">
                                      <div className="text-[10px] font-bold text-amber-700 uppercase">
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
                                        value={fPct}
                                        onChange={(e) => handleAdjustPct("f", Number(e.target.value))}
                                        style={{
                                          background: `linear-gradient(to right, #D97706 0%, #D97706 ${fFill}%, #FEF3C7 ${fFill}%, #FEF3C7 100%)`,
                                        }}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-600 [&::-webkit-slider-thumb]:shadow-sm"
                                      />
                                    </div>
                                  );
                                })()}
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

                          {/* Base de Sustento: Restaurar Matemático */}
                          <div className="pt-2 border-t border-amber-200/70 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                            <button
                              type="button"
                              disabled={isReadOnly}
                              onClick={handleCopyFromMath}
                              className="font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                              <span>Restablecer cálculo matemático ({liveSmartMacros?.matematico?.targetKcal || liveSmartMacros?.targetKcal} kcal)</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Cuadro Dietosintético SMAE del Ciclo (Nace en el Paso 5 junto con los Macros) ── */}
                      {(() => {
                        const smaeTotals = calculateSmaeTotals(effectiveSmaeDistribution);
                        const activeGroups = SMAE_GROUPS.filter((g) => (Number(effectiveSmaeDistribution[g.id]) || 0) > 0);
                        const targetK = Number(activePrescription?.targetKcal) || 0;
                        const adequacyPct = targetK > 0 ? Math.round((smaeTotals.kcal / targetK) * 100) : 100;
                        const syncSourceLabel = prescriptionMode === "ia"
                          ? "Con IA"
                          : prescriptionMode === "manual"
                          ? "Manual"
                          : "Matemático";

                        return (
                          <div className="pt-3 border-t border-emerald-200/80 sm:bg-emerald-50/50 sm:border sm:border-emerald-200/80 sm:rounded-2xl sm:p-3.5 space-y-2.5 sm:shadow-2xs">
                            {/* Fila 1: Título y Acciones */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                                <span className="text-xs font-bold text-emerald-950">Equivalentes SMAE</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                  {smaeTotals.totalEquivalentes} eq · {smaeTotals.kcal} kcal ({adequacyPct}%)
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {isCustomSmaeActive && !isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => setCustomSmaeMap(null)}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer flex items-center gap-1 shadow-2xs"
                                    title="Volver a sincronizar con las Kcal y Macros de arriba"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span className="hidden sm:inline">Reset</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setShowStep5SmaeTable((v) => !v)}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                >
                                  <span>{showStep5SmaeTable ? "Compactar" : "Personalizar eq"}</span>
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showStep5SmaeTable ? "rotate-180" : ""}`} />
                                </button>
                              </div>
                            </div>

                            {/* Fila 2: Subtítulo Sincronizado a ancho completo (garantizado en 1 sola línea) */}
                            <div className="text-[10px] text-emerald-800/80 font-medium flex items-center gap-1.5 whitespace-nowrap overflow-x-auto no-scrollbar pt-0.5">
                              <span>
                                {isCustomSmaeActive ? (
                                  <strong className="text-emerald-950 font-bold">Ajuste manual</strong>
                                ) : (
                                  <>Sincronizado: <strong className="text-emerald-950 font-bold">{syncSourceLabel}</strong></>
                                )}
                              </span>
                              <span className="text-emerald-400">•</span>
                              <span className="font-mono text-emerald-950 font-semibold">
                                {smaeTotals.proteina}g P · {smaeTotals.carbohidratos}g C · {smaeTotals.grasas}g G
                              </span>
                            </div>

                            {/* VISTA 1: Compacta (Rejilla simétrica de 2 columnas para los equivalentes activos con advertencia visual) */}
                            {!showStep5SmaeTable && (
                              <div className="grid grid-cols-2 gap-1.5">
                                {activeGroups.map((g) => {
                                  const isDisgusto = form.smae_gustos?.[g.id] === "disgusto";
                                  const isFavorito = form.smae_gustos?.[g.id] === "favorito";
                                  return (
                                    <div
                                      key={g.id}
                                      className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-xl border transition-all ${
                                        isDisgusto
                                          ? "bg-rose-50/80 border-rose-300 shadow-2xs"
                                          : isFavorito
                                          ? "bg-emerald-50/80 border-emerald-300 shadow-2xs"
                                          : "bg-white border-emerald-200/70 shadow-2xs"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className="text-xs shrink-0">{g.icono}</span>
                                        <span className="text-[10.5px] font-bold text-[#0B1929] truncate" title={g.corto}>{g.corto}</span>
                                        {isDisgusto && (
                                          <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200 shrink-0" title="Al paciente le disgusta este grupo">
                                            ⚠️ Evitar
                                          </span>
                                        )}
                                        {isFavorito && (
                                          <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0" title="Grupo favorito del paciente">
                                            💚 Fav
                                          </span>
                                        )}
                                      </div>
                                      <span className={`text-xs font-mono font-extrabold px-1.5 py-0.5 rounded-md border shrink-0 ${
                                        isDisgusto
                                          ? "text-rose-700 bg-rose-100 border-rose-200"
                                          : isFavorito
                                          ? "text-emerald-800 bg-emerald-100 border-emerald-300"
                                          : "text-emerald-700 bg-emerald-50 border-emerald-100"
                                      }`}>
                                        {effectiveSmaeDistribution[g.id]}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* VISTA 2: Personalización expandida (1 sola columna, espaciosa, con alertas de preferencia) */}
                            {showStep5SmaeTable && (
                              <div className="space-y-2 pt-1 border-t border-emerald-200/60 animate-in fade-in duration-150">
                                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                  {SMAE_GROUPS.map((grp) => {
                                    const eqVal = Number(effectiveSmaeDistribution[grp.id]) || 0;
                                    const isDisgusto = form.smae_gustos?.[grp.id] === "disgusto";
                                    const isFavorito = form.smae_gustos?.[grp.id] === "favorito";
                                    return (
                                      <div
                                        key={grp.id}
                                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
                                          isDisgusto
                                            ? "bg-rose-50/50 border-rose-300 shadow-2xs"
                                            : isFavorito
                                            ? "bg-emerald-50/50 border-emerald-300 shadow-2xs"
                                            : eqVal > 0
                                            ? "bg-white border-emerald-300 shadow-2xs"
                                            : "bg-white/60 border-gray-200 opacity-65 hover:opacity-100"
                                        }`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-sm shrink-0">{grp.icono}</span>
                                            <span className="text-xs font-bold text-[#0B1929] whitespace-nowrap" title={grp.nombre}>
                                              {grp.corto}
                                            </span>
                                            {isDisgusto && (
                                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 shrink-0">
                                                <Ban className="w-2.5 h-2.5" />
                                                <span>Evitar (0 eq rec.)</span>
                                              </span>
                                            )}
                                            {isFavorito && (
                                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                                                <Heart className="w-2.5 h-2.5 fill-emerald-600" />
                                                <span>Favorito</span>
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] text-gray-500 font-mono mt-0.5 whitespace-nowrap">
                                            1 eq = {grp.kcal} kcal · {grp.proteina}P · {grp.carbohidratos}C · {grp.grasas}G
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            disabled={isReadOnly || eqVal <= 0}
                                            onClick={() => adjustStep5Smae(grp.id, -0.5)}
                                            className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center disabled:opacity-30 cursor-pointer active:scale-95 transition-transform"
                                            title="Restar 0.5 eq"
                                          >
                                            -
                                          </button>
                                          <span className={`w-8 text-center text-xs font-extrabold font-mono ${
                                            isDisgusto && eqVal > 0 ? "text-rose-700 font-black" : "text-[#0B1929]"
                                          }`}>
                                            {eqVal}
                                          </span>
                                          <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => adjustStep5Smae(grp.id, 0.5)}
                                            className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center disabled:opacity-30 cursor-pointer active:scale-95 transition-transform ${
                                              isDisgusto ? "bg-rose-100 hover:bg-rose-200 text-rose-800" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                                            }`}
                                            title="Sumar 0.5 eq"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-mono text-emerald-900 bg-white/90 px-3 py-2 rounded-xl border border-emerald-200/80 shadow-2xs">
                                  <span className="font-bold">Aporte SMAE:</span>
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
                            Sincronizar automáticamente estas metas ({activePrescription.targetKcal} kcal · {prescriptionMode === "ia" ? "Con IA" : prescriptionMode === "manual" ? "Manual" : "Matemático"}) al Plan Nutricional activo al guardar
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

      {/* Modal: Editar Tracking Nutricional (Comidas y Agua de cualquier semana) */}
      {nutriEditModal && createPortal(
        <div
          onClick={() => !savingTracking && setNutriEditModal(null)}
          className="fixed inset-0 z-[120] bg-[#0B1929]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-4 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-emerald-600 shrink-0" />
                  <h3 className="text-sm font-bold text-[#0B1929] truncate">
                    {nutriEditModal.dia.nombre || nutriEditModal.dia.dia_semana || "Día del Plan"}
                  </h3>
                </div>
                <p className="text-[11px] text-[#6B7A8D] mt-0.5">
                  Semana {nutriEditModal.semanaObj.weekNum} · {nutriEditModal.semanaObj.label}
                  {nutriEditModal.semanaObj.isCurrent && " (Actual)"}
                </p>
              </div>
              <button
                type="button"
                disabled={savingTracking}
                onClick={() => setNutriEditModal(null)}
                className="p-1.5 rounded-lg text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-200/70 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Comidas cumplidas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#0B1929]">
                    Comidas cumplidas (
                    {(nutriEditModal.dia.comidas || []).filter((c, ci) => nutriEditModal.comidasDone?.[c.id || String(ci)]).length}
                    /{(nutriEditModal.dia.comidas || []).length})
                  </span>
                  {(nutriEditModal.dia.comidas || []).length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const allOn = {};
                          (nutriEditModal.dia.comidas || []).forEach((c, ci) => {
                            allOn[c.id || String(ci)] = true;
                          });
                          setNutriEditModal((prev) => ({ ...prev, comidasDone: allOn }));
                        }}
                        className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                      >
                        Marcar todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setNutriEditModal((prev) => ({ ...prev, comidasDone: {} }))}
                        className="text-[10px] font-bold px-2 py-1 rounded-md bg-gray-100 text-[#6B7A8D] border border-gray-200 hover:bg-gray-200 cursor-pointer"
                      >
                        Desmarcar
                      </button>
                    </div>
                  )}
                </div>

                {(nutriEditModal.dia.comidas || []).length === 0 ? (
                  <p className="text-xs text-[#6B7A8D] italic py-2">Este día no tiene comidas asignadas.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(nutriEditModal.dia.comidas || []).map((c, ci) => {
                      const key = c.id || String(ci);
                      const checked = Boolean(nutriEditModal.comidasDone?.[key]);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setNutriEditModal((prev) => ({
                              ...prev,
                              comidasDone: {
                                ...(prev.comidasDone || {}),
                                [key]: !checked,
                              },
                            }))
                          }
                          className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                            checked
                              ? "bg-emerald-50/70 border-emerald-300 text-[#0B1929]"
                              : "bg-white border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-colors ${
                                checked
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "bg-white border-gray-300"
                              }`}
                            >
                              {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className={`text-xs font-semibold truncate ${checked ? "text-[#0B1929]" : "text-[#475569]"}`}>
                              {c.nombre || `Comida ${ci + 1}`}
                            </span>
                          </div>
                          {c.hora && (
                            <span className="text-[10px] font-mono text-[#6B7A8D] shrink-0">{c.hora}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Agua registrada */}
              <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                <label className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-500" />
                  <span>Agua registrada (Litros)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="0.00"
                    value={nutriEditModal.aguaLitros}
                    onChange={(e) => setNutriEditModal((prev) => ({ ...prev, aguaLitros: e.target.value }))}
                    className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-bold text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                  <span className="text-xs font-bold text-[#6B7A8D] pr-1">L</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: "0 L", action: () => setNutriEditModal((p) => ({ ...p, aguaLitros: "" })) },
                    {
                      label: "+0.25 L",
                      action: () =>
                        setNutriEditModal((p) => ({
                          ...p,
                          aguaLitros: String(Number(((parseFloat(p.aguaLitros || "0") || 0) + 0.25).toFixed(2))),
                        })),
                    },
                    {
                      label: "+0.50 L",
                      action: () =>
                        setNutriEditModal((p) => ({
                          ...p,
                          aguaLitros: String(Number(((parseFloat(p.aguaLitros || "0") || 0) + 0.5).toFixed(2))),
                        })),
                    },
                    {
                      label: "+1.00 L",
                      action: () =>
                        setNutriEditModal((p) => ({
                          ...p,
                          aguaLitros: String(Number(((parseFloat(p.aguaLitros || "0") || 0) + 1).toFixed(2))),
                        })),
                    },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={btn.action}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 cursor-pointer"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={savingTracking}
                onClick={() => setNutriEditModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#6B7A8D] hover:bg-gray-200/70 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingTracking}
                onClick={handleSaveNutriTracking}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-95 shadow-sm flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {savingTracking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Guardar cambios</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Editar Tracking de Rutina (Peso y Reps de cualquier serie/semana) */}
      {rutinaEditModal && createPortal(
        <div
          onClick={() => !savingTracking && setRutinaEditModal(null)}
          className="fixed inset-0 z-[120] bg-[#0B1929]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
          >
            <div className="px-4 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
                  <h3 className="text-sm font-bold text-[#0B1929] truncate">
                    {rutinaEditModal.exObj?.nombre || rutinaEditModal.ej?.nombre}
                  </h3>
                </div>
                <p className="text-[11px] text-[#6B7A8D] mt-0.5">
                  Serie {rutinaEditModal.si + 1} · Semana {rutinaEditModal.wi + 1} ({rutinaEditModal.semanaLabel})
                  {rutinaEditModal.vid !== "original" && " · Alternativa"}
                </p>
              </div>
              <button
                type="button"
                disabled={savingTracking}
                onClick={() => setRutinaEditModal(null)}
                className="p-1.5 rounded-lg text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-200/70 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveRutinaTracking();
              }}
              className="p-4 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0B1929] block">
                    Peso ({rutinaEditModal.unit.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus={rutinaEditModal.focusField === "peso"}
                    disabled={rutinaEditModal.isFalta}
                    placeholder="Ej. 60"
                    value={rutinaEditModal.pesoInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!/^-?\d*\.?\d*$/.test(raw) && raw !== "") return;
                      setRutinaEditModal((prev) => ({ ...prev, pesoInput: raw, isFalta: false }));
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-bold text-center text-[#0B1929] disabled:opacity-40 focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0B1929] block">
                    Repeticiones
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus={rutinaEditModal.focusField === "reps"}
                    disabled={rutinaEditModal.isFalta}
                    placeholder="Ej. 10"
                    value={rutinaEditModal.repsInput}
                    onChange={(e) =>
                      setRutinaEditModal((prev) => ({ ...prev, repsInput: e.target.value, isFalta: false }))
                    }
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-bold text-center text-[#0B1929] disabled:opacity-40 focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingTracking}
                  onClick={() =>
                    setRutinaEditModal((prev) => ({
                      ...prev,
                      isFalta: !prev.isFalta,
                      pesoInput: !prev.isFalta ? "" : prev.pesoInput,
                      repsInput: !prev.isFalta ? "" : prev.repsInput,
                    }))
                  }
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    rutinaEditModal.isFalta
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{rutinaEditModal.isFalta ? "Marcado como Falta" : "Marcar Falta"}</span>
                </button>
                <button
                  type="button"
                  disabled={savingTracking}
                  onClick={() => handleSaveRutinaTracking("clear")}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-gray-100 text-[#6B7A8D] border border-gray-200 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={savingTracking}
                  onClick={() => setRutinaEditModal(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#6B7A8D] hover:bg-gray-200/70 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTracking}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-95 shadow-sm flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  {savingTracking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Lightbox */}
      {lightbox&&createPortal(
        <div onClick={()=>setLightbox(null)} className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] cursor-zoom-out p-4">
          {/\.(mp4|webm|mov)($|\?)/i.test(lightbox) ? (
            <video src={lightbox} autoPlay loop muted playsInline controls className="max-w-[90vw] max-h-[90vh] rounded-[14px] object-contain shadow-2xl" />
          ) : (
            <img src={lightbox} className="max-w-[90vw] max-h-[90vh] rounded-[14px] object-contain shadow-2xl" alt=""/>
          )}
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

      <ConfirmModal
        isOpen={Boolean(promoteModal)}
        onClose={() => setPromoteModal(null)}
        onConfirm={handleConfirmPromote}
        title="Promover a Ejercicio Principal"
        description={
          promoteModal?.hasOrigData
            ? `Al promover "${promoteModal?.alt?.nombre}" a principal, el ejercicio anterior ("${promoteModal?.ej?.nombre}") pasará a guardarse como alternativa para conservar su historial de semanas previas.`
            : `El ejercicio original ("${promoteModal?.ej?.nombre}") nunca tuvo registros en este ciclo. Al promover "${promoteModal?.alt?.nombre}", el anterior se eliminará de la rutina para mantenerla limpia y sin filas vacías.`
        }
        confirmText="Promover a Principal"
        cancelText="Cancelar"
        danger={false}
        icon="alert"
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
