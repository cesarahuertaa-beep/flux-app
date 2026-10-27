import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Target,
  Lock,
  Sparkles,
} from "lucide-react";

const CHART_METRICS = [
  { key: "peso", label: "Peso", unit: "kg", color: "#1A6FD4", inverseGood: false },
  { key: "grasa_pct", label: "% Grasa", unit: "%", color: "#F59E0B", inverseGood: true },
  { key: "masa_libre_grasa", label: "Masa Magra (MLG)", unit: "kg", color: "#10B981", inverseGood: false },
  { key: "musculo_pct", label: "% Músculo", unit: "%", color: "#10B981", inverseGood: false },
  { key: "calc_masa_muscular", label: "Masa Muscular", unit: "kg", color: "#10B981", inverseGood: false },
  { key: "inbody_smm", label: "Masa Muscular (SMM)", unit: "kg", color: "#10B981", inverseGood: false },
  { key: "calc_masa_grasa", label: "Masa Grasa", unit: "kg", color: "#F43F5E", inverseGood: true },
  { key: "cintura", label: "Cintura", unit: "cm", color: "#8B5CF6", inverseGood: true },
  { key: "cadera", label: "Cadera", unit: "cm", color: "#EC4899", inverseGood: true },
  { key: "imc", label: "IMC", unit: "", color: "#06B6D4", inverseGood: true },
];

const fmtShortDate = (d) => {
  if (!d) return "";
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};

const fmtFullDate = (d) => {
  if (!d) return "";
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
};

function classifySomatotype(x, y) {
  if (x == null || y == null || isNaN(x) || isNaN(y)) return "Sin clasificar";
  const dist = Math.sqrt(x * x + y * y);
  if (dist < 1.5) return "Central (Equilibrado)";
  if (y >= 2 && Math.abs(x) <= 1.5) return "Mesomorfo Balanceado";
  if (y >= 1.5 && x < -1.5) return "Endo-Mesomorfo";
  if (y >= 1.5 && x > 1.5) return "Ecto-Mesomorfo";
  if (x < -1.5 && y < 1.5 && y >= -2) return "Meso-Endomorfo";
  if (x < -1.5 && y < -2) return "Endomorfo Dominante";
  if (x > 1.5 && y < 1.5 && y >= -2) return "Meso-Ectomorfo";
  if (x > 1.5 && y < -2) return "Ectomorfo Dominante";
  if (y < -2 && Math.abs(x) <= 1.5) return "Endo-Ectomorfo";
  return y >= 0 ? "Tendencia Mesomorfa" : x < 0 ? "Tendencia Endomorfa" : "Tendencia Ectomorfa";
}

