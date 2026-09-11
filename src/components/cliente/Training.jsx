import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Save, ChevronDown, TrendingUp, TrendingDown, Minus, Dumbbell, Check, CheckCheck } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── Cronómetro inline (exactamente como Figma: tarjeta oscura dentro del scroll) ──
function TimerCard({ brandColor }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(ref.current);
    }
    return () => clearInterval(ref.current);
  }, [running]);

  const fmt = s =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="bg-[#0B1929] rounded-xl p-4 flex items-center gap-4 mb-3">
      <div>
        <p className="text-[10px] text-[#6B7A8D] font-mono tracking-widest uppercase">Cronómetro</p>
        <p className="text-3xl font-mono font-bold text-white mt-1">{fmt(seconds)}</p>
      </div>
      <div className="flex gap-2 ml-auto">
        <button
          onClick={() => setRunning(r => !r)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors"
          style={{ background: brandColor || "var(--brand-primary)" }}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={() => { setRunning(false); setSeconds(0); }}
          className="w-10 h-10 rounded-full bg-[#1E2D3D] flex items-center justify-center text-[#6B7A8D] hover:text-white transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Training({
  rutinas,
  progreso,
  progresoSemanaAnterior = {}, 
  clienteNombre,
  onProgressChange,
  semanaActualCiclo = 1,
  syncStatus = "synced",
}) {
  // Semana actual (índice 0-based para leer de progreso)
  const wi = Math.max(0, semanaActualCiclo - 1);

  const [activeRutinaIdx, setActiveRutinaIdx] = useState(0);
  const [expandedEx,      setExpandedEx]      = useState(0); // Primer ejercicio abierto por defecto
  const [showProgress,    setShowProgress]    = useState(false);
  const [activeVariant,   setActiveVariant]   = useState({}); // { [exId]: 'original' | 'alt_0' }
  const [unitPrefs,       setUnitPrefs]       = useState({}); // { [exId_variantId]: 'kg' | 'lb' }

  if (!rutinas || rutinas.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-[#F0F4FA] rounded-full flex items-center justify-center mb-4">
          <Dumbbell size={32} className="text-[#6B7A8D]" />
        </div>
        <h2 className="text-xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans" }}>
          Rutina en preparación
        </h2>
        <p className="text-sm text-[#6B7A8D]">
          Tu nutriólogo está diseñando tu plan de entrenamiento.
        </p>
      </div>
    );
  }

  const rutinaActiva = rutinas[activeRutinaIdx];
  const ejercicios   = rutinaActiva?.ejercicios || [];

  const getVariantObj = (ex) => {
    const variantId = activeVariant[ex.id] || "original";
    if (variantId === "original") return { obj: ex, variantId: "original" };
    const altIdx = parseInt(variantId.replace("alt_", ""));
    return { obj: (ex.alternativas || [])[altIdx] || ex, variantId };
  };

  const primerExObj = ejercicios[0] ? getVariantObj(ejercicios[0]).obj : null;
  const totalSemanas = rutinaActiva?.semanas || 4;
  const graficaData = primerExObj
    ? Array.from({ length: totalSemanas }, (_, w) => {
        let maxPeso = 0;
        for (let s = 0; s < 6; s++) {
          const p = parseFloat(progreso[`${ejercicios[0].id}-${w}-${s}-peso-${activeVariant[ejercicios[0].id] || 'original'}`]);
          if (!isNaN(p) && p > maxPeso) maxPeso = p;
        }
        return maxPeso > 0 ? { week: `Sem ${w + 1}`, peso: maxPeso } : null;
      }).filter(Boolean)
    : [];

  const getPrevVal = (exId, variantId, exObj, si, tipo) => {
    if (wi === 0) {
      if (tipo === "reps") return exObj.reps_sugeridas || "10";
      if (tipo === "peso") return exObj.peso_sugerido || "-";
      return "";
    }
    const key = `${exId}-${wi - 1}-${si}-${tipo}-${variantId}`;
    const val = progresoSemanaAnterior[key] || progreso[key];
    return val || "N/A";
  };

  const parseDisplayWeight = (dbVal, unit) => {
    if (!dbVal || dbVal === "-" || isNaN(dbVal)) return dbVal;
    return unit === 'lb' ? Math.round(parseFloat(dbVal) * 2.20462) : dbVal;
  };

  const parseDBWeight = (inputVal, unit) => {
    if (!inputVal || inputVal === "-") return inputVal;
    const p = parseFloat(inputVal);
    if (isNaN(p)) return inputVal;
    return unit === 'lb' ? (p * 0.453592).toFixed(1) : p.toString();
  };

  const getDiff = (curr, prev) => {
    const c = parseFloat(curr), p = parseFloat(prev);
    if (!curr || isNaN(c) || !prev || isNaN(p)) return null;
    const d = c - p;
    return { d, up: d > 0, same: d === 0 };
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Header ── */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
              Rutina Semanal
            </p>
            <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
              Entrenamiento
            </h1>
            {clienteNombre && (
              <p className="text-sm text-[#6B7A8D] mt-1">
                Paciente:{" "}
                <span className="text-[var(--brand-primary)] font-medium">{clienteNombre}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => setShowProgress(s => !s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              showProgress
                ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                : "bg-white text-[var(--brand-primary)] border-[#E2E8F0] hover:border-[var(--brand-primary)]"
            }`}
          >
            <TrendingUp size={15} />
            Progreso
          </button>
        </div>
      </div>

      {/* ── Gráfica de progresión (opcional) ── */}
      {showProgress && graficaData.length > 0 && (
        <div className="px-6 md:px-8 mb-5">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <h3 className="text-sm font-semibold text-[#0B1929] mb-4">
              Progresión de Carga — {primerExObj?.nombre}
            </h3>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={graficaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <Tooltip
                  contentStyle={{
                    fontFamily: "JetBrains Mono",
                    fontSize: 11,
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="peso"
                  stroke="var(--brand-primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--brand-primary)", r: 4 }}
                  name="Peso (kg)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Day tabs (las rutinas/días del cliente) ── */}
      <div className="px-6 md:px-8 flex gap-2 mb-4 overflow-x-auto scroll-hide">
        {rutinas.map((r, i) => {
          const isActive = activeRutinaIdx === i;
          
          let shortTab = `Día ${i + 1}`;
          if (r.nombre) {
            const parts = String(r.nombre).split('|');
            if (parts.length > 1) {
              shortTab = parts[0];
            } else {
              const firstWord = String(r.nombre).split(' ')[0];
              shortTab = firstWord.length <= 5 ? firstWord : firstWord.substring(0, 3).toUpperCase();
            }
          }

          return (
            <button
              key={r.id || i}
              onClick={() => { setActiveRutinaIdx(i); setExpandedEx(0); }}
              className={`flex-1 min-w-[52px] py-2.5 rounded-lg text-xs font-semibold transition-all flex flex-col items-center justify-center ${
                isActive
                  ? "bg-[var(--brand-primary)] text-white shadow-md"
                  : "bg-white text-[#6B7A8D] hover:bg-[#E8F1FB] border border-[#E2E8F0]"
              }`}
            >
              <span className="uppercase">{shortTab}</span>
            </button>
          );
        })}
      </div>

        {/* ✨ Subtítulo del día activo ✨ */}
        <div className="px-6 md:px-8 mb-3">
          <span className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase">
            {(() => {
              const nombre = rutinaActiva?.nombre;
              if (!nombre) return `Rutina — Semana ${semanaActualCiclo}`;
              const parts = String(nombre).split('|');
              const title = parts.length > 1 ? parts.slice(1).join('|') : parts[0];
              return `${title} — Semana ${semanaActualCiclo}`;
            })()}
          </span>
        </div>

      {/* ── Lista de ejercicios ── */}
      <div className="px-6 md:px-8 flex-1 overflow-y-auto space-y-3 pb-8">

        {/* Cronómetro inline, justo antes del primer ejercicio (igual que Figma) */}
        <TimerCard />

        {ejercicios.map((ex, i) => {
          const numSeries = ex.num_series || 3;
          const isExpanded = expandedEx === i;

          const varData = getVariantObj(ex);
          const activeObj = varData.obj;
          const activeVarId = varData.variantId;

          const otherVariants = [];
          if (activeVarId !== "original") {
            otherVariants.push({ obj: ex, variantId: "original" });
          }
          (ex.alternativas || []).forEach((alt, altIdx) => {
            const vid = `alt_${altIdx}`;
            if (vid !== activeVarId) otherVariants.push({ obj: alt, variantId: vid });
          });

          // Check if there is data this week for any variant of this exercise
          const isSaved = ["original", "alt_0", "alt_1"].some(vid => progreso[`${ex.id}-${wi}-0-reps-${vid}`] !== undefined);

          return (
            <div
              key={ex.id || i}
              className={`bg-white rounded-xl border overflow-hidden transition-all ${
                isExpanded ? "border-[var(--brand-primary)] shadow-sm" : "border-[#E2E8F0]"
              }`}
            >
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpandedEx(isExpanded ? null : i)}
              >
                <div className="w-8 h-8 rounded-lg bg-[#E8F1FB] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-mono font-bold text-[var(--brand-primary)]">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0B1929]">{activeObj.nombre}</p>
                  <p className="text-xs text-[#6B7A8D]">{activeObj.grupo_muscular || activeObj.musculo || "General"}</p>
                </div>
                {isSaved && (
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium border border-green-100 hidden md:block">
                    ✓ Guardado
                  </span>
                )}
                <ChevronDown
                  size={16}
                  className={`text-[#CBD5E1] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-[#F0F4FA] pt-4">

                  {/* Fila superior: Miniatura GIF + Alternativas */}
                  <div className="flex items-start gap-4 mb-5">
                    {/* Miniatura Activa */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-[#0B1929] rounded-xl overflow-hidden shadow-sm relative flex items-center justify-center">
                      {activeObj.gif_url ? (
                        <img src={activeObj.gif_url} alt={activeObj.nombre} className="w-full h-full object-contain" />
                      ) : (
                        <Dumbbell size={28} className="text-[#3D5A80]" />
                      )}
                      {activeObj.gif_url && (
                        <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-mono text-white tracking-widest uppercase">GIF</span>
                        </div>
                      )}
                    </div>

                    {/* Alternativas Clickables */}
                    <div className="flex-1 min-w-0 flex gap-3 overflow-x-auto pb-2 scroll-hide">
                      {otherVariants.map((v) => (
                        <button 
                          key={v.variantId}
                          onClick={() => setActiveVariant(s => ({ ...s, [ex.id]: v.variantId }))}
                          className="w-16 sm:w-20 flex-shrink-0 flex flex-col gap-1.5 items-center opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0B1929] rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden">
                            {v.obj.gif_url ? (
                              <img src={v.obj.gif_url} className="w-full h-full object-contain" />
                            ) : (
                              <Dumbbell size={20} className="text-[#3D5A80]" />
                            )}
                            <div className="absolute top-1 left-1 bg-black/60 rounded px-1 py-0.5">
                              <span className="text-[7px] font-bold text-white uppercase">{v.variantId === 'original' ? 'ORG' : 'ALT'}</span>
                            </div>
                          </div>
                          <p className="text-[9px] font-medium text-center text-[#6B7A8D] leading-tight line-clamp-2">
                            {v.obj.nombre}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tabla de Series */}
                  <div>
                    <div className="flex gap-2 mb-2 px-1 items-center">
                      <div className="w-8 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Serie</div>
                      <div className="flex-1 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Reps</div>
                      <div className="flex-1 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Peso</div>
                      <div className="w-12 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Avance</div>
                    </div>

                    {Array.from({ length: numSeries }).map((_, si) => {
                      const repKey   = `${ex.id}-${wi}-${si}-reps-${activeVarId}`;
                      const kgKey    = `${ex.id}-${wi}-${si}-peso-${activeVarId}`;
                      const repVal   = progreso[repKey] || "";
                      const kgVal    = progreso[kgKey] || "";
                      
                      const prevReps = getPrevVal(ex.id, activeVarId, activeObj, si, "reps");
                      const prevKg   = getPrevVal(ex.id, activeVarId, activeObj, si, "peso");
                      
                      const prefUnit = unitPrefs[`${ex.id}_${activeVarId}`] || activeObj.unidad || 'kg';
                      
                      const displayKgVal  = parseDisplayWeight(kgVal, prefUnit);
                      const displayPrevKg = parseDisplayWeight(prevKg, prefUnit);
                      
                      const kgDiff  = getDiff(displayKgVal, displayPrevKg);

                      return (
                        <div key={si} className="flex gap-2 mb-2 items-center">
                          <div className="w-8 text-center text-xs font-mono text-[#0B1929] font-bold">
                            {si + 1}
                          </div>

                          <div className="flex-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder={prevReps}
                              value={repVal}
                              onChange={(e) => onProgressChange(ex.id, wi, si, "reps", e.target.value, activeVarId)}
                              className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-2 text-center text-[15px] font-semibold text-[#0B1929] placeholder-[#9BA5B0] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] outline-none transition-shadow"
                            />
                          </div>

                          <div className="flex-1 relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={displayPrevKg}
                              value={displayKgVal}
                              onChange={(e) => {
                                const dbVal = parseDBWeight(e.target.value, prefUnit);
                                onProgressChange(ex.id, wi, si, "peso", dbVal, activeVarId);
                              }}
                              className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-2 pr-6 text-center text-[15px] font-semibold text-[#0B1929] placeholder-[#9BA5B0] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] outline-none transition-shadow"
                            />
                            <button 
                              onClick={() => setUnitPrefs(s => ({ ...s, [`${ex.id}_${activeVarId}`]: prefUnit === 'kg' ? 'lb' : 'kg' }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#6B7A8D] uppercase hover:text-[var(--brand-primary)]"
                            >
                              {prefUnit}
                            </button>
                          </div>

                          <div className="w-12 flex justify-center items-center">
                            {kgDiff ? (
                              <div className="flex items-center gap-0.5">
                                {kgDiff.same
                                  ? <Minus size={12} className="text-[#9BA5B0]" />
                                  : kgDiff.up
                                    ? <TrendingUp size={12} className="text-emerald-500" />
                                    : <TrendingDown size={12} className="text-red-400" />
                                }
                                {!kgDiff.same && (
                                  <span className={`text-[11px] font-mono font-bold tracking-tight ${kgDiff.up ? "text-emerald-500" : "text-red-400"}`}>
                                    {kgDiff.up ? "+" : ""}{kgDiff.d.toFixed(1).replace(".0", "")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#CBD5E1] font-mono">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 mt-4 text-[11px] font-medium text-[#6B7A8D]">
                    {syncStatus === "saving" && <RotateCcw size={14} className="animate-spin text-[var(--brand-primary)]" />}
                    {syncStatus === "local" && <Check size={14} />}
                    {syncStatus === "synced" && <CheckCheck size={14} className="text-[var(--brand-primary)]" />}
                    <span>
                      {syncStatus === "saving" ? "Guardando..." : syncStatus === "local" ? "Guardado localmente" : "Sincronizado"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
