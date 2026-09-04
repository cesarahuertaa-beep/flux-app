import { useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

const weightData = [
  { week: "Jul W1", peso: 82.4 }, { week: "Jul W2", peso: 81.8 }, { week: "Jul W3", peso: 81.1 },
  { week: "Jul W4", peso: 80.6 }, { week: "Ago W1", peso: 80.0 }, { week: "Ago W2", peso: 79.5 },
  { week: "Ago W3", peso: 79.1 }, { week: "Ago W4", peso: 78.8 }, { week: "Sep W1", peso: 78.3 },
];

const fatData = [
  { week: "Jul W1", grasa: 24.2 }, { week: "Jul W2", grasa: 23.8 }, { week: "Jul W3", grasa: 23.4 },
  { week: "Jul W4", grasa: 23.1 }, { week: "Ago W1", grasa: 22.8 }, { week: "Ago W2", grasa: 22.5 },
  { week: "Ago W3", grasa: 22.2 }, { week: "Ago W4", grasa: 21.9 }, { week: "Sep W1", grasa: 21.6 },
];

const stepsData = [
  { day: "Lun", steps: 7200 }, { day: "Mar", steps: 9450 }, { day: "Mié", steps: 11300 },
  { day: "Jue", steps: 8740 }, { day: "Vie", steps: 10200 }, { day: "Sáb", steps: 13100 }, { day: "Dom", steps: 4300 },
];

const radarData = [
  { metric: "Fuerza", value: 72 },
  { metric: "Cardio", value: 65 },
  { metric: "Nutrición", value: 88 },
  { metric: "Descanso", value: 70 },
  { metric: "Hidratación", value: 80 },
  { metric: "Pasos", value: 76 },
];

const tabs = ["Peso", "Grasa", "Pasos", "Radar"];

type Metric = { label: string; value: string; unit: string; delta: string; up: boolean; color: string };
const metrics: Metric[] = [
  { label: "Peso", value: "78.3", unit: "kg", delta: "−4.1 kg", up: false, color: "#1A6FD4" },
  { label: "Grasa corporal", value: "21.6", unit: "%", delta: "−2.6%", up: false, color: "#38BDF8" },
  { label: "Masa muscular", value: "34.2", unit: "kg", delta: "+1.8 kg", up: true, color: "#10B981" },
  { label: "IMC", value: "24.1", unit: "", delta: "−1.3", up: false, color: "#6366F1" },
  { label: "Agua corporal", value: "62.4", unit: "%", delta: "+1.2%", up: true, color: "#0EA5E9" },
  { label: "Masa ósea", value: "3.1", unit: "kg", delta: "—", up: true, color: "#8B5CF6" },
];

function BodyFigure() {
  return (
    <div className="relative w-full flex justify-center items-center py-4">
      <svg viewBox="0 0 200 400" width="160" className="drop-shadow-sm">
        {/* Body outline */}
        <ellipse cx="100" cy="42" rx="22" ry="24" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.5" />
        <rect x="78" y="63" width="44" height="58" rx="10" fill="#BFDBFE" stroke="#93C5FD" strokeWidth="1.5" />
        <path d="M78 68 Q58 80 54 130 L72 132 Q76 100 82 90 L82 120 H118 L118 90 Q124 100 128 132 L146 130 Q142 80 122 68Z" fill="#BFDBFE" stroke="#93C5FD" strokeWidth="1.5" />
        <path d="M82 120 Q80 170 82 220 L96 218 L96 165 L104 165 L104 218 L118 220 Q120 170 118 120Z" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.5" />
        <path d="M82 220 Q78 280 80 330 L90 330 L92 270 L92 220Z" fill="#BFDBFE" stroke="#93C5FD" strokeWidth="1.5" />
        <path d="M118 220 Q122 280 120 330 L110 330 L108 270 L108 220Z" fill="#BFDBFE" stroke="#93C5FD" strokeWidth="1.5" />

        {/* Metric dots */}
        <circle cx="100" cy="42" r="5" fill="#1A6FD4" opacity="0.8" />
        <circle cx="100" cy="90" r="5" fill="#38BDF8" opacity="0.8" />
        <circle cx="100" cy="140" r="5" fill="#10B981" opacity="0.8" />
        <circle cx="100" cy="185" r="5" fill="#6366F1" opacity="0.8" />
      </svg>

      {/* Labels left */}
      <div className="absolute left-0 top-8 space-y-8">
        {[
          { label: "Peso", value: "78.3 kg", color: "#1A6FD4", y: "8px" },
          { label: "Grasa", value: "21.6%", color: "#38BDF8", y: "68px" },
        ].map((m) => (
          <div key={m.label} className="text-right">
            <p className="text-[10px] font-mono text-[#6B7A8D] uppercase tracking-widest">{m.label}</p>
            <p className="text-sm font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Labels right */}
      <div className="absolute right-0 top-8 space-y-8">
        {[
          { label: "Músculo", value: "34.2 kg", color: "#10B981" },
          { label: "IMC", value: "24.1", color: "#6366F1" },
        ].map((m) => (
          <div key={m.label}>
            <p className="text-[10px] font-mono text-[#6B7A8D] uppercase tracking-widest">{m.label}</p>
            <p className="text-sm font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { fontFamily: "JetBrains Mono", fontSize: 11, border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  labelStyle: { color: "#6B7A8D" },
};

export default function Statistics() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-8 pb-6">
        <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">Análisis de Progreso</p>
        <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: 'DM Sans' }}>Estadísticas</h1>
        <p className="text-sm text-[#6B7A8D] mt-1">Paciente: <span className="text-[#1A6FD4] font-medium">Carlos Mendoza</span> · Iniciado: 1 Jul 2026</p>
      </div>

      <div className="px-8 flex-1 overflow-y-auto pb-8 space-y-5">
        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-2">{m.label}</p>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold font-mono" style={{ color: m.color }}>{m.value}</span>
                {m.unit && <span className="text-xs text-[#6B7A8D] mb-1">{m.unit}</span>}
              </div>
              <span className={`text-xs font-mono ${m.up ? "text-green-500" : m.delta === "—" ? "text-[#6B7A8D]" : "text-red-400"}`}>{m.delta}</span>
            </div>
          ))}
        </div>

        {/* Body figure */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <p className="text-sm font-semibold text-[#0B1929] mb-2">Composición corporal</p>
          <BodyFigure />
        </div>

        {/* Chart tabs */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="flex gap-1 mb-5 bg-[#F7F9FC] rounded-lg p-1">
            {tabs.map((t, i) => (
              <button
                key={t}
                onClick={() => setActiveTab(i)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${activeTab === i ? "bg-white text-[#1A6FD4] shadow-sm" : "text-[#6B7A8D] hover:text-[#0B1929]"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTab === 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} interval={1} />
                <YAxis domain={[76, 84]} tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} kg`, "Peso"]} />
                <Line type="monotone" dataKey="peso" stroke="#1A6FD4" strokeWidth={2.5} dot={{ fill: "#1A6FD4", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {activeTab === 1 && (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={fatData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} interval={1} />
                <YAxis domain={[19, 26]} tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, "Grasa"]} />
                <Line type="monotone" dataKey="grasa" stroke="#38BDF8" strokeWidth={2.5} dot={{ fill: "#38BDF8", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {activeTab === 2 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stepsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <YAxis tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <Tooltip {...tooltipStyle} formatter={(v) => [Number(v).toLocaleString(), "Pasos"]} />
                <Bar dataKey="steps" fill="#1A6FD4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeTab === 3 && (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E8F1FB" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <Radar dataKey="value" stroke="#1A6FD4" fill="#1A6FD4" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
