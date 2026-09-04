import { useState } from "react";
import { Smartphone, Bluetooth, Bell, CheckCircle, Footprints, Zap, MapPin } from "lucide-react";

const DAYS_STEPS = [
  { day: "Lun", steps: 7200, goal: 10000 },
  { day: "Mar", steps: 9450, goal: 10000 },
  { day: "Mié", steps: 11300, goal: 10000 },
  { day: "Jue", steps: 6800, goal: 10000 },
  { day: "Vie", steps: 10200, goal: 10000 },
  { day: "Sáb", steps: 13100, goal: 10000 },
  { day: "Dom", steps: 4300, goal: 10000 },
];

const today = 8740;
const goal = 10000;
const pct = Math.min((today / goal) * 100, 100);
const circumference = 2 * Math.PI * 72;
const offset = circumference - (pct / 100) * circumference;

export default function Steps() {
  const [connected, setConnected] = useState(false);
  const [notifs, setNotifs] = useState(false);

  const kcalBurned = Math.round(today * 0.04);
  const km = (today * 0.00078).toFixed(2);

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-8 pb-6">
        <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">Actividad Diaria</p>
        <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: 'DM Sans' }}>Contador de Pasos</h1>
        <p className="text-sm text-[#6B7A8D] mt-1">Hoy — <span className="text-[#1A6FD4] font-medium">Jueves 3 Sept 2026</span></p>
      </div>

      <div className="px-8 flex-1 overflow-y-auto pb-8 space-y-5">
        {/* Main ring */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 flex items-center gap-10">
          <div className="relative flex-shrink-0">
            <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
              <circle cx="90" cy="90" r="72" fill="none" stroke="#E8F1FB" strokeWidth="14" />
              <circle
                cx="90" cy="90" r="72" fill="none"
                stroke="#1A6FD4" strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Footprints size={20} className="text-[#1A6FD4] mb-1" />
              <span className="text-3xl font-bold font-mono text-[#0B1929]">{today.toLocaleString()}</span>
              <span className="text-xs text-[#6B7A8D]">de {goal.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs font-mono text-[#6B7A8D] uppercase tracking-widest mb-1">Progreso</p>
              <div className="h-2 bg-[#E8F1FB] rounded-full overflow-hidden">
                <div className="h-full bg-[#1A6FD4] rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-[#6B7A8D] mt-1">{pct.toFixed(0)}% del objetivo</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F7F9FC] rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Zap size={12} className="text-orange-400" />
                  <span className="text-xs text-[#6B7A8D] font-mono">CALORÍAS</span>
                </div>
                <p className="text-xl font-bold font-mono text-[#0B1929]">{kcalBurned}</p>
                <p className="text-xs text-[#6B7A8D]">kcal quemadas</p>
              </div>
              <div className="bg-[#F7F9FC] rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <MapPin size={12} className="text-[#1A6FD4]" />
                  <span className="text-xs text-[#6B7A8D] font-mono">DISTANCIA</span>
                </div>
                <p className="text-xl font-bold font-mono text-[#0B1929]">{km}</p>
                <p className="text-xs text-[#6B7A8D]">kilómetros</p>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly bars */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <p className="text-sm font-semibold text-[#0B1929] mb-4">Esta semana</p>
          <div className="flex items-end gap-2 h-28">
            {DAYS_STEPS.map((d, i) => {
              const h = Math.round((d.steps / 14000) * 100);
              const isToday = i === 3;
              const aboveGoal = d.steps >= d.goal;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono text-[#6B7A8D]">{(d.steps / 1000).toFixed(1)}k</span>
                  <div className="w-full relative" style={{ height: "80px" }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t-md transition-all ${
                        isToday ? "bg-[#1A6FD4]" : aboveGoal ? "bg-[#38BDF8]" : "bg-[#E8F1FB]"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                    {aboveGoal && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full" />
                    )}
                  </div>
                  <span className={`text-xs font-mono ${isToday ? "text-[#1A6FD4] font-bold" : "text-[#6B7A8D]"}`}>{d.day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#1A6FD4]" /><span className="text-xs text-[#6B7A8D]">Hoy</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#38BDF8]" /><span className="text-xs text-[#6B7A8D]">Meta cumplida</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#E8F1FB]" /></div>
          </div>
        </div>

        {/* Widget connection */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <p className="text-sm font-semibold text-[#0B1929] mb-1">Vincular dispositivo</p>
          <p className="text-xs text-[#6B7A8D] mb-4">Conecta tu teléfono o smartwatch para sincronizar pasos automáticamente</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#F7F9FC] border border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8F1FB] flex items-center justify-center">
                  <Smartphone size={18} className="text-[#1A6FD4]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0B1929]">Widget para iPhone / Android</p>
                  <p className="text-xs text-[#6B7A8D]">Sincroniza con Apple Health o Google Fit</p>
                </div>
              </div>
              <button
                onClick={() => setConnected(!connected)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  connected ? "bg-green-50 text-green-600 border border-green-200" : "bg-[#1A6FD4] text-white hover:bg-blue-600"
                }`}
              >
                {connected ? <><CheckCircle size={14} /> Conectado</> : <><Bluetooth size={14} /> Vincular</>}
              </button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#F7F9FC] border border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8F1FB] flex items-center justify-center">
                  <Bell size={18} className="text-[#1A6FD4]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0B1929]">Notificaciones de meta</p>
                  <p className="text-xs text-[#6B7A8D]">Recibe un aviso al llegar a tu objetivo diario</p>
                </div>
              </div>
              <button
                onClick={() => setNotifs(!notifs)}
                className={`relative w-12 h-6 rounded-full transition-colors ${notifs ? "bg-[#1A6FD4]" : "bg-[#E2E8F0]"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${notifs ? "left-7" : "left-1"}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
