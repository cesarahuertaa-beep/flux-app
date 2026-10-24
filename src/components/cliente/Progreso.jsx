import { useState, useEffect, useCallback, useRef } from "react";
import Model from "@phelian/react-body-highlighter";
import { dbGet, storageUpload, storageListFolder, storageDelete } from "../../lib/supabase";
import { Activity, Scale, Ruler, BicepsFlexed, TrendingUp, TrendingDown, Minus, Lock, Camera, Image as ImageIcon, UploadCloud, Trash2, X, ChevronDown, Layers } from "lucide-react";
import { parseFotos } from "../../utils/helpers";
import { useBrand } from "../BrandContext";
import { EvolutionCharts } from "../ui/EvolutionCharts";
import { BeforeAfterComparator } from "../ui/BeforeAfterComparator";
import { MetricsSkeleton } from "../ui/Skeleton";
import { useBackButton } from "../../lib/backButtonHandler";
import { CachedImage, precacheMediaList } from "../../lib/mediaCache";

const EXACT_GROUPS = [
  "pecho", "abdomen", "oblicuos", "deltoide_anterior", "deltoide_posterior",
  "trapecio", "dorsal", "lumbar", "biceps", "triceps", "antebrazo",
  "gluteo", "cuadriceps", "isquiotibial", "pantorrilla", "aductor",
  "abductor", "soleo", "cuello"
];

// ── Helpers ──
const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
};

const delta = (curr, prev, key) => {
  if (curr[key] == null || prev[key] == null || curr[key] === "" || prev[key] === "") return null;
  const d = parseFloat(curr[key]) - parseFloat(prev[key]);
  return d === 0 ? 0 : d;
};

const calcular1RM = (peso, reps) => {
  const p = parseFloat(peso), r = parseFloat(reps);
  if (!p || !r || p <= 0 || r <= 0) return null;
  if (r === 1) return p;
  return p * (1 + r / 30);
};

const normalizeGroup = (g) => {
  if (!g) return "otro";
  const str = g.toLowerCase().trim();
  if (EXACT_GROUPS.includes(str)) return str;
  if (str.includes("pecho") || str.includes("pectoral")) return "pecho";
  if (str.includes("espalda") || str.includes("dorsal")) return "dorsal";
  if (str.includes("pierna") || str.includes("cuádriceps") || str.includes("cuadriceps")) return "cuadriceps";
  if (str.includes("glúteo") || str.includes("gluteo")) return "gluteo";
  if (str.includes("isquio")) return "isquiotibial";
  if (str.includes("pantorrilla")) return "pantorrilla";
  if (str.includes("bíceps") || str.includes("biceps") || str.includes("brazo")) return "biceps";
  if (str.includes("tríceps") || str.includes("triceps")) return "triceps";
  if (str.includes("antebrazo")) return "antebrazo";
  if (str.includes("hombro") || str.includes("deltoide")) return "deltoide_anterior";
  if (str.includes("abdomen") || str.includes("core")) return "abdomen";
  return "otro";
};

const RANKS = [
  { name: "Clase G", min: 0, color: "#94A3B8", level: 1 }, // Gris claro
  { name: "Clase F", min: 100, color: "#64748B", level: 1 }, // Gris oscuro
  { name: "Clase E", min: 300, color: "#4ADE80", level: 2 }, // Verde claro
  { name: "Clase D", min: 600, color: "#16A34A", level: 2 }, // Verde oscuro
  { name: "Clase C", min: 1000, color: "#60A5FA", level: 3 }, // Azul claro
  { name: "Clase B", min: 1500, color: "#2563EB", level: 3 }, // Azul oscuro
  { name: "Clase A", min: 2100, color: "#A855F7", level: 4 }, // Morado
  { name: "Clase S", min: 2800, color: "#FBBF24", level: 5 }, // Amarillo
  { name: "Clase SS", min: 3600, color: "#F97316", level: 5 }, // Naranja
  { name: "Clase SSS", min: 4500, color: "#EF4444", level: 6 } // Rojo
];

const getRank = (xp) => {
  return [...RANKS].reverse().find(r => xp >= r.min) || RANKS[0];
};

