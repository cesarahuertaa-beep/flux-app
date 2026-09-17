import { useState, useEffect, useCallback } from "react";
import Model from "@phelian/react-body-highlighter";
import { dbGet } from "../../lib/supabase";
import { Activity, Scale, Ruler, BicepsFlexed, TrendingUp, TrendingDown, Minus, Lock } from "lucide-react";
import { useBrand } from "../BrandContext";

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
  const str = g.toLowerCase();
  if (str.includes("pecho") || str.includes("pectoral")) return "pecho";
  if (str.includes("espalda") || str.includes("dorsal")) return "espalda";
  if (str.includes("pierna") || str.includes("glúteo") || str.includes("cuádriceps") || str.includes("isquio") || str.includes("pantorrilla")) return "pierna";
  if (str.includes("brazo") || str.includes("bíceps") || str.includes("tríceps") || str.includes("antebrazo")) return "brazo";
  if (str.includes("hombro") || str.includes("deltoide")) return "hombro";
  if (str.includes("abdomen") || str.includes("core")) return "abdomen";
  return "otro";
};

const RANKS = [
  { name: "Clase G", min: 0, color: "#64748B", level: 1 }, 
  { name: "Clase F", min: 100, color: "#9BA5B0", level: 1 }, 
  { name: "Clase E", min: 300, color: "#10B981", level: 2 }, 
  { name: "Clase D", min: 600, color: "#10B981", level: 2 }, 
  { name: "Clase C", min: 1000, color: "#3B82F6", level: 3 }, 
  { name: "Clase B", min: 1500, color: "#3B82F6", level: 3 }, 
  { name: "Clase A", min: 2100, color: "#8B5CF6", level: 4 }, 
  { name: "Clase S", min: 2800, color: "#F59E0B", level: 5 }, 
  { name: "Clase SS", min: 3600, color: "#F59E0B", level: 5 },
  { name: "Clase SSS", min: 4500, color: "#EF4444", level: 6 }
];

const getRank = (xp) => {
  return [...RANKS].reverse().find(r => xp >= r.min) || RANKS[0];
};


// ── SVGs de Figuras ──
const SilhouetteSVG = () => (
  <svg viewBox="0 0 100 220" className="w-full h-full drop-shadow-md">
    <circle cx="50" cy="25" r="14" fill="#E2E8F0" />
    <path d="M30,45 Q50,40 70,45 L75,80 Q50,85 25,80 Z" fill="#F1F5F9" />
    <path d="M35,80 Q50,83 65,80 L60,115 Q50,120 40,115 Z" fill="#E2E8F0" />
    <path d="M25,45 Q15,60 20,100 L28,95 Q25,60 30,45 Z" fill="#CBD5E1" />
    <path d="M75,45 Q85,60 80,100 L72,95 Q75,60 70,45 Z" fill="#CBD5E1" />
    <path d="M40,115 L40,200 L48,200 L48,130 L52,130 L52,200 L60,200 L60,115 Z" fill="#CBD5E1" />
    {/* Glowing Dots */}
    <circle cx="50" cy="25" r="3" fill="#3B82F6" />
    <circle cx="50" cy="60" r="3" fill="#3B82F6" />
    <circle cx="50" cy="100" r="3" fill="#10B981" />
    <circle cx="44" cy="160" r="3" fill="#8B5CF6" />
    <circle cx="56" cy="160" r="3" fill="#8B5CF6" />
  </svg>
);

