import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Save, ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const TRAINING_DAYS = [
  { label: "Lun", full: "Lunes", focus: "Pecho + Tríceps" },
  { label: "Mar", full: "Martes", focus: "Espalda + Bíceps" },
  { label: "Mié", full: "Miércoles", focus: "Piernas" },
  { label: "Jue", full: "Jueves", focus: "Hombros + Core" },
  { label: "Vie", full: "Viernes", focus: "Full Body" },
];

type ExerciseLog = { sets: { reps: string; weight: string }[]; saved: boolean };

const exercisesByDay = [
  [
    { name: "Press de Banca", muscle: "Pectoral Mayor", video: "photo-1534438327276-14e5300c3a48", alts: ["Press con Mancuernas", "Push-ups con peso"] },
    { name: "Aperturas en Polea", muscle: "Pectoral Menor", video: "photo-1517963879433-6ad2b056d712", alts: ["Aperturas con Mancuernas", "Chest Fly Máquina"] },
    { name: "Fondos en Paralelas", muscle: "Tríceps", video: "photo-1583454110551-21f2fa2afe61", alts: ["Press Francés", "Tríceps en Polea"] },
    { name: "Press Inclinado Mancuernas", muscle: "Pectoral Superior", video: "photo-1534438327276-14e5300c3a48", alts: ["Press Inclinado Barra", "Cable Fly Alto"] },
  ],
  [
    { name: "Dominadas", muscle: "Dorsal Ancho", video: "photo-1571019613454-1cb2f99b2d8b", alts: ["Jalón al Pecho", "Remo en Máquina"] },
    { name: "Remo con Barra", muscle: "Romboides", video: "photo-1517963879433-6ad2b056d712", alts: ["Remo con Mancuerna", "Remo en Cable"] },
    { name: "Curl de Bíceps", muscle: "Bíceps Braquial", video: "photo-1583454110551-21f2fa2afe61", alts: ["Curl Martillo", "Curl en Cable"] },
    { name: "Pull-over con Mancuerna", muscle: "Dorsal Ancho", video: "photo-1534438327276-14e5300c3a48", alts: ["Pull-over en Cable", "Pull-down Recto"] },
  ],
  [
    { name: "Sentadilla con Barra", muscle: "Cuádriceps / Glúteo", video: "photo-1571019613454-1cb2f99b2d8b", alts: ["Prensa de Pierna", "Sentadilla Hack"] },
    { name: "Peso Muerto Rumano", muscle: "Isquiotibiales", video: "photo-1534438327276-14e5300c3a48", alts: ["Curl Femoral Tumbado", "Peso Muerto Sumo"] },
    { name: "Extensión de Cuádriceps", muscle: "Cuádriceps", video: "photo-1517963879433-6ad2b056d712", alts: ["Sentadilla Búlgara", "Step-up con Peso"] },
    { name: "Pantorrillas de Pie", muscle: "Gastrocnemio", video: "photo-1583454110551-21f2fa2afe61", alts: ["Pantorrillas Sentado", "Saltos de Caja"] },
  ],
  [
    { name: "Press Militar", muscle: "Deltoides Anterior", video: "photo-1571019613454-1cb2f99b2d8b", alts: ["Press Arnold", "Press con Mancuernas"] },
    { name: "Elevaciones Laterales", muscle: "Deltoides Medio", video: "photo-1534438327276-14e5300c3a48", alts: ["Cable Lateral", "Mancuerna Lateral 1 brazo"] },
    { name: "Plancha con Peso", muscle: "Core / Abdomen", video: "photo-1517963879433-6ad2b056d712", alts: ["Plancha Lateral", "Ab Wheel"] },
    { name: "Crunch en Polea", muscle: "Recto Abdominal", video: "photo-1583454110551-21f2fa2afe61", alts: ["Crunch en Suelo", "Sit-up Inclinado"] },
  ],
  [
    { name: "Burpees", muscle: "Full Body", video: "photo-1571019613454-1cb2f99b2d8b", alts: ["Mountain Climbers", "Jumping Jacks"] },
    { name: "Kettlebell Swing", muscle: "Posterior Chain", video: "photo-1534438327276-14e5300c3a48", alts: ["Clean con KB", "Peso Muerto KB"] },
    { name: "Box Jump", muscle: "Explosividad / Piernas", video: "photo-1517963879433-6ad2b056d712", alts: ["Salto al cajón", "Step-up Rápido"] },
    { name: "TRX Row", muscle: "Espalda / Bíceps", video: "photo-1583454110551-21f2fa2afe61", alts: ["Remo Invertido Barra", "Face Pull"] },
  ],
];

const progressData = [
  { week: "Sem 1", peso: 65, reps: 8 },
  { week: "Sem 2", peso: 67.5, reps: 9 },
  { week: "Sem 3", peso: 70, reps: 9 },
  { week: "Sem 4", peso: 72.5, reps: 10 },
  { week: "Sem 5", peso: 75, reps: 11 },
  { week: "Actual", peso: 77.5, reps: 12 },
];