export default function Progreso({ cliente, isSelfManaged }) {
  const [metricas, setMetricas] = useState([]);
  const [groupAvg, setGroupAvg] = useState({});
  const [loading, setLoading] = useState(true);
  const brand = useBrand();
  const isEstandar = cliente && !cliente.nutriologo_id && cliente.plan_tipo !== 'premium' && cliente.objetivo !== 'Mi entrenamiento personal';
  const currentBodyType = cliente?.genero === 'Femenino' ? 'female' : 'male';
  
  const [view, setView] = useState('metricas');
  const [personalPhotos, setPersonalPhotos] = useState([]);
  const [uploadingPersonal, setUploadingPersonal] = useState(false);
  const [fullImage, setFullImage] = useState(null);
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const fileInputRef = useRef(null);

  useBackButton(!!fullImage, () => setFullImage(null), 100);

  const loadData = useCallback(async () => {
    if (!cliente?.id) return;
    setLoading(true);
    try {
      // 1. Cargar métricas de composición
      const ms = await dbGet(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`);
      setMetricas(ms);

      // 2. Calcular progreso muscular
      const [ciclosActivos, rutinas, progs] = await Promise.all([
        dbGet(`ciclos?cliente_id=eq.${cliente.id}&activo=eq.true&limit=1`),
        dbGet(`rutinas?cliente_id=eq.${cliente.id}&select=id,ciclo_id,ejercicios(id,grupo_muscular)`),
        dbGet(`progreso?cliente_id=eq.${cliente.id}&limit=3000`)
      ]);

      const ejMap = {};
      rutinas.forEach(r => {
        r.ejercicios?.forEach(e => { ejMap[e.id] = e.grupo_muscular; });
      });

      // Identificar qué grupos musculares existen realmente en la rutina semanal activa del usuario
      const cicloActivoId = ciclosActivos?.[0]?.id || null;
      const activeRutinas = cicloActivoId
        ? rutinas.filter(r => r.ciclo_id === cicloActivoId)
        : rutinas;
      const sourceRutinas = activeRutinas.length > 0 ? activeRutinas : rutinas;

      const routineMuscleGroups = new Set();
      sourceRutinas.forEach(r => {
        r.ejercicios?.forEach(e => {
          const norm = normalizeGroup(e.grupo_muscular);
          if (EXACT_GROUPS.includes(norm)) {
            routineMuscleGroups.add(norm);
          }
        });
      });

      const byEj = {};
      progs.forEach(p => {
        if (!byEj[p.ejercicio_id]) byEj[p.ejercicio_id] = {};
        if (!byEj[p.ejercicio_id][p.semana]) byEj[p.ejercicio_id][p.semana] = {};
        if (!byEj[p.ejercicio_id][p.semana][p.serie]) byEj[p.ejercicio_id][p.semana][p.serie] = {};
        byEj[p.ejercicio_id][p.semana][p.serie][p.tipo] = p.valor;
      });

      const muscleXP = {};
      EXACT_GROUPS.forEach(g => { muscleXP[g] = 0; });

      const allWeeks = new Set();
      for (const ejId in byEj) {
         Object.keys(byEj[ejId]).forEach(w => allWeeks.add(Number(w)));
      }
      const sortedWeeks = Array.from(allWeeks).sort((a,b)=>a-b);
      const minWeek = sortedWeeks[0] || 1;
      const maxWeek = sortedWeeks[sortedWeeks.length - 1] || 1;

      const muscleStarted = {};
      EXACT_GROUPS.forEach(g => { muscleStarted[g] = false; });
      const last1RM = {}; 

      for (let w = minWeek; w <= maxWeek; w++) {
         const musclesTrainedThisWeek = new Set();
         
         for (const ejId in byEj) {
            const g = normalizeGroup(ejMap[ejId]);
            if (!muscleXP.hasOwnProperty(g)) continue;

            const weekData = byEj[ejId][w];
            if (weekData) {
               muscleStarted[g] = true;
               musclesTrainedThisWeek.add(g);
               
               const s1 = weekData[1]; // serie 1
               if (s1 && s1.peso && s1.reps) {
                  const current1RM = calcular1RM(s1.peso, s1.reps);
                  if (current1RM) {
                     if (last1RM[ejId]) {
                        const pctGrowth = ((current1RM - last1RM[ejId]) / last1RM[ejId]) * 100;
                        muscleXP[g] += Math.round(pctGrowth);
                     }
                     last1RM[ejId] = current1RM;
                  }
               }
            }
         }

         // Puntos por consistencia
         for (const g of EXACT_GROUPS) {
            if (!muscleStarted[g]) continue;
            if (musclesTrainedThisWeek.has(g)) {
               muscleXP[g] += 10;
            } else {
               muscleXP[g] -= 15;
            }
            if (muscleXP[g] < 0) muscleXP[g] = 0;
         }
      }

      // Filtrar inteligentemente: solo mostrar grupos que estén en la rutina semanal (o que ya tengan XP > 0)
      const filteredMuscleXP = {};
      EXACT_GROUPS.forEach(g => {
        if (routineMuscleGroups.has(g) || muscleXP[g] > 0) {
          filteredMuscleXP[g] = muscleXP[g];
        }
      });

      setGroupAvg(filteredMuscleXP);

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [cliente]);

  const loadPersonalPhotos = useCallback(async () => {
    if (!cliente?.id) return;
    const cacheKey = `flux_personal_photos_${cliente.id}`;
    // Cargar primero de local para disponibilidad instantánea y offline
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setPersonalPhotos(parsed);
      }
    } catch (e) {}

    try {
      const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
      const indexUrl = `${SUPA_URL}/storage/v1/object/public/progress-photos/${cliente.id}/personal/index.json?t=${Date.now()}`;
      const r = await fetch(indexUrl);
      if (r.ok) {
        const urls = await r.json();
        const validUrls = Array.isArray(urls) ? urls : [];
        setPersonalPhotos(validUrls);
        try { localStorage.setItem(cacheKey, JSON.stringify(validUrls)); } catch (e) {}
        precacheMediaList(validUrls).catch(() => {});
      }
    } catch (e) {
      console.warn("Sin conexión o error cargando fotos personales, usando versión local.");
    }
  }, [cliente?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (view === 'galeria') loadPersonalPhotos(); }, [view, loadPersonalPhotos]);

  const saveIndex = async (urls) => {
    try {
      const cacheKey = `flux_personal_photos_${cliente.id}`;
      try { localStorage.setItem(cacheKey, JSON.stringify(urls)); } catch (e) {}
      precacheMediaList(urls).catch(() => {});

      const indexPath = `${cliente.id}/personal/index.json`;
      await storageDelete("progress-photos", indexPath).catch(() => {}); // Ignore error if it doesn't exist
      const blob = new Blob([JSON.stringify(urls)], { type:"application/json" });
      await storageUpload("progress-photos", indexPath, blob);
    } catch (e) {
      console.error("Error saving index", e);
    }
  };

  const handlePersonalUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPersonal(true);
    try {
      const newUrls = [];
      for (const file of Array.from(files)) {
        const path = `${cliente.id}/personal/${Date.now()}_${file.name.replace(/\s+/g,"_")}`;
        const url = await storageUpload("progress-photos", path, file);
        newUrls.push(url);
      }
      
      const updatedUrls = [...personalPhotos, ...newUrls];
      await saveIndex(updatedUrls);
      setPersonalPhotos(updatedUrls);
    } catch (error) {
      console.error(error);
      alert("Error subiendo fotos personales.");
    } finally {
      setUploadingPersonal(false);
      if (fileInputRef.current) fileInputRef.current.value ="";
    }
  };

  const handlePersonalDelete = async (url) => {
    if (!confirm("¿Eliminar esta foto personal?")) return;
    try {
      const pathPart = url.split("progress-photos/")[1];
      if (pathPart) {
        await storageDelete("progress-photos", pathPart).catch(() => {});
      }
      const updatedUrls = personalPhotos.filter(u => u !== url);
      await saveIndex(updatedUrls);
      setPersonalPhotos(updatedUrls);
    } catch (e) {
      console.error("Error deleting", e);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-[#F7F9FC] min-h-full">
        <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 bg-white border-b border-[#F0F4FA] pr-12 md:pr-8">
          <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">Mi Seguimiento</p>
          <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>Mis Resultados</h1>
          <p className="text-sm text-[#6B7A8D] mt-1">Cargando tu historial de evolución...</p>
        </div>
        <div className="px-6 md:px-8 py-6 md:py-8 max-w-5xl w-full mx-auto">
          <MetricsSkeleton />
        </div>
      </div>
    );
  }

  const current = metricas[0] || {};
  const prev = metricas[1] || {};

  const COMP_KEYS = [
    { key:"inbody_score", label:"SCORE INBODY", unit:"pts" },
    { key:"peso", label:"PESO", unit:"kg" },
    { key:"grasa_pct", label:"GRASA CORPORAL", unit:"%" },
    { key:"calc_masa_grasa", label:"MASA GRASA", unit:"kg" },
    { key:"musculo_pct", label:"MASA MUSCULAR", unit:"%" },
    { key:"calc_masa_muscular", label:"MASA MUSCULAR", unit:"kg" },
    { key:"inbody_smm", label:"MASA MUSCULAR (SMM)", unit:"kg" },
    { key:"imc", label:"IMC", unit:"" },
    { key:"agua_pct", label:"AGUA CORPORAL", unit:"%" },
    { key:"inbody_tbw", label:"AGUA CORPORAL", unit:"L" },
    { key:"masa_osea", label:"MASA ÓSEA", unit:"kg" },
    { key:"calc_masa_osea", label:"MASA ÓSEA", unit:"kg" },
    { key:"calc_masa_residual", label:"MASA RESIDUAL", unit:"kg" },
    { key:"inbody_grasa_visceral", label:"GRASA VISCERAL", unit:"lvl" },
    { key:"inbody_bmr", label:"METABOLISMO BASAL", unit:"kcal" },
    { key:"cintura", label:"CINTURA", unit:"cm" },
    { key:"cadera", label:"CADERA", unit:"cm" },
    { key:"icc", label:"ICC", unit:"" },
    { key:"pecho", label:"PECHO", unit:"cm" },
    { key:"brazo", label:"BRAZO", unit:"cm" },
    { key:"brazo_relajado", label:"BRAZO", unit:"cm" },
    { key:"muslo", label:"MUSLO", unit:"cm" },
    { key:"pantorrilla", label:"PANTORRILLA", unit:"cm" },
  ].filter(k => current[k.key] != null && current[k.key] !==""); // Solo mostrar los que tienen datos

  // ── Selección de métricas principales (Top 4) y secundarias ──
  const preferredPrimaryKeys = [
    "peso",
    "grasa_pct",
    current.inbody_smm != null && current.inbody_smm !== ""
      ? "inbody_smm"
      : current.calc_masa_muscular != null && current.calc_masa_muscular !== ""
      ? "calc_masa_muscular"
      : "musculo_pct",
    current.imc != null && current.imc !== "" ? "imc" : "inbody_score"
  ];

  const primaryKeys = [];
  preferredPrimaryKeys.forEach(pk => {
    const found = COMP_KEYS.find(k => k.key === pk);
    if (found && !primaryKeys.some(p => p.key === found.key)) {
      primaryKeys.push(found);
    }
  });

  // Completar hasta 4 si alguna preferida no está registrada
  COMP_KEYS.forEach(k => {
    if (primaryKeys.length < 4 && !primaryKeys.some(p => p.key === k.key)) {
      primaryKeys.push(k);
    }
  });

  const secondaryKeys = COMP_KEYS.filter(k => !primaryKeys.some(p => p.key === k.key));

  const GROUP_LABELS = {
    pecho: "Pecho",
    abdomen: "Abdomen",
    oblicuos: "Oblicuos",
    deltoide_anterior: "Deltoide Ant.",
    deltoide_posterior: "Deltoide Post.",
    trapecio: "Trapecio",
    dorsal: "Dorsal",
    lumbar: "Lumbar",
    biceps: "Bíceps",
    triceps: "Tríceps",
    antebrazo: "Antebrazo",
    gluteo: "Glúteo",
    cuadriceps: "Cuádriceps",
    isquiotibial: "Isquiotibial",
    pantorrilla: "Pantorrilla",
    aductor: "Aductor",
    abductor: "Abductor",
    soleo: "Sóleo",
    cuello: "Cuello"
  };

  const getBodyData = (groups) => {
    const data = [];
    
    const getFrequency = (val) => {
      if (!val || val <= 0) return 0;
      const r = getRank(val);
      return r.level;
    };

    if (groups.pecho) data.push({ name: 'Pecho', muscles: ['chest'], frequency: getFrequency(groups.pecho) });
    if (groups.abdomen) data.push({ name: 'Abdomen', muscles: ['abs'], frequency: getFrequency(groups.abdomen) });
    if (groups.oblicuos) data.push({ name: 'Oblicuos', muscles: ['obliques'], frequency: getFrequency(groups.oblicuos) });
    if (groups.deltoide_anterior) data.push({ name: 'Deltoide Ant.', muscles: ['front-deltoids'], frequency: getFrequency(groups.deltoide_anterior) });
    if (groups.deltoide_posterior) data.push({ name: 'Deltoide Post.', muscles: ['back-deltoids'], frequency: getFrequency(groups.deltoide_posterior) });
    if (groups.trapecio) data.push({ name: 'Trapecio', muscles: ['trapezius'], frequency: getFrequency(groups.trapecio) });
    if (groups.dorsal) data.push({ name: 'Dorsal', muscles: ['upper-back'], frequency: getFrequency(groups.dorsal) });
    if (groups.lumbar) data.push({ name: 'Lumbar', muscles: ['lower-back'], frequency: getFrequency(groups.lumbar) });
    if (groups.biceps) data.push({ name: 'Bíceps', muscles: ['biceps'], frequency: getFrequency(groups.biceps) });
    if (groups.triceps) data.push({ name: 'Tríceps', muscles: ['triceps'], frequency: getFrequency(groups.triceps) });
    if (groups.antebrazo) data.push({ name: 'Antebrazo', muscles: ['forearm'], frequency: getFrequency(groups.antebrazo) });
    if (groups.gluteo) data.push({ name: 'Glúteo', muscles: ['gluteal'], frequency: getFrequency(groups.gluteo) });
    if (groups.cuadriceps) data.push({ name: 'Cuádriceps', muscles: ['quadriceps'], frequency: getFrequency(groups.cuadriceps) });
    if (groups.isquiotibial) data.push({ name: 'Isquiotibial', muscles: ['hamstring'], frequency: getFrequency(groups.isquiotibial) });
    if (groups.pantorrilla) data.push({ name: 'Pantorrilla', muscles: ['calves'], frequency: getFrequency(groups.pantorrilla) });
    if (groups.aductor) data.push({ name: 'Aductor', muscles: ['adductor'], frequency: getFrequency(groups.aductor) });
    if (groups.abductor) data.push({ name: 'Abductor', muscles: ['abductors'], frequency: getFrequency(groups.abductor) });
    if (groups.soleo) data.push({ name: 'Sóleo', muscles: ['left-soleus', 'right-soleus'], frequency: getFrequency(groups.soleo) });
    if (groups.cuello) data.push({ name: 'Cuello', muscles: ['neck'], frequency: getFrequency(groups.cuello) });

    return data;
  };


  const nutriPhotos = metricas.flatMap(m => parseFotos(m.fotos)).filter(Boolean);
  const allComparablePhotos = [
    ...metricas.flatMap(m =>
      parseFotos(m.fotos)
        .filter(Boolean)
        .map((url, idx) => ({
          url,
          fecha: m.fecha,
          label: `Eval. ${fmtDate(m.fecha)}`,
          peso: m.peso,
          grasa_pct: m.grasa_pct,
        }))
    ),
    ...personalPhotos.map((url, idx) => ({
      url,
      fecha: null,
      label: `Personal #${personalPhotos.length - idx}`,
      peso: null,
      grasa_pct: null,
    })),
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] min-h-full">
      {/* HEADER ESTÁNDAR */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 bg-white border-b border-[#F0F4FA] flex flex-col sm:flex-row sm:items-end justify-between gap-4 pr-12 md:pr-8">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
            Mi Seguimiento
          </p>
          <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
            Mis Resultados
          </h1>
          <p className="text-sm text-[#6B7A8D] mt-1">
            {current.fecha ? `Última evaluación: ${fmtDate(current.fecha)}` : "Aún no hay evaluaciones registradas"}
          </p>
        </div>

        <div className="flex bg-[#F0F4FA] p-1 rounded-xl w-max">
          <button
            onClick={() => setView('metricas')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'metricas' ? 'bg-white text-[var(--brand-primary)] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
          >
            Métricas
          </button>
          <button
            onClick={() => setView('galeria')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'galeria' ? 'bg-white text-[var(--brand-primary)] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
          >
            Galería
          </button>
        </div>
      </div>

      <div className="px-6 md:px-8 py-6 md:py-8 pb-6 md:pb-8 max-w-5xl w-full mx-auto space-y-8">
        {view === 'metricas' && (
          <>
          {COMP_KEYS.length > 0 ? (
            <>
              {/* ── TOP 4 MÉTRICAS DESTACADAS ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {primaryKeys.map(k => {
                  const val = current[k.key];
                  const hasPrev = metricas.length > 1;
                  const d = (!isEstandar && hasPrev) ? delta(current, prev, k.key) : null;
                  let colorClass = "text-[#6B7A8D]";
                  let Icon = Minus;
                  let sign = "";
                  
                  if (d !== null) {
                    const isImprovement = k.key.includes("grasa") || k.key.includes("cintura") || k.key.includes("cadera") || k.key.includes("icc") ? d < 0 : d > 0;
                    colorClass = isImprovement ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-rose-600 bg-rose-50 border-rose-100";
                    Icon = d > 0 ? TrendingUp : TrendingDown;
                    sign = d > 0 ? "+" : "";
                  }

                  return (
                    <div 
                      key={k.key} 
                      className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-[#E2E8F0] flex flex-col justify-between hover:border-[#CBD5E1] transition-all"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <p className="text-[10px] md:text-[11px] font-bold text-[#6B7A8D] tracking-wider uppercase truncate">
                          {k.label}
                        </p>
                        {k.key === "peso" && <Scale className="w-3.5 h-3.5 text-[#9BA5B0] shrink-0" />}
                        {k.key.includes("grasa") && <Activity className="w-3.5 h-3.5 text-[#9BA5B0] shrink-0" />}
                        {(k.key.includes("musculo") || k.key.includes("smm")) && <BicepsFlexed className="w-3.5 h-3.5 text-[#9BA5B0] shrink-0" />}
                        {k.key === "imc" && <Ruler className="w-3.5 h-3.5 text-[#9BA5B0] shrink-0" />}
                      </div>
                      
                      <div className="flex items-baseline gap-1 my-1">
                        <span className="text-2xl md:text-3xl font-black text-[#0B1929] font-['Rajdhani'] tracking-tight">
                          {val}
                        </span>
                        {k.unit && (
                          <span className="text-xs font-bold text-[#9BA5B0]">
                            {k.unit}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#F8FAFC] flex items-center justify-between">
                        {d !== null ? (
                          <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                            <Icon size={12} />
                            <span>{sign}{d.toFixed(1)} {k.unit}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#9BA5B0]">Registro base</span>
                        )}
                        {isEstandar && hasPrev && (
                          <span className="text-[10px] text-amber-500 font-bold">Premium</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── ACORDEÓN DESPLEGABLE: MEDIDAS ADICIONALES ── */}
              {secondaryKeys.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setShowAllMetrics(prev => !prev)}
                    className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-gray-50/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#F0F4FA] flex items-center justify-center text-[var(--brand-primary)]">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs md:text-sm font-bold text-[#0B1929]">
                          {showAllMetrics ? "Ocultar medidas complementarias" : "Ver más medidas y composición"}
                        </span>
                        <span className="text-[11px] text-[#6B7A8D] ml-2 font-normal">
                          ({secondaryKeys.length} {secondaryKeys.length === 1 ? "métrica adicional" : "métricas adicionales"})
                        </span>
                      </div>
                    </div>
                    <div className={`w-7 h-7 rounded-lg bg-[#F0F4FA] flex items-center justify-center text-[#6B7A8D] transition-transform duration-200 ${showAllMetrics ? "rotate-180" : ""}`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {showAllMetrics && (
                    <div className="p-4 pt-2 border-t border-[#F0F4FA] bg-[#F8FAFC]">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-2">
                        {secondaryKeys.map(k => {
                          const val = current[k.key];
                          const hasPrev = metricas.length > 1;
                          const d = (!isEstandar && hasPrev) ? delta(current, prev, k.key) : null;
                          let colorClass = "text-[#6B7A8D]";
                          let Icon = Minus;
                          let sign = "";
                          
                          if (d !== null) {
                            const isImprovement = k.key.includes("grasa") || k.key.includes("cintura") || k.key.includes("cadera") || k.key.includes("icc") ? d < 0 : d > 0;
                            colorClass = isImprovement ? "text-emerald-600" : "text-rose-600";
                            Icon = d > 0 ? TrendingUp : TrendingDown;
                            sign = d > 0 ? "+" : "";
                          }

                          return (
                            <div 
                              key={k.key} 
                              className="bg-white rounded-xl p-3 border border-[#E2E8F0] shadow-2xs text-center flex flex-col justify-between"
                            >
                              <p className="text-[10px] font-bold text-[#6B7A8D] tracking-wide uppercase truncate mb-1">
                                {k.label}
                              </p>
                              <div className="text-base md:text-lg font-bold text-[#0B1929] font-['Rajdhani']">
                                {val} {k.unit && <span className="text-[10px] font-normal text-[#9BA5B0]">{k.unit}</span>}
                              </div>
                              {d !== null ? (
                                <div className={`flex items-center justify-center gap-0.5 text-[10px] font-bold mt-1 ${colorClass}`}>
                                  <Icon size={11} />
                                  <span>{sign}{d.toFixed(1)}{k.unit}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-transparent select-none mt-1">—</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* GRÁFICAS DE EVOLUCIÓN Y SOMATOCARTA */}
            <EvolutionCharts
              metricas={metricas}
              isLocked={isEstandar}
              brandColor={brand?.color_primario}
            />
          </>
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-[#E2E8F0]">
            <Scale className="w-12 h-12 text-[#9BA5B0] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#0B1929] mb-2">Sin métricas de composición</h3>
            <p className="text-sm text-[#6B7A8D]">{isSelfManaged ? "Aún no has registrado ninguna evaluación física." : "Tu nutriólogo aún no ha registrado evaluaciones físicas."}</p>
          </div>
        )}

        {/* EVALUACIÓN MUSCULAR (Simétrico) */}
        <div className="relative">
          {isEstandar && (
            <div className="absolute inset-0 z-50 backdrop-blur-md bg-[#0B1929]/75 rounded-3xl flex flex-col items-center justify-center p-6 text-center border border-[#1E2D3D]">
              <Lock size={48} className="text-amber-400 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Desarrollo Muscular Premium</h3>
              <p className="text-slate-200 text-sm max-w-sm mb-6">Descubre qué músculos han crecido más, obtén tu rango de atleta y visualiza tu mapa de calor según tu entrenamiento real.</p>
              <div className="text-[11px] uppercase tracking-widest font-bold text-amber-400 bg-amber-500/20 border border-amber-500/30 px-4 py-2 rounded-lg">Adquiere Premium en Mi Membresía</div>
            </div>
          )}
          <div className={`bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#E2E8F0] overflow-hidden relative ${isEstandar ? 'pointer-events-none select-none opacity-40 blur-sm' : ''}`}>
          
          <h2 className="text-lg font-bold text-[#0B1929] mb-2 relative z-10">Desarrollo Muscular</h2>
          <p className="text-sm text-[#9BA5B0] mb-8 relative z-10">Progreso de fuerza estimado según tu historial de entrenamiento.</p>
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-10 relative z-10">
            <div className="flex flex-row justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.25)] w-full lg:w-[340px] shrink-0">
              <div className="flex justify-center gap-2 md:gap-4 w-full max-w-[340px] mx-auto">
                  <div className="w-1/2 flex justify-center">
                    <Model 
                      bodyType={currentBodyType}
                      data={getBodyData(groupAvg)} 
                      style={{ width: '100%', maxWidth: '10.5rem', padding: '0.25rem' }} 
                      highlightedColors={["#9BA5B0","#10B981","#3B82F6","#8B5CF6","#F59E0B","#EF4444"]}
                      type="anterior"
                    />
                  </div>
                  <div className="w-1/2 flex justify-center">
                    <Model 
                      bodyType={currentBodyType}
                      data={getBodyData(groupAvg)} 
                      style={{ width: '100%', maxWidth: '10.5rem', padding: '0.25rem' }} 
                      highlightedColors={["#9BA5B0","#10B981","#3B82F6","#8B5CF6","#F59E0B","#EF4444"]}
                      type="posterior"
                    />
                  </div>
                </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 md:p-5 w-full flex-1">
              <div className="flex items-center justify-between mb-3.5">
                <p className="text-[11px] font-bold text-[#6B7A8D] tracking-widest uppercase">RANGOS ALCANZADOS</p>
                <span className="text-[10px] font-semibold text-[#9BA5B0]">Segun tu rutina activa</span>
              </div>
              {Object.keys(groupAvg).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(groupAvg).sort((a,b)=>b[1]-a[1]).map(([g, pct]) => {
                    const rank = getRank(pct);
                    const label = GROUP_LABELS[g] || g.replace(/_/g, " ");
                    return (
                      <div key={g} className="bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-[0_1px_2px_rgba(11,25,41,0.02)]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: rank.color }} />
                          <span className="text-xs md:text-sm font-semibold text-[#0B1929] truncate capitalize">{label}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold whitespace-nowrap leading-tight" style={{ color: rank.color }}>{rank.name}</p>
                          <p className="text-[10px] font-mono text-[#6B7A8D] leading-tight mt-0.5">{pct} XP</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[#6B7A8D] text-center py-4">Aún no hay suficiente historial para calcular avances.</p>
              )}
            </div>
          </div>

          {/* Leyenda de rangos */}
          <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
            <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest text-center mb-4">ESCALA DE EVOLUCIÓN</p>
            <div className="flex flex-wrap justify-center gap-3">
              {[...RANKS].slice(1).reverse().map(r => (
                <div key={r.name} className="flex items-center gap-1.5 bg-[#F8FAFC] px-3 py-1.5 rounded-full border border-[#E2E8F0]">
                  <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  <span className="text-[10px] font-bold text-[#0B1929] uppercase">{r.name}</span>
                  <span className="text-[10px] font-semibold text-[#9BA5B0]">{r.min} XP</span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 md:p-5 flex gap-3 text-left max-w-2xl mx-auto">
              <div className="text-[var(--brand-primary)] shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0B1929] mb-1">¿Cómo ganar puntos de experiencia (XP)?</h4>
                <p className="text-xs text-[#6B7A8D] leading-relaxed">
                  Tu XP sube de dos maneras:<br/>
                  <strong className="text-[#0B1929]">1. Consistencia:</strong> Ganas <strong>+10 XP</strong> por cada semana que entrenes un músculo.<br/>
                  <strong className="text-[#0B1929]">2. Sobrecarga Progresiva:</strong> Ganas XP extra equivalente al <strong>% de fuerza estimada (1RM)</strong> que hayas mejorado respecto a tu mejor marca.<br/>
                  <span className="text-amber-600 font-bold mt-1 block">¡Pero cuidado! Si dejas de entrenar un músculo durante una semana, perderás -15 XP en esa zona.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
        </>
        )}

        {view === 'galeria' && (
          <div className="space-y-10">
            {allComparablePhotos.length >= 2 && (
              <BeforeAfterComparator
                photos={allComparablePhotos}
                brand={brand}
                clienteNombre={cliente?.nombre}
              />
            )}

            {/* Sección Evaluaciones */}
            {nutriPhotos.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6 border-b border-[#E2E8F0] pb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: brand?.color_primario ? `${brand.color_primario}15` : '#F0F4FA', color: brand?.color_primario || '#1A6FD4' }}>
                    <ImageIcon size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-[#0B1929]">{isSelfManaged ? "Fotos de Evaluaciones" : "Fotos de tu Nutriólogo"}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {nutriPhotos.map((url, i) => (
                    <div 
                      key={i} 
                      className="aspect-square rounded-2xl overflow-hidden cursor-pointer border border-[#E2E8F0] shadow-sm group relative"
                      onClick={() => setFullImage(url)}
                    >
                      <CachedImage
                        src={url}
                        alt={`Progreso evaluación ${i}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        fallback={<ImageIcon size={32} className="text-[#9BA5B0] m-auto" />}
                      />
                      <div className="absolute inset-0 bg-[#0B1929]/0 group-hover:bg-[#0B1929]/20 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sección Personal */}
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: brand?.color_primario ? `${brand.color_primario}15` : '#ecfdf5', color: brand?.color_primario || '#059669' }}>
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0B1929]">Galería Personal (Privada)</h3>
                    <p className="text-xs text-[#6B7A8D]">Solo tú puedes ver estas fotos</p>
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPersonal}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 hover:opacity-80"
                  style={{ backgroundColor: brand?.color_primario ? `${brand.color_primario}15` : '#F0F4FA', color: brand?.color_primario || '#0B1929' }}
                >
                  <Camera size={16} />
                  {uploadingPersonal ?"Subiendo..." :"Agregar fotos"}
                </button>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handlePersonalUpload} 
                />
              </div>

              {personalPhotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {personalPhotos.map((url, i) => (
                    <div 
                      key={i} 
                      className="aspect-square rounded-2xl overflow-hidden cursor-pointer border border-[#E2E8F0] shadow-sm group relative"
                      onClick={() => setFullImage(url)}
                    >
                      <CachedImage 
                        src={url} 
                        alt={`Progreso personal ${i}`} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        fallback={<Camera size={32} className="text-[#9BA5B0] m-auto" />}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePersonalDelete(url); }}
                          className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#F8FAFC] border border-dashed rounded-2xl p-12 text-center flex flex-col items-center" style={{ borderColor: brand?.color_primario ? `${brand.color_primario}40` : '#CBD5E1' }}>
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4" style={{ color: brand?.color_primario || '#9BA5B0' }}>
                    <Camera size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-[#0B1929] mb-1">Galería vacía</h4>
                  <p className="text-xs text-[#6B7A8D] max-w-[200px] mb-4">Sube fotos para registrar tu progreso. Solo tú podrás verlas.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 shadow-sm"
                    style={{ backgroundColor: brand?.color_primario || '#0B1929', color: '#fff' }}
                  >
                    Subir mi primera foto
                  </button>
                </div>
              )}
            </div>
            
          </div>
        )}
      </div>

      {/* Full Image Modal */}
      {fullImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setFullImage(null)}>
          <button 
            onClick={() => setFullImage(null)}
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X size={24} />
          </button>
          <CachedImage src={fullImage} className="max-w-full max-h-[90vh] object-contain rounded-lg" alt="Vista ampliada" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