const MuscularSVG = ({ groups }) => {
  const getColor = (g) => getRank(groups[g]).color;
  return (
    <svg viewBox="0 0 100 160" className="w-full h-full drop-shadow-xl">
      <circle cx="50" cy="15" r="9" fill="#1E293B" />
      <path d="M46,23 L54,23 L55,30 L45,30 Z" fill="#1E293B" />
      {/* Hombros */}
      <path d="M30,30 Q45,25 50,30 Q55,25 70,30 L74,42 Q50,35 26,42 Z" fill={getColor('hombro')} stroke="#0F172A" strokeWidth="0.5"/>
      {/* Pecho */}
      <path d="M34,42 Q50,47 66,42 L64,56 Q50,60 36,56 Z" fill={getColor('pecho')} stroke="#0F172A" strokeWidth="0.5"/>
      {/* Abdomen */}
      <path d="M36,56 Q50,52 64,56 L60,83 Q50,86 40,83 Z" fill={getColor('abdomen')} stroke="#0F172A" strokeWidth="0.5"/>
      {/* Espalda (Dorsales laterales) */}
      <path d="M28,44 L34,42 L36,56 L31,68 Z" fill={getColor('espalda')} stroke="#0F172A" strokeWidth="0.5"/>
      <path d="M72,44 L66,42 L64,56 L69,68 Z" fill={getColor('espalda')} stroke="#0F172A" strokeWidth="0.5"/>
      {/* Brazos */}
      <path d="M25,43 Q18,58 22,73 L29,70 Q32,58 30,43 Z" fill={getColor('brazo')} stroke="#0F172A" strokeWidth="0.5"/>
      <path d="M75,43 Q82,58 78,73 L71,70 Q68,58 70,43 Z" fill={getColor('brazo')} stroke="#0F172A" strokeWidth="0.5"/>
      {/* Antebrazos */}
      <path d="M21,75 Q16,88 18,100 L24,98 Q27,88 27,73 Z" fill={getColor('brazo')} stroke="#0F172A" strokeWidth="0.5"/>
      <path d="M79,75 Q84,88 82,100 L76,98 Q73,88 73,73 Z" fill={getColor('brazo')} stroke="#0F172A" strokeWidth="0.5"/>
      {/* Piernas */}
      <path d="M39,85 Q32,105 34,120 L45,118 Q48,105 48,85 Z" fill={getColor('pierna')} stroke="#0F172A" strokeWidth="0.5"/>
      <path d="M61,85 Q68,105 66,120 L55,118 Q52,105 52,85 Z" fill={getColor('pierna')} stroke="#0F172A" strokeWidth="0.5"/>
      {/* Pantorrillas */}
      <path d="M34,122 Q30,138 32,150 L41,150 Q44,138 43,120 Z" fill={getColor('pierna')} stroke="#0F172A" strokeWidth="0.5"/>
      <path d="M66,122 Q70,138 68,150 L59,150 Q56,138 57,120 Z" fill={getColor('pierna')} stroke="#0F172A" strokeWidth="0.5"/>
    </svg>
  );
};

