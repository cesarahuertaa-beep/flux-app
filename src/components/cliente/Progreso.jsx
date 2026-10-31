import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Model from "@phelian/react-body-highlighter";
import { dbPeek, dbGet, storageUpload, storageListFolder, storageDelete } from "../../lib/supabase";
import {
  Activity, Scale, Ruler, BicepsFlexed, TrendingUp, TrendingDown,
  Minus, Lock, Camera, Image as ImageIcon, UploadCloud, Trash2, X,
  ChevronDown, ChevronLeft, ChevronRight, Layers, Sparkles, Filter,
  Stethoscope, Download, ArrowLeftRight, Check, Eye, Calendar,
  FileText, ArrowUp, ArrowDown, Flame, Target, Zap, CheckCircle2
} from "lucide-react";
import { parseFotos, compressImageIfNeeded } from "../../utils/helpers";
import { useBrand } from "../BrandContext";
import { EvolutionCharts } from "../ui/EvolutionCharts";
import { BeforeAfterComparator } from "../ui/BeforeAfterComparator";
import { MetricsSkeleton } from "../ui/Skeleton";
import { useBackButton } from "../../lib/backButtonHandler";
import { CachedImage, precacheMediaList } from "../../lib/mediaCache";
import { ConfirmModal, showFluxAlert } from "../ui/ConfirmModal";
import {
  enrichMetrica,
  linkMetricasToCiclos,
  getMetodoLabel,
  getGoalPresetInfo,
  getActivityFactorInfo
} from "../../lib/bodyComposition";
import { generateProgresoPDF } from "../../utils/pdf";

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
  const _peekMetricas = cliente?.id ? dbPeek(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`) : null;
  const [metricas, setMetricas] = useState(() => Array.isArray(_peekMetricas) ? _peekMetricas.map(enrichMetrica) : []);
  const _peekCiclos = cliente?.id ? dbPeek(`ciclos?cliente_id=eq.${cliente.id}&order=created_at.desc`) : null;
  const [ciclos, setCiclos] = useState(() => Array.isArray(_peekCiclos) ? _peekCiclos : []);
  const [groupAvg, setGroupAvg] = useState({});
  const [loading, setLoading] = useState(() => _peekMetricas === null);
  const brand = useBrand();
  const isEstandar = cliente && !cliente.nutriologo_id && cliente.plan_tipo !== 'premium' && cliente.objetivo !== 'Mi entrenamiento personal';
  const currentBodyType = cliente?.genero === 'Femenino' ? 'female' : 'male';
  
  const [view, setView] = useState('metricas');
  const [personalPhotos, setPersonalPhotos] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploadingPersonal, setUploadingPersonal] = useState(false);
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState('todas'); // 'todas' | 'evaluaciones' | 'personales'
  const [showComparator, setShowComparator] = useState(false);
  const [comparatorBeforeIdx, setComparatorBeforeIdx] = useState(null);
  const [comparatorAfterIdx, setComparatorAfterIdx] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileInputRef = useRef(null);
  const comparatorRef = useRef(null);
  const touchStartXRef = useRef(null);

  useBackButton(lightboxIndex !== null, () => setLightboxIndex(null), 100);

  const loadData = useCallback(async () => {
    if (!cliente?.id) return;
    if (metricas.length === 0 && dbPeek(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`) === null) {
      setLoading(true);
    }
    try {
      // 1. Cargar métricas de composición
      const ms = await dbGet(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`);
      setMetricas(Array.isArray(ms) ? ms.map(enrichMetrica) : []);

      // 2. Calcular progreso muscular
      const [allCiclos, rutinas, progs] = await Promise.all([
        dbGet(`ciclos?cliente_id=eq.${cliente.id}&order=created_at.desc`),
        dbGet(`rutinas?cliente_id=eq.${cliente.id}&select=id,ciclo_id,ejercicios(id,grupo_muscular)`),
        dbGet(`progreso?cliente_id=eq.${cliente.id}&limit=3000`)
      ]);

      const validCiclos = Array.isArray(allCiclos) ? allCiclos : [];
      setCiclos(validCiclos);
      const ciclosActivos = validCiclos.filter(c => c.activo);

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
      const primaryIndexUrl = `${SUPA_URL}/storage/v1/object/public/logos/personal_photos_${cliente.id}.json?t=${Date.now()}`;
      let r = await fetch(primaryIndexUrl);
      if (!r.ok) {
        const legacyIndexUrl = `${SUPA_URL}/storage/v1/object/public/progress-photos/${cliente.id}/personal/index.json?t=${Date.now()}`;
        r = await fetch(legacyIndexUrl);
      }
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

  useEffect(() => {
    loadData();
    let timer = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["metricas_progreso", "progreso", "rutinas", "ciclos", "*"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadData(), 250);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, [loadData]);
  useEffect(() => { if (view === 'galeria') loadPersonalPhotos(); }, [view, loadPersonalPhotos]);

  const saveIndex = async (urls) => {
    try {
      const cleanUrls = (urls || []).filter(u => typeof u === "string" && !u.startsWith("blob:"));
      const cacheKey = `flux_personal_photos_${cliente.id}`;
      try { localStorage.setItem(cacheKey, JSON.stringify(cleanUrls)); } catch (e) {}
      precacheMediaList(cleanUrls).catch(() => {});

      const blob = new Blob([JSON.stringify(cleanUrls)], { type: "application/json" });
      await storageUpload("logos", `personal_photos_${cliente.id}.json`, blob, { upsert: true });
    } catch (e) {
      console.error("Error saving index", e);
    }
  };

  const handlePersonalUpload = async (e) => {
    const fileList = e.target.files ? Array.from(e.target.files) : [];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (fileList.length === 0) return;

    // 1. Mostrar vista previa en 0ms de forma optimista
    const tempEntries = fileList.map((file) => ({
      file,
      tempUrl: URL.createObjectURL(file),
    }));
    const tempUrls = tempEntries.map((x) => x.tempUrl);
    const basePhotos = personalPhotos.filter((u) => !u.startsWith("blob:"));
    setPersonalPhotos([...basePhotos, ...tempUrls]);
    setUploadingPersonal(true);

    try {
      const uploadedUrls = await Promise.all(
        tempEntries.map(async ({ file }, idx) => {
          const cleanName = (file.name || "foto.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${cliente.id}/personal/${Date.now()}_${idx}_${cleanName}`;
          const compressedFile = await compressImageIfNeeded(file);
          return await storageUpload("progress-photos", path, compressedFile);
        })
      );

      const finalUrls = [...basePhotos, ...uploadedUrls];
      setPersonalPhotos(finalUrls);
      await saveIndex(finalUrls);
    } catch (error) {
      console.error(error);
      setPersonalPhotos(basePhotos);
      const msg = error?.message || "No se pudieron subir las fotos personales. Intenta de nuevo.";
      showFluxAlert("Error subiendo fotos", msg);
    } finally {
      tempUrls.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      setUploadingPersonal(false);
    }
  };

  const handlePersonalDelete = (url) => {
    setConfirmDelete({
      title: "¿Eliminar foto personal?",
      description: "Esta foto se eliminará permanentemente de tu galería privada.",
      confirmText: "Eliminar foto",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        // Eliminación instantánea en 0ms en la interfaz
        setConfirmDelete(null);
        const updatedUrls = personalPhotos.filter((u) => u !== url);
        setPersonalPhotos(updatedUrls);
        try {
          await saveIndex(updatedUrls);
          if (url.includes("progress-photos/")) {
            const pathPart = url.split("progress-photos/")[1];
            if (pathPart) await storageDelete("progress-photos", pathPart).catch(() => {});
          } else if (url.includes("logos/")) {
            const pathPart = url.split("logos/")[1];
            if (pathPart) await storageDelete("logos", pathPart).catch(() => {});
          }
        } catch (e) {
          console.error("Error deleting", e);
        }
      }
    });
  };

  const extractDateFromUrl = (url) => {
    if (!url || typeof url !== "string") return { fecha: null, timestamp: 0 };
    try {
      const match = url.match(/personal\/(\d{10,13})/);
      if (match && match[1]) {
        const ts = parseInt(match[1]);
        if (!isNaN(ts) && ts > 1500000000000 && ts < 2500000000000) {
          return {
            fecha: new Date(ts).toISOString().split("T")[0],
            timestamp: ts,
          };
        }
      }
    } catch {}
    return { fecha: null, timestamp: 0 };
  };

  const unifiedPhotos = useMemo(() => {
    const list = [];
    // 1. Fotos registradas por el nutriólogo / evaluaciones
    metricas.forEach((m) => {
      const urls = parseFotos(m.fotos).filter(Boolean);
      urls.forEach((url, fIdx) => {
        list.push({
          id: `eval-${m.id || m.fecha}-${fIdx}`,
          url,
          type: "evaluacion",
          sourceLabel: isSelfManaged ? "Evaluación Física" : "Nutriólogo",
          fecha: m.fecha,
          label: m.fecha ? fmtDate(m.fecha) : "Evaluación",
          peso: m.peso,
          grasa_pct: m.grasa_pct,
          musculo_pct: m.inbody_smm || m.calc_masa_muscular || m.musculo_pct || null,
          imc: m.imc || null,
          notas: m.notas || null,
          timestamp: m.fecha ? new Date(m.fecha + "T12:00:00").getTime() : 0,
        });
      });
    });

    // 2. Fotos personales subidas por el usuario
    personalPhotos.forEach((url, pIdx) => {
      if (!url) return;
      const { fecha, timestamp } = extractDateFromUrl(url);
      list.push({
        id: `pers-${pIdx}-${url.slice(-20)}`,
        url,
        type: "personal",
        sourceLabel: "Foto Personal Privada",
        fecha,
        label: fecha ? fmtDate(fecha) : `Foto #${personalPhotos.length - pIdx}`,
        peso: null,
        grasa_pct: null,
        musculo_pct: null,
        imc: null,
        notas: null,
        timestamp: timestamp || (Date.now() - pIdx * 1000),
      });
    });

    // Ordenar de más reciente a más antigua (Instagram style)
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [metricas, personalPhotos, isSelfManaged]);

  const evalCount = useMemo(() => unifiedPhotos.filter((p) => p.type === "evaluacion").length, [unifiedPhotos]);
  const personalCount = useMemo(() => unifiedPhotos.filter((p) => p.type === "personal").length, [unifiedPhotos]);

  const filteredPhotos = useMemo(() => {
    if (galleryFilter === "evaluaciones") return unifiedPhotos.filter((p) => p.type === "evaluacion");
    if (galleryFilter === "personales") return unifiedPhotos.filter((p) => p.type === "personal");
    return unifiedPhotos;
  }, [unifiedPhotos, galleryFilter]);

  const handleStartComparisonWithPhoto = (photoItem) => {
    const idx = unifiedPhotos.findIndex((p) => p.url === photoItem.url);
    if (idx !== -1) {
      if (idx === 0 && unifiedPhotos.length > 1) {
        setComparatorAfterIdx(0);
        setComparatorBeforeIdx(unifiedPhotos.length - 1);
      } else {
        setComparatorBeforeIdx(idx);
        setComparatorAfterIdx(0);
      }
    }
    setShowComparator(true);
    setLightboxIndex(null);
    setTimeout(() => {
      comparatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const handlePrevLightbox = useCallback(() => {
    setLightboxIndex((prev) => {
      if (prev === null) return null;
      return prev > 0 ? prev - 1 : filteredPhotos.length - 1;
    });
  }, [filteredPhotos.length]);

  const handleNextLightbox = useCallback(() => {
    setLightboxIndex((prev) => {
      if (prev === null) return null;
      return prev < filteredPhotos.length - 1 ? prev + 1 : 0;
    });
  }, [filteredPhotos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") handlePrevLightbox();
      if (e.key === "ArrowRight") handleNextLightbox();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, handlePrevLightbox, handleNextLightbox]);

  // Vincular cada métrica con su plan correspondiente
  const allLinkedMetricas = useMemo(() => {
    return linkMetricasToCiclos(metricas, ciclos);
  }, [metricas, ciclos]);

  // Orden cronológico para calcular deltas acumulados
  const chronologicalEvals = useMemo(() => {
    return [...allLinkedMetricas]
      .filter((m) => m && m.fecha)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [allLinkedMetricas]);

  // KPIs de cambio total acumulado
  const kpiStats = useMemo(() => {
    if (chronologicalEvals.length === 0) return null;
    const initial = chronologicalEvals[0];
    const currentEval = chronologicalEvals[chronologicalEvals.length - 1];

    const weightDelta =
      initial.peso && currentEval.peso && initial.id !== currentEval.id
        ? Number((Number(currentEval.peso) - Number(initial.peso)).toFixed(1))
        : null;

    const fatDelta =
      initial.grasa_pct && currentEval.grasa_pct && initial.id !== currentEval.id
        ? Number((Number(currentEval.grasa_pct) - Number(initial.grasa_pct)).toFixed(1))
        : null;

    const lbmDelta =
      initial.masa_libre_grasa && currentEval.masa_libre_grasa && initial.id !== currentEval.id
        ? Number((Number(currentEval.masa_libre_grasa) - Number(initial.masa_libre_grasa)).toFixed(1))
        : null;

    return {
      initial,
      current: currentEval,
      weightDelta,
      fatDelta,
      lbmDelta,
      totalEvals: allLinkedMetricas.length,
      totalPlanes: ciclos.length,
    };
  }, [chronologicalEvals, allLinkedMetricas, ciclos]);

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
    { key:"masa_libre_grasa", label:"MASA MAGRA (MLG)", unit:"kg" },
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
    { key:"ice", label:"ICE", unit:"" },
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

  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] min-h-full">
      {/* HEADER ESTÁNDAR */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 bg-white border-b border-[#F0F4FA] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
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

        <div className="flex items-center gap-2 flex-wrap">
          {metricas.length > 0 && (
            <button
              type="button"
              onClick={() => generateProgresoPDF(cliente, metricas, brand)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border border-[#E2E8F0] bg-white hover:bg-gray-50 text-[#0B1929] transition-all shadow-2xs cursor-pointer"
              title="Descargar reporte PDF completo de evaluaciones"
            >
              <FileText className="w-4 h-4 text-[var(--brand-primary)]" />
              <span className="hidden sm:inline">Descargar PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
          )}

          <div className="flex bg-[#F0F4FA] p-1 rounded-xl w-max">
            <button
              onClick={() => setView('metricas')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${view === 'metricas' ? 'bg-white text-[var(--brand-primary)] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
            >
              Métricas
            </button>
            <button
              onClick={() => setView('galeria')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${view === 'galeria' ? 'bg-white text-[var(--brand-primary)] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}
            >
              Galería
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-8 py-6 md:py-8 pb-6 md:pb-8 max-w-5xl w-full mx-auto space-y-8">
        {view === 'metricas' && (
          <>
          {/* ── RESUMEN DE TRANSFORMACIÓN TOTAL ACUMULADA ── */}
          {kpiStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Peso Total */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> Peso Corporal
                  </span>
                  {kpiStats.weightDelta !== null && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        kpiStats.weightDelta < 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-[var(--brand-primary)]"
                      }`}
                    >
                      {kpiStats.weightDelta > 0 ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )}
                      {Math.abs(kpiStats.weightDelta)} kg
                    </span>
                  )}
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#0B1929] font-['Rajdhani']">
                  {kpiStats.current.peso || "—"}{" "}
                  <span className="text-xs text-[#6B7A8D] font-normal">kg actual</span>
                </div>
                <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                  Inicial: {kpiStats.initial.peso || "—"} kg ({fmtDate(kpiStats.initial.fecha)})
                </div>
              </div>

              {/* % Grasa Total */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-500" /> % Grasa
                  </span>
                  {kpiStats.fatDelta !== null && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        kpiStats.fatDelta < 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {kpiStats.fatDelta > 0 ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )}
                      {Math.abs(kpiStats.fatDelta)}%
                    </span>
                  )}
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#0B1929] font-['Rajdhani']">
                  {kpiStats.current.grasa_pct ? `${kpiStats.current.grasa_pct}%` : "—"}{" "}
                  <span className="text-xs text-[#6B7A8D] font-normal">actual</span>
                </div>
                <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                  Inicial: {kpiStats.initial.grasa_pct ? `${kpiStats.initial.grasa_pct}%` : "—"}
                </div>
              </div>

              {/* Masa Magra Total */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider flex items-center gap-1.5">
                    <BicepsFlexed className="w-3.5 h-3.5 text-emerald-600" /> Masa Magra
                  </span>
                  {kpiStats.lbmDelta !== null && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        kpiStats.lbmDelta > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-[#6B7A8D]"
                      }`}
                    >
                      {kpiStats.lbmDelta > 0 ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )}
                      {Math.abs(kpiStats.lbmDelta)} kg
                    </span>
                  )}
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#0B1929] font-['Rajdhani']">
                  {kpiStats.current.masa_libre_grasa || "—"}{" "}
                  <span className="text-xs text-[#6B7A8D] font-normal">kg actual</span>
                </div>
                <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                  Inicial: {kpiStats.initial.masa_libre_grasa || "—"} kg
                </div>
              </div>

              {/* Planes y Evaluaciones */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600" /> Etapas del Proceso
                </span>
                <div className="text-xl sm:text-2xl font-black text-[#0B1929] font-['Rajdhani']">
                  {kpiStats.totalPlanes}{" "}
                  <span className="text-xs text-[#6B7A8D] font-normal">
                    {kpiStats.totalPlanes === 1 ? "plan" : "planes"}
                  </span>
                </div>
                <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                  {kpiStats.totalEvals} evaluación{kpiStats.totalEvals !== 1 ? "es" : ""} completada{kpiStats.totalEvals !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          )}

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
              metricas={allLinkedMetricas}
              isLocked={isEstandar}
              brandColor={brand?.color_primario}
            />

            {/* ── DESGLOSE HISTÓRICO PLAN A PLAN ── */}
            {ciclos.length > 0 && (
              <div className="bg-white rounded-3xl p-5 md:p-7 border border-[#E2E8F0] shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-3 border-b border-[#F0F4FA] pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                        Evolución Histórica Plan a Plan
                      </h3>
                      <p className="text-xs text-[#6B7A8D]">
                        Detalle de las evaluaciones registradas en cada plan de entrenamiento y nutrición
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#6B7A8D] bg-gray-50 border border-[#E2E8F0] px-3 py-1 rounded-xl">
                    {ciclos.length} Planes registrados
                  </span>
                </div>

                <div className="space-y-4">
                  {ciclos.map((c, cIdx) => {
                    const planEvals = allLinkedMetricas.filter(
                      (m) => String(m.ciclo_id) === String(c.id)
                    );
                    const isCurrent = c.activo;
                    const firstEval = planEvals[planEvals.length - 1];
                    const lastEval = planEvals[0];
                    const weightDelta =
                      firstEval?.peso && lastEval?.peso && firstEval.id !== lastEval.id
                        ? (Number(lastEval.peso) - Number(firstEval.peso)).toFixed(1)
                        : null;

                    return (
                      <div
                        key={c.id}
                        className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                          isCurrent
                            ? "border-[var(--brand-primary)]/40 bg-blue-50/20 shadow-xs"
                            : "border-[#E2E8F0] bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span
                              className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                                isCurrent
                                  ? "bg-[var(--brand-primary)] text-white shadow-2xs"
                                  : "bg-gray-100 text-[#6B7A8D]"
                              }`}
                            >
                              {isCurrent ? "Plan Activo" : `Plan #${ciclos.length - cIdx}`}
                            </span>
                            <h4 className="text-sm sm:text-base font-bold text-[#0B1929]">
                              {c.nombre?.split("|")[0]}
                            </h4>
                            {c.created_at && (
                              <span className="text-xs text-[#6B7A8D] flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#94A3B8]" />
                                {fmtDate(c.created_at)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 text-xs">
                            <span className="text-[#6B7A8D] font-medium">
                              {planEvals.length} evaluación{planEvals.length !== 1 ? "es" : ""}
                            </span>
                            {weightDelta !== null && (
                              <span
                                className={`font-bold px-2.5 py-0.5 rounded-md ${
                                  Number(weightDelta) < 0
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 text-[var(--brand-primary)] border border-blue-200"
                                }`}
                              >
                                Δ {Number(weightDelta) > 0 ? `+${weightDelta}` : weightDelta} kg
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Evaluaciones de este plan */}
                        {planEvals.length === 0 ? (
                          <div className="text-xs text-[#94A3B8] italic py-3 bg-white/60 rounded-xl px-4 border border-dashed border-[#E2E8F0]">
                            Sin evaluaciones corporales registradas durante este plan.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-[#F0F4FA]">
                            {planEvals.map((ev) => (
                              <div
                                key={ev.id}
                                className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between gap-2.5 hover:shadow-xs transition-shadow"
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                                    {fmtDate(ev.fecha)}
                                  </span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {ev.eval_objetivo && (() => {
                                      const g = getGoalPresetInfo(ev.eval_objetivo);
                                      return g ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                          <Target className="w-2.5 h-2.5" /> {g.title}
                                        </span>
                                      ) : null;
                                    })()}
                                    {ev.metodo_evaluacion && (
                                      <span className="text-[10px] font-bold text-[#6B7A8D] bg-gray-50 border border-[#E2E8F0] px-2 py-0.5 rounded-md">
                                        {getMetodoLabel(ev.metodo_evaluacion)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]/60">
                                  <div>
                                    <span className="text-[10px] text-[#6B7A8D] block">Peso</span>
                                    <span className="text-xs font-bold text-[#0B1929]">
                                      {ev.peso ? `${ev.peso} kg` : "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-[#6B7A8D] block">Grasa</span>
                                    <span className="text-xs font-bold text-[#0B1929]">
                                      {ev.grasa_pct ? `${ev.grasa_pct}%` : "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-[#6B7A8D] block">M. Magra</span>
                                    <span className="text-xs font-bold text-emerald-700">
                                      {ev.masa_libre_grasa ? `${ev.masa_libre_grasa} kg` : "—"}
                                    </span>
                                  </div>
                                </div>

                                {/* Check-in de Sensaciones */}
                                {Boolean(
                                  ev.checkin_energia ||
                                    ev.checkin_saciedad ||
                                    ev.checkin_observaciones
                                ) && (
                                  <div className="text-[11px] text-[#6B7A8D] bg-blue-50/50 rounded-lg p-2 border border-blue-100/60 space-y-1">
                                    <div className="flex items-center justify-between font-bold text-[#0B1929]">
                                      <span>Check-in consulta</span>
                                      <span className="flex items-center gap-2">
                                        {ev.checkin_energia && (
                                          <span className="inline-flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                            <span>{ev.checkin_energia}/5</span>
                                          </span>
                                        )}
                                        {ev.checkin_saciedad && (
                                          <span className="inline-flex items-center gap-1">
                                            <Flame className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                                            <span>{ev.checkin_saciedad}/5</span>
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    {ev.checkin_observaciones && (
                                      <p className="line-clamp-2 italic text-[#475569]">
                                        "{ev.checkin_observaciones}"
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
          <div className="space-y-6">
            {/* ── BARRA DE HERRAMIENTAS Y FILTROS ESTILO INSTAGRAM ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E2E8F0] shadow-xs">
              {/* Filtros por pestaña/píldora */}
              <div className="flex items-center gap-1.5 overflow-x-auto scroll-hide">
                <button
                  onClick={() => setGalleryFilter('todas')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    galleryFilter === 'todas'
                      ? 'bg-[#0B1929] text-white shadow-xs'
                      : 'bg-[#F0F4FA] text-[#6B7A8D] hover:text-[#0B1929]'
                  }`}
                >
                  Todas ({unifiedPhotos.length})
                </button>

                {evalCount > 0 && (
                  <button
                    onClick={() => setGalleryFilter('evaluaciones')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      galleryFilter === 'evaluaciones'
                        ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                        : 'bg-[#F0F4FA] text-[#6B7A8D] hover:text-[#0B1929]'
                    }`}
                  >
                    <Stethoscope size={13} />
                    <span>{isSelfManaged ? 'Evaluaciones' : 'Nutriólogo'} ({evalCount})</span>
                  </button>
                )}

                <button
                  onClick={() => setGalleryFilter('personales')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    galleryFilter === 'personales'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[#F0F4FA] text-[#6B7A8D] hover:text-[#0B1929]'
                  }`}
                >
                  <Lock size={13} />
                  <span>Mis Fotos ({personalCount})</span>
                </button>
              </div>

              {/* Botones de acción principales */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {unifiedPhotos.length >= 2 && (
                  <button
                    onClick={() => setShowComparator(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      showComparator
                        ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                        : 'bg-white border border-[#E2E8F0] text-[#0B1929] hover:bg-gray-50'
                    }`}
                  >
                    <Sparkles size={14} className={showComparator ? 'text-white' : 'text-[var(--brand-primary)]'} />
                    <span>{showComparator ? 'Ocultar Comparador' : 'Comparar'}</span>
                  </button>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPersonal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0B1929] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <Camera size={14} />
                  <span>{uploadingPersonal ? 'Subiendo...' : 'Subir Foto'}</span>
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
            </div>

            {/* ── BANNER DE SUBIDA OPTIMISTA ── */}
            {uploadingPersonal && (
              <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-2xl text-xs font-bold animate-pulse">
                <UploadCloud size={17} className="animate-bounce" />
                <span>Subiendo y comprimiendo tus fotos de forma segura en tu galería privada...</span>
              </div>
            )}

            {/* ── SECCIÓN COMPARADOR ANTES VS DESPUÉS ── */}
            {showComparator && unifiedPhotos.length >= 2 && (
              <div ref={comparatorRef} className="animate-fadeIn">
                <BeforeAfterComparator
                  photos={unifiedPhotos}
                  brand={brand}
                  clienteNombre={cliente?.nombre}
                  initialBeforeIdx={comparatorBeforeIdx}
                  initialAfterIdx={comparatorAfterIdx}
                  onClose={() => setShowComparator(false)}
                />
              </div>
            )}

            {/* ── GRID DE FOTOS ESTILO INSTAGRAM ── */}
            {filteredPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4.5">
                {filteredPhotos.map((p, idx) => (
                  <div
                    key={p.id}
                    onClick={() => setLightboxIndex(idx)}
                    className="relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer border border-[#E2E8F0] shadow-2xs hover:shadow-lg transition-all duration-300 group bg-gray-100"
                  >
                    <CachedImage
                      src={p.url}
                      alt={p.label}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      fallback={
                        p.type === 'evaluacion' ? (
                          <ImageIcon size={32} className="text-[#9BA5B0] m-auto" />
                        ) : (
                          <Camera size={32} className="text-[#9BA5B0] m-auto" />
                        )
                      }
                    />

                    {/* Gradiente oscuro inferior y superior para legibilidad */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-85 group-hover:opacity-95 transition-opacity pointer-events-none" />

                    {/* Insignias superiores */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5 z-10">
                      {/* Tipo de foto */}
                      {p.type === 'evaluacion' ? (
                        <span className="bg-blue-600/90 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                          <Stethoscope size={10} />
                          <span>{isSelfManaged ? 'Evaluación' : 'Nutriólogo'}</span>
                        </span>
                      ) : (
                        <span className="bg-emerald-600/90 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                          <Lock size={10} />
                          <span>Privada</span>
                        </span>
                      )}

                      {/* Acciones flotantes en hover */}
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartComparisonWithPhoto(p);
                          }}
                          title="Comparar esta foto"
                          className="w-7 h-7 rounded-full bg-white/95 hover:bg-white text-[#0B1929] flex items-center justify-center shadow-md transition-all cursor-pointer"
                        >
                          <Sparkles size={12} className="text-[var(--brand-primary)]" />
                        </button>
                        {p.type === 'personal' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePersonalDelete(p.url);
                            }}
                            title="Eliminar foto"
                            className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Información inferior */}
                    <div className="absolute bottom-2.5 inset-x-2.5 z-10 text-white">
                      <p className="text-xs font-bold truncate drop-shadow-xs">
                        {p.fecha ? fmtDate(p.fecha) : p.label}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {p.peso && (
                          <span className="text-[10px] font-bold bg-white/20 backdrop-blur-xs px-1.5 py-0.2 rounded text-slate-100">
                            {p.peso} kg
                          </span>
                        )}
                        {p.grasa_pct && (
                          <span className="text-[10px] font-semibold text-slate-200">
                            {p.grasa_pct}% grasa
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Estado vacío elegante */
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-10 text-center max-w-md mx-auto shadow-sm">
                <div className="w-14 h-14 bg-[#F0F4FA] rounded-2xl flex items-center justify-center mx-auto mb-3.5 text-[#6B7A8D]">
                  {galleryFilter === 'personales' ? <Lock size={26} /> : <Camera size={26} />}
                </div>
                <h4 className="text-sm font-bold text-[#0B1929] mb-1">
                  {galleryFilter === 'personales'
                    ? 'No tienes fotos personales'
                    : galleryFilter === 'evaluaciones'
                    ? 'Sin fotos de evaluaciones'
                    : 'Galería sin fotos registradas'}
                </h4>
                <p className="text-xs text-[#6B7A8D] mb-5">
                  {galleryFilter === 'personales'
                    ? 'Registra fotos privadas para monitorear tu propio cambio físico con total privacidad.'
                    : galleryFilter === 'evaluaciones'
                    ? 'Tu nutriólogo o entrenador agregará fotos en tus consultas físicas.'
                    : 'Comienza subiendo tus fotos para ver tu evolución en el comparador.'}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 shadow-sm cursor-pointer inline-flex items-center gap-2"
                >
                  <Camera size={14} />
                  <span>Subir mi primera foto</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL LIGHTBOX FULLSCREEN ESTILO INSTAGRAM ── */}
      {lightboxIndex !== null && filteredPhotos[lightboxIndex] && (() => {
        const currentPhoto = filteredPhotos[lightboxIndex];
        return (
          <div
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col justify-between animate-fadeIn select-none"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Barra superior del visor */}
            <div
              className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between text-white border-b border-white/10 z-20 bg-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {currentPhoto.type === 'evaluacion' ? (
                  <span className="bg-blue-600 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                    <Stethoscope size={13} />
                    <span>{isSelfManaged ? 'Evaluación Física' : 'Evaluación Nutricional'}</span>
                  </span>
                ) : (
                  <span className="bg-emerald-600 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                    <Lock size={13} />
                    <span>Foto Personal Privada</span>
                  </span>
                )}
                <span className="text-xs text-slate-300 font-semibold hidden sm:inline">
                  {currentPhoto.fecha ? fmtDate(currentPhoto.fecha) : currentPhoto.label}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs text-slate-300 font-bold bg-white/10 px-2 py-0.5 rounded-md">
                  {lightboxIndex + 1} / {filteredPhotos.length}
                </span>
                <button
                  onClick={() => setLightboxIndex(null)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Viewport Central con botones Anterior / Siguiente y Swipe táctil */}
            <div
              className="flex-1 relative flex items-center justify-center p-2 sm:p-6 overflow-hidden"
              onTouchStart={(e) => {
                touchStartXRef.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartXRef.current === null) return;
                const diff = touchStartXRef.current - e.changedTouches[0].clientX;
                if (diff > 50) handleNextLightbox();
                else if (diff < -50) handlePrevLightbox();
                touchStartXRef.current = null;
              }}
            >
              {/* Botón Anterior */}
              {filteredPhotos.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevLightbox();
                  }}
                  className="absolute left-3 sm:left-6 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shadow-lg"
                  title="Foto anterior"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              {/* Botón Siguiente */}
              {filteredPhotos.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextLightbox();
                  }}
                  className="absolute right-3 sm:right-6 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shadow-lg"
                  title="Foto siguiente"
                >
                  <ChevronRight size={24} />
                </button>
              )}

              {/* Imagen activa */}
              <CachedImage
                src={currentPhoto.url}
                alt="Foto ampliada"
                className="max-h-[70vh] sm:max-h-[75vh] w-auto max-w-[95vw] object-contain rounded-2xl shadow-2xl transition-all"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Barra inferior de detalles y acciones rápidas */}
            <div
              className="px-4 py-3 sm:px-8 sm:py-4 bg-[#0B1929]/90 border-t border-white/10 text-white flex flex-col sm:flex-row items-center justify-between gap-3 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white">
                    {currentPhoto.fecha ? fmtDate(currentPhoto.fecha) : currentPhoto.label}
                  </p>
                  {currentPhoto.notas && (
                    <p className="text-[11px] text-slate-300 max-w-md truncate">
                      {currentPhoto.notas}
                    </p>
                  )}
                </div>

                {(currentPhoto.peso || currentPhoto.grasa_pct || currentPhoto.musculo_pct) && (
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 text-xs font-semibold">
                    {currentPhoto.peso && <span>{currentPhoto.peso} kg</span>}
                    {currentPhoto.grasa_pct && <span>• {currentPhoto.grasa_pct}% grasa</span>}
                    {currentPhoto.musculo_pct && <span>• {currentPhoto.musculo_pct} kg músculo</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartComparisonWithPhoto(currentPhoto)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                  <Sparkles size={14} />
                  <span>Comparar esta foto</span>
                </button>

                <a
                  href={currentPhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="p-2 rounded-xl text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
                  title="Abrir imagen completa"
                >
                  <Download size={16} />
                </a>

                {currentPhoto.type === 'personal' && (
                  <button
                    onClick={() => {
                      setLightboxIndex(null);
                      handlePersonalDelete(currentPhoto.url);
                    }}
                    className="p-2 rounded-xl text-rose-300 hover:text-rose-100 bg-rose-500/20 hover:bg-rose-500/30 transition-colors cursor-pointer"
                    title="Eliminar foto personal"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