export function EvolutionCharts({ metricas = [], isLocked = false, brandColor }) {
  // Sort oldest to newest for chronological plotting
  const chronological = useMemo(() => {
    return [...metricas]
      .filter((m) => m && m.fecha)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [metricas]);

  // Available metrics that have at least 1 numeric value
  const availableMetrics = useMemo(() => {
    return CHART_METRICS.filter((cm) =>
      chronological.some((m) => m[cm.key] != null && m[cm.key] !== "" && !isNaN(parseFloat(m[cm.key])))
    );
  }, [chronological]);

  const [selectedMetricKey, setSelectedMetricKey] = useState(null);
  const [selectedSomatoIdx, setSelectedSomatoIdx] = useState(null);

  const activeMetric = useMemo(() => {
    if (!availableMetrics.length) return CHART_METRICS[0];
    return availableMetrics.find((m) => m.key === selectedMetricKey) || availableMetrics[0];
  }, [availableMetrics, selectedMetricKey]);

  const chartData = useMemo(() => {
    if (!activeMetric) return [];
    const pts = [];
    chronological.forEach((m) => {
      const raw = m[activeMetric.key];
      if (raw != null && raw !== "" && !isNaN(parseFloat(raw))) {
        const val = parseFloat(raw);
        const prevVal = pts.length > 0 ? pts[pts.length - 1].value : null;
        const delta = prevVal !== null ? val - prevVal : null;
        pts.push({
          fecha: m.fecha,
          label: fmtShortDate(m.fecha),
          fullDate: fmtFullDate(m.fecha),
          value: Number(val.toFixed(2)),
          delta: delta !== null ? Number(delta.toFixed(2)) : null,
        });
      }
    });
    return pts;
  }, [chronological, activeMetric]);

  // Somatotype points
  const somatoPoints = useMemo(() => {
    return chronological
      .filter(
        (m) =>
          m.somatotipo_x != null &&
          m.somatotipo_y != null &&
          m.somatotipo_x !== "" &&
          m.somatotipo_y !== "" &&
          !isNaN(parseFloat(m.somatotipo_x)) &&
          !isNaN(parseFloat(m.somatotipo_y))
      )
      .map((m) => ({
        id: m.id,
        fecha: m.fecha,
        label: fmtShortDate(m.fecha),
        fullDate: fmtFullDate(m.fecha),
        x: parseFloat(m.somatotipo_x),
        y: parseFloat(m.somatotipo_y),
        peso: m.peso,
        grasa_pct: m.grasa_pct,
      }));
  }, [chronological]);

  if (chronological.length === 0 || availableMetrics.length === 0) {
    return null;
  }

  const firstVal = chartData.length > 0 ? chartData[0].value : null;
  const lastVal = chartData.length > 0 ? chartData[chartData.length - 1].value : null;
  const totalDelta =
    chartData.length > 1 && firstVal !== null && lastVal !== null
      ? Number((lastVal - firstVal).toFixed(2))
      : null;

  const isGoodDelta =
    totalDelta !== null && totalDelta !== 0
      ? activeMetric.inverseGood
        ? totalDelta < 0
        : totalDelta > 0
      : null;

  const strokeColor =
    activeMetric.key === "peso" && brandColor ? brandColor : activeMetric.color;

  // Coordinate mapping for Somatocarta SVG (320 x 280 viewport)
  // X range: [-9, 9] -> [30, 290] (center = 160)
  // Y range: [-10, 16] -> [245, 25] (center Y=0 is at ~160)
  const mapSomatoX = (x) => {
    const clamped = Math.max(-9, Math.min(9, x));
    return 160 + (clamped / 9) * 125;
  };
  const mapSomatoY = (y) => {
    const clamped = Math.max(-10, Math.min(16, y));
    // y=0 -> 165, y=14 -> 35, y=-8 -> 240
    return 165 - (clamped / 14) * 130;
  };

  const activeSomato =
    somatoPoints.length > 0
      ? somatoPoints[selectedSomatoIdx != null ? selectedSomatoIdx : somatoPoints.length - 1] ||
        somatoPoints[somatoPoints.length - 1]
      : null;

  return (
    <div className="space-y-6 my-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── 1. CURVA DE EVOLUCIÓN CORPORAL ── */}
        <div
          className="relative bg-white rounded-3xl p-5 md:p-7 shadow-sm border border-[#E2E8F0] overflow-hidden lg:col-span-7"
        >
          {isLocked && (
            <div className="absolute inset-0 z-30 backdrop-blur-md bg-[#0B1929]/75 rounded-3xl flex flex-col items-center justify-center p-6 text-center">
              <Lock size={40} className="text-amber-400 mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">Gráficas de Evolución Premium</h3>
              <p className="text-slate-200 text-xs max-w-xs mb-4">
                Desbloquea tus curvas históricas de peso, porcentaje de grasa, masa muscular y somatocarta.
              </p>
              <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400 bg-amber-500/20 border border-amber-500/30 px-3.5 py-1.5 rounded-lg">
                Exclusivo Plan Premium
              </span>
            </div>
          )}

          <div className={isLocked ? "blur-sm pointer-events-none select-none opacity-50" : ""}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F0F4FA] flex items-center justify-center text-[var(--brand-primary)]">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-[#0B1929]">
                    Curva de Evolución
                  </h3>
                </div>
                <p className="text-xs text-[#6B7A8D] mt-0.5">
                  Tendencia histórica a través de {chartData.length}{" "}
                  {chartData.length === 1 ? "evaluación" : "evaluaciones"}
                </p>
              </div>

              {/* Resumen Inicial -> Actual */}
              {chartData.length > 0 && (
                <div className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl px-3.5 py-2 self-start sm:self-auto">
                  {chartData.length > 1 && (
                    <>
                      <div className="text-left">
                        <p className="text-[9px] font-bold text-[#9BA5B0] uppercase tracking-wider">
                          Inicio
                        </p>
                        <p className="text-xs font-bold text-[#6B7A8D]">
                          {firstVal} {activeMetric.unit}
                        </p>
                      </div>
                      <div className="text-[#CBD5E1] text-xs font-bold">→</div>
                    </>
                  )}
                  <div className="text-left">
                    <p className="text-[9px] font-bold text-[#9BA5B0] uppercase tracking-wider">
                      Actual
                    </p>
                    <p className="text-sm font-bold text-[#0B1929]">
                      {lastVal} {activeMetric.unit}
                    </p>
                  </div>
                  {totalDelta !== null && totalDelta !== 0 && (
                    <div
                      className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-bold ${
                        isGoodDelta
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : "bg-amber-50 text-amber-600 border border-amber-200"
                      }`}
                    >
                      {totalDelta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      <span>
                        {totalDelta > 0 ? "+" : ""}
                        {totalDelta} {activeMetric.unit}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Píldoras selectoras de métrica */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scroll-hide">
              {availableMetrics.map((m) => {
                const isSelected = activeMetric.key === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMetricKey(m.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-[#0B1929] text-white border-[#0B1929] shadow-sm"
                        : "bg-[#F8FAFC] text-[#6B7A8D] border-[#E2E8F0] hover:text-[#0B1929] hover:bg-[#F0F4FA]"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Gráfica AreaChart */}
            {chartData.length > 0 ? (
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${activeMetric.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={strokeColor} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#6B7A8D", fontWeight: 600 }}
                      axisLine={{ stroke: "#E2E8F0" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 11, fill: "#6B7A8D" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-[#0B1929] text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-white/10 text-xs">
                            <p className="text-[10px] text-slate-400 font-mono uppercase mb-1">
                              {pt.fullDate}
                            </p>
                            <p className="text-sm font-bold">
                              {pt.value} {activeMetric.unit}
                            </p>
                            {pt.delta !== null && pt.delta !== 0 && (
                              <p
                                className={`text-[11px] font-semibold mt-0.5 ${
                                  (activeMetric.inverseGood ? pt.delta < 0 : pt.delta > 0)
                                    ? "text-emerald-400"
                                    : "text-amber-400"
                                }`}
                              >
                                {pt.delta > 0 ? "+" : ""}
                                {pt.delta} {activeMetric.unit} vs. anterior
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={strokeColor}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill={`url(#grad-${activeMetric.key})`}
                      dot={{
                        r: 4,
                        fill: "#FFFFFF",
                        stroke: strokeColor,
                        strokeWidth: 2.5,
                      }}
                      activeDot={{
                        r: 6,
                        fill: strokeColor,
                        stroke: "#FFFFFF",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-[#6B7A8D]">
                Sin datos suficientes para graficar esta métrica.
              </div>
            )}
          </div>
        </div>

        {/* ── 2. SOMATOCARTA DE HEATH-CARTER ── */}
        <div className="relative bg-white rounded-3xl p-5 md:p-7 shadow-sm border border-[#E2E8F0] overflow-hidden lg:col-span-5 flex flex-col justify-between">
          {isLocked && (
            <div className="absolute inset-0 z-30 backdrop-blur-md bg-[#0B1929]/75 rounded-3xl flex flex-col items-center justify-center p-6 text-center">
              <Lock size={36} className="text-amber-400 mb-2" />
              <h3 className="text-base font-bold text-white mb-1">Somatocarta Heath-Carter</h3>
              <p className="text-slate-200 text-xs max-w-xs">
                Visualiza tu biotipo corporal y su trayectoria hacia el mesomorfismo.
              </p>
            </div>
          )}

          <div className={isLocked ? "blur-sm pointer-events-none select-none opacity-50" : ""}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Target className="w-4 h-4" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-[#0B1929]">
                    Somatocarta
                  </h3>
                </div>
                <p className="text-xs text-[#6B7A8D] mt-0.5">
                  Biotipo de Heath-Carter y trayectoria
                </p>
              </div>

              {activeSomato && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                  {classifySomatotype(activeSomato.x, activeSomato.y)}
                </span>
              )}
            </div>

              {/* SVG Triángulo de Reuleaux / Somatocarta */}
              <div className="w-full flex justify-center my-1">
                <svg
                  viewBox="0 0 320 275"
                  className="w-full max-w-[310px] h-auto select-none overflow-visible"
                >
                  <defs>
                    <radialGradient id="somatoBg" cx="50%" cy="55%" r="55%">
                      <stop offset="0%" stopColor="#F8FAFC" />
                      <stop offset="100%" stopColor="#F0F4FA" />
                    </radialGradient>
                  </defs>

                  {/* Triángulo curvo de Reuleaux */}
                  <path
                    d="M 160 22 Q 268 115 275 235 Q 160 262 45 235 Q 52 115 160 22 Z"
                    fill="url(#somatoBg)"
                    stroke="#CBD5E1"
                    strokeWidth="1.5"
                  />

                  {/* Círculos concéntricos guía */}
                  <circle
                    cx="160"
                    cy="165"
                    r="28"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx="160"
                    cy="165"
                    r="65"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />

                  {/* Ejes X e Y */}
                  <line
                    x1="160"
                    y1="22"
                    x2="160"
                    y2="248"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1="45"
                    y1="165"
                    x2="275"
                    y2="165"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  {/* Diagonales desde el origen (160, 165) hacia los vértices inferiores */}
                  <line
                    x1="160"
                    y1="165"
                    x2="45"
                    y2="235"
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  <line
                    x1="160"
                    y1="165"
                    x2="275"
                    y2="235"
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />

                  {/* Etiquetas de los 3 polos */}
                  <g>
                    <rect x="122" y="4" width="76" height="18" rx="9" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="1" />
                    <text x="160" y="16" textAnchor="middle" className="text-[9px] font-bold fill-emerald-700">
                      MESOMORFO
                    </text>
                  </g>

                  <g>
                    <rect x="17" y="244" width="76" height="18" rx="9" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1" />
                    <text x="55" y="256" textAnchor="middle" className="text-[9px] font-bold fill-amber-700">
                      ENDOMORFO
                    </text>
                  </g>

                  <g>
                    <rect x="226" y="244" width="76" height="18" rx="9" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1" />
                    <text x="264" y="256" textAnchor="middle" className="text-[9px] font-bold fill-blue-700">
                      ECTOMORFO
                    </text>
                  </g>

                  {/* Línea de trayectoria si hay > 1 evaluación */}
                  {somatoPoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke={brandColor || "#1A6FD4"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={somatoPoints
                        .map((pt) => `${mapSomatoX(pt.x)},${mapSomatoY(pt.y)}`)
                        .join(" ")}
                    />
                  )}

                  {/* Puntos de evaluación */}
                  {somatoPoints.map((pt, i) => {
                    const cx = mapSomatoX(pt.x);
                    const cy = mapSomatoY(pt.y);
                    const isLatest = i === somatoPoints.length - 1;
                    const isSelected =
                      (selectedSomatoIdx != null ? selectedSomatoIdx : somatoPoints.length - 1) === i;

                    return (
                      <g
                        key={pt.id || i}
                        className="cursor-pointer"
                        onClick={() => setSelectedSomatoIdx(i)}
                      >
                        {isLatest && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r="11"
                            fill={brandColor || "#1A6FD4"}
                            fillOpacity="0.18"
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 6.5 : 4.5}
                          fill={isLatest ? brandColor || "#1A6FD4" : "#94A3B8"}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        {(isSelected || isLatest) && (
                          <text
                            x={cx}
                            y={cy - 10}
                            textAnchor="middle"
                            className="text-[9px] font-bold fill-[#0B1929]"
                          >
                            {pt.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Pie de datos del punto seleccionado o estado informativo */}
              {activeSomato ? (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 flex items-center justify-between text-xs mt-2">
                  <div>
                    <p className="text-[10px] font-bold text-[#6B7A8D] uppercase">
                      Evaluación: {activeSomato.fullDate}
                    </p>
                    <p className="text-xs font-semibold text-[#0B1929] mt-0.5">
                      Coordenadas:{" "}
                      <span className="font-mono font-bold text-[var(--brand-primary)]">
                        X: {activeSomato.x.toFixed(1)} | Y: {activeSomato.y.toFixed(1)}
                      </span>
                    </p>
                  </div>
                  {somatoPoints.length > 1 && (
                    <div className="flex gap-1">
                      {somatoPoints.map((pt, idx) => (
                        <button
                          key={pt.id || idx}
                          onClick={() => setSelectedSomatoIdx(idx)}
                          title={pt.fullDate}
                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-colors ${
                            (selectedSomatoIdx ?? somatoPoints.length - 1) === idx
                              ? "bg-[#0B1929] text-white"
                              : "bg-white border border-[#E2E8F0] text-[#6B7A8D] hover:text-[#0B1929]"
                          }`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-2.5 text-center mt-2">
                  <p className="text-[11px] font-bold text-[#0B1929]">
                    Mapeo de Biotipo Corporal
                  </p>
                  <p className="text-[10px] text-[#6B7A8D] mt-0.5">
                    Calculado automáticamente con pliegues cutáneos y diámetros en el protocolo Manual (ISAK).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
