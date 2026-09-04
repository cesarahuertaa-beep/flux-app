import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Save, ChevronDown, TrendingUp, TrendingDown, Minus, Dumbbell } from "lucide-react";
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
  progresoSemanaAnterior = {}, // Datos de la semana anterior para usar como placeholder
  clienteNombre,
  onSaveExercise,
  onProgressChange,
  semanaActualCiclo = 1,
}) {
  // Semana actual (índice 0-based para leer de progreso)
  const wi = Math.max(0, semanaActualCiclo - 1);

  const [activeRutinaIdx, setActiveRutinaIdx] = useState(0);
  const [expandedEx,      setExpandedEx]      = useState(0); // Primer ejercicio abierto por defecto
  const [showProgress,    setShowProgress]    = useState(false);
  const [showAlt,         setShowAlt]         = useState({}); // Controla el drilldown de alternativas

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
  // Los "días" son las rutinas disponibles (Día 1, Día 2… o su nombre)
  const ejercicios   = rutinaActiva?.ejercicios || [];

  // Gráfica de progresión del primer ejercicio
  const primerEx = ejercicios[0];
  const totalSemanas = rutinaActiva?.semanas || 4;
  const graficaData = primerEx
    ? Array.from({ length: totalSemanas }, (_, w) => {
        let maxPeso = 0;
        for (let s = 0; s < 6; s++) {
          const p = parseFloat(progreso[`${primerEx.id}-${w}-${s}-peso`]);
          if (!isNaN(p) && p > maxPeso) maxPeso = p;
        }
        return maxPeso > 0 ? { week: `Sem ${w + 1}`, peso: maxPeso } : null;
      }).filter(Boolean)
    : [];

  // Helper: valor de semana anterior como placeholder
  const getPrevVal = (ejId, si, tipo) => {
    if (wi === 0) return ""; // Si es la primera semana, no hay historial que mostrar
    const val = progresoSemanaAnterior[`${ejId}-${wi - 1}-${si}-${tipo}`]
      || progreso[`${ejId}-${wi - 1}-${si}-${tipo}`];
    return val || "N/A";
  };

  // Helper: diferencia vs semana anterior
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
              Progresión de Carga — {primerEx?.nombre}
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
          // Subtítulo: usamos el grupo del primer ejercicio si existe
          const subLabel = r.ejercicios?.[0]?.musculo?.split("/")[0]?.trim() || "";
          return (
            <button
              key={r.id || i}
              onClick={() => { setActiveRutinaIdx(i); setExpandedEx(0); }}
              className={`flex-1 min-w-[52px] py-2.5 rounded-lg text-xs font-semibold transition-all flex flex-col items-center ${
                isActive
                  ? "bg-[var(--brand-primary)] text-white shadow-md"
                  : "bg-white text-[#6B7A8D] hover:bg-[#E8F1FB] border border-[#E2E8F0]"
              }`}
            >
              <span>{r.nombre}</span>
              {subLabel && (
                <span className={`mt-0.5 text-[10px] ${isActive ? "text-blue-200" : "text-[#CBD5E1]"}`}>
                  {subLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Subtítulo del día activo ── */}
      <div className="px-6 md:px-8 mb-3">
        <span className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase">
          {rutinaActiva?.nombre} — Semana {semanaActualCiclo}
        </span>
      </div>

      {/* ── Lista de ejercicios ── */}
      <div className="px-6 md:px-8 flex-1 overflow-y-auto space-y-3 pb-8">

        {/* Cronómetro inline, justo antes del primer ejercicio (igual que Figma) */}
        <TimerCard />

        {ejercicios.map((ex, i) => {
          const numSeries  = ex.num_series || 3;
          const isExpanded = expandedEx === i;

          return (
            <div
              key={ex.id || i}
              className={`bg-white rounded-xl border overflow-hidden transition-all ${
                isExpanded ? "border-[var(--brand-primary)] shadow-sm" : "border-[#E2E8F0]"
              }`}
            >
              {/* ── Fila colapsada ── */}
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpandedEx(isExpanded ? null : i)}
              >
                <div className="w-8 h-8 rounded-lg bg-[#E8F1FB] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-mono font-bold text-[var(--brand-primary)]">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0B1929]">{ex.nombre}</p>
                  <p className="text-xs text-[#6B7A8D]">{ex.musculo || "General"}</p>
                </div>
                {/* Badge "Guardado" si hay datos esta semana */}
                {progreso[`${ex.id}-${wi}-0-reps`] && (
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium border border-green-100 hidden md:block">
                    ✓ Guardado
                  </span>
                )}
                <ChevronDown
                  size={16}
                  className={`text-[#CBD5E1] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {/* ── Contenido expandido ── */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-[#F0F4FA] pt-4">

                  {/* Fila superior: Miniatura GIF (Izquierda) + Alternativas (Derecha) */}
                  <div className="flex items-start gap-4 mb-5">
                    {/* Miniatura: Discreta, 96x96px */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-[#0B1929] rounded-xl overflow-hidden shadow-sm relative flex items-center justify-center">
                      {ex.gif_url ? (
                        <img
                          src={ex.gif_url}
                          alt={ex.nombre}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Dumbbell size={28} className="text-[#3D5A80]" />
                      )}
                      {/* Indicador sutil de que es un GIF */}
                      {ex.gif_url && (
                        <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-mono text-white tracking-widest uppercase">GIF</span>
                        </div>
                      )}
                    </div>

                    {/* Alternativas / Notas -> Drill-down */}
                    <div className="flex-1 min-w-0">
                      {ex.notas ? (
                        <div className="bg-[#F7F9FC] rounded-lg p-2.5 border border-[#E2E8F0]">
                          <button
                            onClick={() => setShowAlt(s => ({ ...s, [i]: !s[i] }))}
                            className="w-full flex items-center justify-between text-[11px] font-semibold text-[#0B1929]"
                          >
                            <span className="flex items-center gap-1.5 uppercase tracking-widest text-[#6B7A8D]">
                              <Dumbbell size={12} className="text-[var(--brand-primary)]" />
                              Opciones Alternativas
                            </span>
                            <ChevronDown
                              size={14}
                              className={`transition-transform text-[#6B7A8D] ${showAlt[i] ? "rotate-180" : ""}`}
                            />
                          </button>

                          {/* 
                             NOTA: Como los ejercicios alternativos no existen en la BD actual 
                             (solo hay una lista de nombres en `ex.notas`), simularemos su vista.
                             En el futuro, cuando la BD soporte múltiples ejercicios alternativos 
                             con sus propios IDs, aquí mapearíamos sus URLs de GIF reales.
                          */}
                          {showAlt[i] && (
                            <div className="mt-2.5 pt-2.5 border-t border-[#E2E8F0] flex gap-3 overflow-x-auto scroll-hide">
                              {ex.notas.split(",").map((alt, idx) => (
                                <div key={idx} className="w-16 sm:w-20 flex-shrink-0 flex flex-col gap-1.5 items-center">
                                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0B1929] rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden">
                                    <Dumbbell size={20} className="text-[#3D5A80]" />
                                    {/* <img src={alt.gif_url} className="w-full h-full object-contain" /> */}
                                  </div>
                                  <p className="text-[9px] font-medium text-center text-[#6B7A8D] leading-tight line-clamp-2">
                                    {alt.trim()}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[#9BA5B0] italic mt-2">
                          Sin instrucciones adicionales.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tabla de Series (Grid alineado y proporcionado) */}
                  <div>
                    {/* Cabecera de la tabla */}
                    <div className="flex gap-2 mb-2 px-1 items-center">
                      <div className="w-8 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Serie</div>
                      <div className="flex-1 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Reps</div>
                      <div className="flex-1 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Peso (Kg)</div>
                      <div className="w-12 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Avance</div>
                    </div>

                    {Array.from({ length: numSeries }).map((_, si) => {
                      const repVal   = progreso[`${ex.id}-${wi}-${si}-reps`]  || "";
                      const kgVal    = progreso[`${ex.id}-${wi}-${si}-peso`]  || "";
                      // Placeholder = lo que hizo la semana ANTERIOR (en gris)
                      const prevReps = getPrevVal(ex.id, si, "reps");
                      const prevKg   = getPrevVal(ex.id, si, "peso");

                      const kgDiff  = getDiff(kgVal, prevKg);

                      return (
                        <div key={si} className="flex gap-2 mb-2 items-center">
                          {/* Número de serie */}
                          <div className="w-8 text-center text-xs font-mono text-[#0B1929] font-bold">
                            {si + 1}
                          </div>

                          {/* Input Reps */}
                          <div className="flex-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder={prevReps}
                              value={repVal}
                              onChange={(e) => onProgressChange(ex.id, wi, si, "reps", e.target.value)}
                              className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-2 text-center text-[15px] font-semibold text-[#0B1929] placeholder-[#9BA5B0] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] outline-none transition-shadow"
                            />
                          </div>

                          {/* Input Peso */}
                          <div className="flex-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder={prevKg}
                              value={kgVal}
                              onChange={(e) => onProgressChange(ex.id, wi, si, "peso", e.target.value)}
                              className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-2 text-center text-[15px] font-semibold text-[#0B1929] placeholder-[#9BA5B0] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] outline-none transition-shadow"
                            />
                          </div>

                          {/* Diferencia vs semana anterior */}
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
                              /* Estado vacío sutil (sin raya brusca) */
                              <span className="text-[10px] text-[#CBD5E1] font-mono">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Botón guardar — discreto, a la izquierda, como Figma */}
                  <button
                    onClick={() => onSaveExercise(ex.id, wi)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all"
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