const prevWeekData: Record<string, { reps: string; weight: string }[]> = {
  "Press de Banca": [{ reps: "8", weight: "75" }, { reps: "8", weight: "75" }, { reps: "7", weight: "75" }],
  Dominadas: [{ reps: "10", weight: "0" }, { reps: "9", weight: "0" }, { reps: "8", weight: "0" }],
  "Sentadilla con Barra": [{ reps: "8", weight: "90" }, { reps: "8", weight: "90" }, { reps: "7", weight: "90" }],
  "Press Militar": [{ reps: "8", weight: "50" }, { reps: "7", weight: "50" }, { reps: "7", weight: "50" }],
  Burpees: [{ reps: "12", weight: "0" }, { reps: "11", weight: "0" }, { reps: "10", weight: "0" }],
};

const defaultSets = () => [
  { reps: "", weight: "" },
  { reps: "", weight: "" },
  { reps: "", weight: "" },
];

function TimerWidget() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="bg-[#0B1929] rounded-xl p-4 flex items-center gap-4">
      <div>
        <p className="text-xs text-[#6B7A8D] font-mono">CRONÓMETRO</p>
        <p className="text-3xl font-mono font-bold text-white mt-1">{fmt(seconds)}</p>
      </div>
      <div className="flex gap-2 ml-auto">
        <button onClick={() => setRunning(!running)} className="w-10 h-10 rounded-full bg-[#1A6FD4] flex items-center justify-center text-white hover:bg-blue-500 transition-colors">
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => { setRunning(false); setSeconds(0); }} className="w-10 h-10 rounded-full bg-[#1E2D3D] flex items-center justify-center text-[#6B7A8D] hover:text-white transition-colors">
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Training() {
  const [activeDay, setActiveDay] = useState(0);
  const [logs, setLogs] = useState<Record<string, ExerciseLog>>({});
  const [expandedEx, setExpandedEx] = useState<number | null>(0);
  const [showAlt, setShowAlt] = useState<Record<number, boolean>>({});
  const [showProgress, setShowProgress] = useState(false);

  const exercises = exercisesByDay[activeDay];

  const getLog = (name: string): ExerciseLog =>
    logs[name] || { sets: defaultSets(), saved: false };

  const updateSet = (exName: string, setIdx: number, field: "reps" | "weight", value: string) => {
    const log = getLog(exName);
    const sets = [...log.sets];
    sets[setIdx] = { ...sets[setIdx], [field]: value };
    setLogs({ ...logs, [exName]: { sets, saved: false } });
  };

  const saveLog = (exName: string) => {
    const log = getLog(exName);
    setLogs({ ...logs, [exName]: { ...log, saved: true } });
  };

  const prev = (exName: string) => prevWeekData[exName];

  const diff = (curr: string, prevVal: string) => {
    const c = parseFloat(curr), p = parseFloat(prevVal);
    if (!curr || isNaN(c) || !prevVal || isNaN(p)) return null;
    const d = c - p;
    return { d, up: d > 0, same: d === 0 };
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">Rutina Semanal</p>
            <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: 'DM Sans' }}>Entrenamiento</h1>
            <p className="text-sm text-[#6B7A8D] mt-1">Paciente: <span className="text-[#1A6FD4] font-medium">Carlos Mendoza</span></p>
          </div>
          <button
            onClick={() => setShowProgress(!showProgress)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${showProgress ? "bg-[#1A6FD4] text-white border-[#1A6FD4]" : "bg-white text-[#1A6FD4] border-[#E2E8F0] hover:border-[#1A6FD4]"}`}
          >
            <TrendingUp size={15} />
            Progreso
          </button>
        </div>
      </div>

      {showProgress && (
        <div className="px-8 mb-6">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <h3 className="text-sm font-semibold text-[#0B1929] mb-4">Progresión de Carga — Press de Banca</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <Tooltip contentStyle={{ fontFamily: "JetBrains Mono", fontSize: 11, border: "1px solid #E2E8F0", borderRadius: 8 }} />
                <Line type="monotone" dataKey="peso" stroke="#1A6FD4" strokeWidth={2} dot={{ fill: "#1A6FD4", r: 4 }} name="Peso (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Day tabs */}
      <div className="px-8 flex gap-2 mb-5">
        {TRAINING_DAYS.map((d, i) => (
          <button
            key={d.label}
            onClick={() => { setActiveDay(i); setExpandedEx(0); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeDay === i ? "bg-[#1A6FD4] text-white shadow-md" : "bg-white text-[#6B7A8D] hover:bg-[#E8F1FB] border border-[#E2E8F0]"
            }`}
          >
            <div>{d.label}</div>
            <div className={`mt-0.5 text-[10px] ${activeDay === i ? "text-blue-200" : "text-[#CBD5E1]"}`}>{d.focus.split(" ")[0]}</div>
          </button>
        ))}
      </div>

      <div className="px-8 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase">{TRAINING_DAYS[activeDay].full} — {TRAINING_DAYS[activeDay].focus}</span>
        </div>
      </div>

      <div className="px-8 flex-1 overflow-y-auto space-y-3 pb-4">
        <TimerWidget />
        {exercises.map((ex, i) => {
          const log = getLog(ex.name);
          const prevSets = prev(ex.name);
          const isExpanded = expandedEx === i;
          return (
            <div key={ex.name} className={`bg-white rounded-xl border overflow-hidden transition-all ${isExpanded ? "border-[#1A6FD4]" : "border-[#E2E8F0]"}`}>
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left" onClick={() => setExpandedEx(isExpanded ? null : i)}>
                <div className="w-8 h-8 rounded-lg bg-[#E8F1FB] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-mono font-bold text-[#1A6FD4]">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0B1929]">{ex.name}</p>
                  <p className="text-xs text-[#6B7A8D]">{ex.muscle}</p>
                </div>
                {log.saved && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium border border-green-100">✓ Guardado</span>}
                <ChevronDown size={16} className={`text-[#CBD5E1] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-[#F0F4FA] space-y-4">
                  {/* Video placeholder */}
                  <div className="relative rounded-lg overflow-hidden h-36 mt-3">
                    <img src={`https://images.unsplash.com/${ex.video}?w=600&h=280&fit=crop&auto=format`} alt={ex.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-between p-3">
                      <div>
                        <p className="text-white text-sm font-semibold">{ex.name}</p>
                        <p className="text-white/70 text-xs">{ex.muscle}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                        <Play size={16} className="text-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Alternatives */}
                  <div>
                    <button
                      onClick={() => setShowAlt({ ...showAlt, [i]: !showAlt[i] })}
                      className="text-xs text-[#1A6FD4] font-medium flex items-center gap-1 hover:underline"
                    >
                      <ChevronDown size={12} className={`transition-transform ${showAlt[i] ? "rotate-180" : ""}`} />
                      Alternativas si no hay equipo
                    </button>
                    {showAlt[i] && (
                      <div className="mt-2 flex gap-2">
                        {ex.alts.map((alt) => (
                          <span key={alt} className="text-xs bg-[#F0F4FA] text-[#0B1929] px-3 py-1.5 rounded-lg border border-[#E2E8F0]">{alt}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sets table */}
                  <div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <span className="text-xs font-mono text-[#6B7A8D] uppercase">Serie</span>
                      <span className="text-xs font-mono text-[#6B7A8D] uppercase">Reps</span>
                      <span className="text-xs font-mono text-[#6B7A8D] uppercase">Kg</span>
                      <span className="text-xs font-mono text-[#6B7A8D] uppercase">vs anterior</span>
                    </div>
                    {log.sets.map((set, si) => {
                      const p = prevSets?.[si];
                      const repDiff = p ? diff(set.reps, p.reps) : null;
                      const wDiff = p ? diff(set.weight, p.weight) : null;
                      return (
                        <div key={si} className="grid grid-cols-4 gap-2 mb-2 items-center">
                          <span className="text-xs font-mono text-[#0B1929] font-semibold">{si + 1}</span>
                          <input
                            type="number"
                            placeholder={p?.reps || "–"}
                            value={set.reps}
                            onChange={(e) => updateSet(ex.name, si, "reps", e.target.value)}
                            className="h-8 w-full rounded-lg border border-[#E2E8F0] px-2 text-sm font-mono text-center focus:outline-none focus:border-[#1A6FD4]"
                          />
                          <input
                            type="number"
                            placeholder={p?.weight || "–"}
                            value={set.weight}
                            onChange={(e) => updateSet(ex.name, si, "weight", e.target.value)}
                            className="h-8 w-full rounded-lg border border-[#E2E8F0] px-2 text-sm font-mono text-center focus:outline-none focus:border-[#1A6FD4]"
                          />
                          <div className="flex gap-1 items-center">
                            {repDiff ? (
                              repDiff.same ? <Minus size={12} className="text-[#6B7A8D]" /> :
                              repDiff.up ? <TrendingUp size={12} className="text-green-500" /> :
                              <TrendingDown size={12} className="text-red-400" />
                            ) : <span className="text-xs text-[#CBD5E1]">—</span>}
                            {wDiff && !wDiff.same && (
                              <span className={`text-xs font-mono ${wDiff.up ? "text-green-500" : "text-red-400"}`}>
                                {wDiff.up ? "+" : ""}{wDiff.d.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => saveLog(ex.name)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A6FD4] text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    <Save size={14} />
                    Guardar serie
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