export default function Progreso({ cliente, isSelfManaged }) {
  const [metricas, setMetricas] = useState([]);
  const [groupAvg, setGroupAvg] = useState({});
  const [loading, setLoading] = useState(true);
  const brand = useBrand();
  const isEstandar = cliente && !cliente.nutriologo_id && cliente.plan_tipo !== 'premium';
  const currentBodyType = cliente?.genero === 'Femenino' ? 'female' : 'male';

  const loadData = useCallback(async () => {
    if (!cliente?.id) return;
    setLoading(true);
    try {
      // 1. Cargar métricas de composición
      const ms = await dbGet(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`);
      setMetricas(ms);

      // 2. Calcular progreso muscular
      const [rutinas, progs] = await Promise.all([
        dbGet(`rutinas?cliente_id=eq.${cliente.id}&select=id,ejercicios(id,grupo_muscular)`),
        dbGet(`progreso?cliente_id=eq.${cliente.id}&limit=3000`)
      ]);

      const ejMap = {};
      rutinas.forEach(r => {
        r.ejercicios?.forEach(e => { ejMap[e.id] = e.grupo_muscular; });
      });

      const byEj = {};
      progs.forEach(p => {
        if (!byEj[p.ejercicio_id]) byEj[p.ejercicio_id] = {};
        if (!byEj[p.ejercicio_id][p.semana]) byEj[p.ejercicio_id][p.semana] = {};
        if (!byEj[p.ejercicio_id][p.semana][p.serie]) byEj[p.ejercicio_id][p.semana][p.serie] = {};
        byEj[p.ejercicio_id][p.semana][p.serie][p.tipo] = p.valor;
      });

            const muscleXP = {}; EXACT_GROUPS.forEach(g => muscleXP[g] = 0);

      const allWeeks = new Set();
      for (const ejId in byEj) {
         Object.keys(byEj[ejId]).forEach(w => allWeeks.add(Number(w)));
      }
      const sortedWeeks = Array.from(allWeeks).sort((a,b)=>a-b);
      const minWeek = sortedWeeks[0] || 1;
      const maxWeek = sortedWeeks[sortedWeeks.length - 1] || 1;

      const muscleStarted = {}; EXACT_GROUPS.forEach(g => muscleStarted[g] = false);
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

      setGroupAvg(muscleXP);

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [cliente]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#6B7A8D]">
        <div className="w-10 h-10 border-4 border-[#F0F4FA] border-t-[var(--brand-primary)] rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Cargando progreso...</p>
      </div>
    );
  }

  const current = metricas[0] || {};
  const prev = metricas[1] || {};

  const COMP_KEYS = [
    { key: "peso", label: "PESO", unit: "kg" },
    { key: "grasa_pct", label: "GRASA CORPORAL", unit: "%" },
    { key: "musculo_pct", label: "MASA MUSCULAR", unit: "%" },
    { key: "imc", label: "IMC", unit: "" },
    { key: "agua_pct", label: "AGUA CORPORAL", unit: "%" },
    { key: "masa_osea", label: "MASA ÓSEA", unit: "kg" },
    { key: "cintura", label: "CINTURA", unit: "cm" },
  ].filter(k => current[k.key] != null && current[k.key] !== ""); // Solo mostrar los que tienen datos

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

    const hasMax = data.some(d => d.frequency === 6);
    if (!hasMax && data.length > 0) {
      data.push({ name: 'Anchor', muscles: ['head'], frequency: 6 }); 
    }
    
    return data;
  };


  return (
    <div className="flex-1 overflow-y-auto bg-[#F7F9FC]">
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-12 max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>Mis Resultados</h1>
          <p className="text-sm text-[#6B7A8D] mt-1">
            {current.fecha ? `Última evaluación: ${fmtDate(current.fecha)}` : "Aún no hay evaluaciones registradas"}
          </p>
        </div>

        {COMP_KEYS.length > 0 ? (
          <>
            {/* KPI GRID */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {COMP_KEYS.map(k => {
                const val = current[k.key];
                const d = delta(current, prev, k.key);
                let colorClass = "text-[#6B7A8D]";
                let Icon = Minus;
                let sign = "";
                
                if (d !== null) {
                  const isImprovement = k.key.includes("grasa") || k.key.includes("cintura") ? d < 0 : d > 0;
                  colorClass = isImprovement ? "text-green-500" : "text-red-500";
                  Icon = d > 0 ? TrendingUp : TrendingDown;
                  sign = d > 0 ? "+" : "";
                }

                return (
                  <div key={k.key} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E2E8F0] flex flex-col items-center text-center">
                    <p className="text-[10px] md:text-xs font-bold text-[#6B7A8D] tracking-widest">{k.label}</p>
                    <div className="text-2xl md:text-3xl font-bold text-[#1A6FD4] mt-2 mb-1">
                      {val} <span className="text-sm font-semibold text-[#9BA5B0]">{k.unit}</span>
                    </div>
                    {d !== null && (
                      <div className={`flex items-center gap-1 text-xs font-bold ${colorClass}`}>
                        <Icon size={14} />
                        {sign}{d.toFixed(1)} {k.unit}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* COMPOSICIÓN CORPORAL VISUAL */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#E2E8F0]">
              <h2 className="text-lg font-bold text-[#0B1929] mb-6 md:text-center">Composición corporal</h2>
              <div className="flex flex-row items-center justify-center gap-4 md:gap-16">
                
                <div className="flex flex-col gap-6 text-right flex-1">
                  {current.peso != null && current.peso !== "" && (
                    <div>
                      <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest">PESO</p>
                      <p className="text-xl md:text-2xl font-bold text-[#1A6FD4]">{current.peso} <span className="text-[10px] md:text-xs text-[#9BA5B0]">kg</span></p>
                    </div>
                  )}
                </div>

                <div className="w-24 h-48 md:w-32 md:h-56 shrink-0 flex items-center justify-center">
                  <Model 
                    bodyType={currentBodyType}
                    data={[]} 
                    style={{ width: '100%', height: '100%' }}
                    bodyColor="#CBD5E1"
                  />
                </div>

                <div className="flex flex-col gap-6 text-left flex-1">
                  {current.grasa_pct != null && current.grasa_pct !== "" && (
                    <div>
                      <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest">GRASA</p>
                      <p className="text-xl md:text-2xl font-bold text-[#1A6FD4]">{current.grasa_pct} <span className="text-[10px] md:text-xs text-[#9BA5B0]">%</span></p>
                    </div>
                  )}
                  {current.musculo_pct != null && current.musculo_pct !== "" && (
                    <div>
                      <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest">MÚSCULO</p>
                      <p className="text-xl md:text-2xl font-bold text-[#1A6FD4]">{current.musculo_pct} <span className="text-[10px] md:text-xs text-[#9BA5B0]">%</span></p>
                    </div>
                  )}
                </div>

              </div>
            </div>
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
            <div className="absolute inset-0 z-50 backdrop-blur-md bg-[#0B1929]/70 rounded-3xl flex flex-col items-center justify-center p-6 text-center border border-[#1E2D3D]">
              <Lock size={48} className="text-amber-400 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Desarrollo Muscular Premium</h3>
              <p className="text-[#9BA5B0] text-sm max-w-sm mb-6">Descubre qué músculos han crecido más, obtén tu rango de atleta y visualiza tu mapa de calor según tu entrenamiento real.</p>
              <div className="text-[11px] uppercase tracking-widest font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-lg">Adquiere Premium en Mi Membresía</div>
            </div>
          )}
          <div className={`bg-[#0B1929] rounded-3xl p-6 md:p-8 shadow-lg overflow-hidden relative ${isEstandar ? 'pointer-events-none select-none opacity-40 blur-sm' : ''}`}>
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent pointer-events-none" />
          
          <h2 className="text-lg font-bold text-white mb-2 relative z-10">Desarrollo Muscular</h2>
          <p className="text-sm text-[#9BA5B0] mb-8 relative z-10">Progreso de fuerza estimado según tu historial de entrenamiento.</p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 relative z-10">
            <div className="flex flex-row justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)] w-full">
              <div className="flex justify-center gap-2 md:gap-4 w-full max-w-[400px] mx-auto">
                  <div className="w-1/2 flex justify-center">
                    <Model 
                      bodyType={currentBodyType}
                      data={getBodyData(groupAvg)} 
                      style={{ width: '100%', maxWidth: '12rem', padding: '0.5rem' }} 
                      highlightedColors={["#9BA5B0", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"]}
                      type="anterior"
                    />
                  </div>
                  <div className="w-1/2 flex justify-center">
                    <Model 
                      bodyType={currentBodyType}
                      data={getBodyData(groupAvg)} 
                      style={{ width: '100%', maxWidth: '12rem', padding: '0.5rem' }} 
                      highlightedColors={["#9BA5B0", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"]}
                      type="posterior"
                    />
                  </div>
                </div>
            </div>

            <div className="bg-[#152336] border border-[#1E2D3D] rounded-2xl p-5 w-full md:w-64">
              <p className="text-xs font-bold text-[#6B7A8D] tracking-widest mb-4">RANGOS ALCANZADOS</p>
              <div className="space-y-3">
                {Object.entries(groupAvg).sort((a,b)=>b[1]-a[1]).map(([g, pct]) => {
                  const rank = getRank(pct);
                  return (
                    <div key={g} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]" style={{ background: rank.color }} />
                        <span className="text-sm font-semibold text-white capitalize">{g.replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold" style={{ color: rank.color }}>{rank.name}</p>
                        <p className="text-[10px] text-[#6B7A8D]">{pct} XP</p>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(groupAvg).length === 0 && (
                  <p className="text-sm text-[#6B7A8D] text-center py-4">Aún no hay suficiente historial para calcular avances.</p>
                )}
              </div>
            </div>
          </div>

          {/* Leyenda de rangos */}
          <div className="mt-8 pt-6 border-t border-[#1E2D3D]">
            <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest text-center mb-4">ESCALA DE EVOLUCIÓN</p>
            <div className="flex flex-wrap justify-center gap-3">
              {RANKS.slice(1).map(r => (
                <div key={r.name} className="flex items-center gap-1.5 bg-[#152336] px-3 py-1.5 rounded-full border border-[#1E2D3D]">
                  <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  <span className="text-[10px] font-bold text-white uppercase">{r.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>

      </div>
    </div>
  );
}
