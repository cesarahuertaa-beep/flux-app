import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Footprints, Flame, MapPin, Clock, Target, Trophy, Smartphone, Check, Lock, Activity, TrendingUp } from "lucide-react";
import { normalizeSexo } from "../../lib/bodyComposition";
import {
  DEFAULT_STEP_GOAL,
  PLAY_STORE_URL,
  STEP_LEVELS,
  getStepsPlatform,
  isNativeStepsAvailable,
  nativeStepsSupported,
  nativeStepsPermission,
  nativeStepsPermissionBlocked,
  openNativeAppSettings,
  requestNativeStepsPermission,
  startNativeSteps,
  refreshNativeSteps,
  getNativeHistory,
  fetchCloudSteps,
  syncStepsToCloud,
  mergeStepHistories,
  computeStepMetrics,
  classifySteps,
  averageSteps,
  computeStreak,
  getLocalStepGoal,
  setLocalStepGoal,
  toDateKey,
  addDays,
} from "../../lib/steps";

const DAY_LABELS = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
const GOAL_CHIPS = [5000, 7500, 8000, 10000, 12000];
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("es-MX");

function StepRing({ steps, goal }) {
  const size = 188;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, steps / goal) : 0;
  const done = goal > 0 && steps >= goal;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? "#10B981" : "var(--brand-primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {done ? (
          <Trophy className="w-5 h-5 text-emerald-500 mb-0.5" />
        ) : (
          <Footprints className="w-5 h-5 text-[var(--brand-primary)] mb-0.5" />
        )}
        <div className="text-[34px] leading-none font-black text-[#0B1929] font-['Rajdhani']">{fmt(steps)}</div>
        <div className="text-[11px] font-semibold text-[#6B7A8D] mt-1">de {fmt(goal)} pasos</div>
        <div className={`text-[11px] font-extrabold mt-0.5 ${done ? "text-emerald-600" : "text-[var(--brand-primary)]"}`}>
          {Math.round(pct * 100)}%
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, unit }) {
  return (
    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-black text-[#0B1929] font-['Rajdhani'] mt-0.5">{value}</div>
      <div className="text-[10px] text-[#6B7A8D]">{unit}</div>
    </div>
  );
}

export default function Pasos({ cliente, isActive = true, ultimoPeso = null, metaPasos = null }) {
  const clienteId = cliente?.id;
  const platform = useMemo(() => getStepsPlatform(), []);
  const native = isNativeStepsAvailable();
  const supported = useMemo(() => (native ? nativeStepsSupported() : false), [native]);
  const [permission, setPermission] = useState(() => (native ? nativeStepsPermission() : false));
  const [permissionBlocked, setPermissionBlocked] = useState(() => (native ? nativeStepsPermissionBlocked() : false));
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [nativeHistory, setNativeHistory] = useState(() => (native ? getNativeHistory() : {}));
  const [cloudHistory, setCloudHistory] = useState({});
  const [requesting, setRequesting] = useState(false);
  const pollRef = useRef(null);

  const hasSpecialist = Boolean(cliente?.nutriologo_id);
  const goalLockedBySpecialist = hasSpecialist && Number(metaPasos) > 0;
  const [goal, setGoal] = useState(() => {
    if (goalLockedBySpecialist) return Number(metaPasos);
    return getLocalStepGoal(clienteId) || (Number(metaPasos) > 0 ? Number(metaPasos) : DEFAULT_STEP_GOAL);
  });

  useEffect(() => {
    if (goalLockedBySpecialist) setGoal(Number(metaPasos));
  }, [goalLockedBySpecialist, metaPasos]);

  const history = useMemo(() => mergeStepHistories(cloudHistory, nativeHistory), [cloudHistory, nativeHistory]);

  // Historial en la nube (PWA: datos sincronizados desde el teléfono; nativo: respaldo)
  useEffect(() => {
    let active = true;
    if (!clienteId) return undefined;
    fetchCloudSteps(clienteId, 42).then((h) => {
      if (active) setCloudHistory(h);
    });
    return () => {
      active = false;
    };
  }, [clienteId, isActive]);

  // Contador nativo: iniciar worker, escuchar actualizaciones y refrescar mientras la pestaña está visible
  useEffect(() => {
    if (!native || !supported || !permission) return undefined;
    startNativeSteps();
    const onUpdated = () => setNativeHistory(getNativeHistory());
    window.addEventListener("flux:steps-updated", onUpdated);
    setNativeHistory(getNativeHistory());
    return () => window.removeEventListener("flux:steps-updated", onUpdated);
  }, [native, supported, permission]);

  useEffect(() => {
    if (!native || !supported || !permission || !isActive) return undefined;
    refreshNativeSteps();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refreshNativeSteps();
    }, 30000);
    return () => clearInterval(t);
  }, [native, supported, permission, isActive]);

  // Respaldar en la nube lo registrado por el sensor
  useEffect(() => {
    if (!native || !permission || !clienteId || Object.keys(nativeHistory).length === 0) return undefined;
    const t = setTimeout(() => syncStepsToCloud(clienteId, nativeHistory), 1500);
    return () => clearTimeout(t);
  }, [native, permission, clienteId, nativeHistory]);

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), []);

  // Escuchar respuesta inmediata del diálogo de permiso nativo y re-verificación en onResume
  useEffect(() => {
    if (!native) return undefined;
    const onPermResult = (e) => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      const granted = Boolean(e?.detail?.granted);
      const permanentlyDenied = Boolean(e?.detail?.permanentlyDenied);
      setRequesting(false);
      setPermission(granted);
      setPermissionBlocked(!granted && permanentlyDenied);
      setPermissionDenied(!granted && !permanentlyDenied);
    };
    const onPermSync = (e) => {
      const granted = Boolean(e?.detail?.granted);
      const blocked = Boolean(e?.detail?.blocked);
      setPermission(granted);
      setPermissionBlocked(!granted && blocked);
      if (granted) {
        setRequesting(false);
        setPermissionDenied(false);
        setNativeHistory(getNativeHistory());
      }
    };
    window.addEventListener("flux:steps-permission-result", onPermResult);
    window.addEventListener("flux:steps-permission-sync", onPermSync);
    return () => {
      window.removeEventListener("flux:steps-permission-result", onPermResult);
      window.removeEventListener("flux:steps-permission-sync", onPermSync);
    };
  }, [native]);

  const handleRequestPermission = useCallback(() => {
    if (permissionBlocked) {
      openNativeAppSettings();
      return;
    }
    setRequesting(true);
    setPermissionDenied(false);
    requestNativeStepsPermission();
    let tries = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      tries++;
      if (nativeStepsPermission()) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setPermission(true);
        setPermissionBlocked(false);
        setRequesting(false);
      } else if (tries >= 15) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setPermissionBlocked(nativeStepsPermissionBlocked());
        setRequesting(false);
      }
    }, 1000);
  }, [permissionBlocked]);

  const handleSetGoal = (value) => {
    const v = Math.max(1000, Math.min(50000, Math.round(Number(value) || 0)));
    if (!v) return;
    setGoal(v);
    setLocalStepGoal(clienteId, v);
  };

  // ── Datos derivados ──
  const todayKey = toDateKey();
  const todaySteps = history[todayKey] || 0;
  const sexo = normalizeSexo(cliente?.genero || cliente?.sexo || "M");
  const metrics = computeStepMetrics({
    steps: todaySteps,
    pesoKg: ultimoPeso || cliente?.peso,
    estaturaCm: cliente?.estatura,
    sexo,
  });

  const week = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      out.push({ key: toDateKey(d), label: DAY_LABELS[d.getDay()], steps: history[toDateKey(d)] || 0, isToday: i === 0 });
    }
    return out;
  }, [history]);

  const weekMax = Math.max(goal, ...week.map((d) => d.steps), 1);
  const { avg: avg7, daysWithData } = averageSteps(history, 7, false);
  const avgLevel = classifySteps(avg7);
  const streak = computeStreak(history, goal);
  const daysHitGoal = week.filter((d) => d.steps >= goal).length;
  const bestDay = Object.entries(history).reduce((best, [k, v]) => (v > best.steps ? { key: k, steps: v } : best), { key: null, steps: 0 });

  const calendar = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // lunes=0
    const start = addDays(today, -(dow + 35));
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const key = toDateKey(d);
      cells.push({ key, day: d.getDate(), future: d > today, steps: history[key] || 0, isToday: key === todayKey });
    }
    return cells;
  }, [history, todayKey]);

  const hasAnyData = Object.keys(history).length > 0;
  const showTracking = native && supported && permission;

  const cellStyle = (c) => {
    if (c.future) return { background: "transparent", border: "1px dashed #E2E8F0", color: "#CBD5E1" };
    if (c.steps >= goal) return { background: "#10B981", color: "#fff" };
    if (c.steps >= goal * 0.7) return { background: "color-mix(in srgb, var(--brand-primary) 55%, white)", color: "#0B1929" };
    if (c.steps > 0) return { background: "color-mix(in srgb, var(--brand-primary) 22%, white)", color: "#0B1929" };
    return { background: "#F1F5F9", color: "#94A3B8" };
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 space-y-4 pb-28 md:pb-8">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
          <Footprints className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-[#0B1929]">Pasos y actividad diaria</h2>
          <p className="text-xs text-[#6B7A8D] leading-relaxed">
            Tu movimiento cotidiano (NEAT) suma más al gasto energético de lo que parece. Aquí lo medimos y tu especialista lo usa para afinar tu plan.
          </p>
        </div>
      </div>

      {/* Aviso PWA / navegador o iOS sin puente nativo */}
      {!native && (
        <div className="bg-white border border-[var(--brand-primary)]/25 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#0B1929]">
                {platform === "ios"
                  ? "Conteo automático de pasos próximamente en iPhone"
                  : "Contador de pasos disponible en la app móvil"}
              </p>
              <p className="text-xs text-[#6B7A8D] mt-1 leading-relaxed">
                {platform === "ios"
                  ? "Estamos preparando la integración con los sensores de movimiento de iOS. Si ya sincronizaste pasos desde otro dispositivo vinculado a tu cuenta, puedes consultar tu historial aquí."
                  : "El conteo en segundo plano utiliza el sensor de movimiento físico del teléfono. Desde el navegador puedes consultar el historial que tu app móvil haya sincronizado."}
              </p>
              {platform !== "ios" && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
                  >
                    Descargar en Google Play
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dispositivo sin sensor */}
      {native && !supported && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-2">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Este dispositivo no cuenta con sensor de pasos, por lo que no es posible medir tu actividad diaria.</span>
        </div>
      )}

      {/* Permiso requerido */}
      {native && supported && !permission && (
        <div className="bg-white border border-[var(--brand-primary)]/25 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#0B1929]">
              {permissionBlocked ? "Permiso desactivado en tu dispositivo" : "Activa el contador de pasos"}
            </p>
            <p className="text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
              {permissionBlocked
                ? `Para medir tus pasos diarios, habilita el permiso "${platform === "ios" ? "Movimiento y actividad física" : "Actividad física"}" dentro de los Ajustes de tu teléfono.`
                : `FLUX necesita permiso de "${platform === "ios" ? "Movimiento y actividad física" : "Actividad física"}" para leer el sensor de pasos. Solo guardamos el conteo diario de pasos, nunca tu ubicación GPS ni recorridos.`}
            </p>
            {permissionDenied && !permissionBlocked && (
              <p className="text-[11px] font-semibold text-amber-700 mt-1">
                Permiso no concedido. Puedes intentarlo de nuevo cuando desees activar el contador.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            disabled={requesting}
            className="px-4 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 disabled:opacity-60 transition-opacity shadow-sm cursor-pointer shrink-0"
          >
            {permissionBlocked
              ? "Abrir Ajustes"
              : requesting
              ? "Esperando respuesta..."
              : "Activar contador"}
          </button>
        </div>
      )}

      {/* Anillo + métricas del día */}
      {(showTracking || hasAnyData) && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
            <StepRing steps={todaySteps} goal={goal} />
            <div className="flex-1 w-full space-y-3">
              {showTracking && todaySteps === 0 && (
                <div className="text-[11px] text-[#6B7A8D] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
                  Sensor activo: tu conteo diario se registra a partir de este momento y avanzará al caminar.
                </div>
              )}
              <div className="grid grid-cols-3 gap-2.5">
                <StatTile icon={<MapPin className="w-3 h-3" />} label="Distancia" value={metrics.km} unit="km" />
                <StatTile icon={<Flame className="w-3 h-3" />} label="Activas" value={fmt(metrics.kcal)} unit="kcal" />
                <StatTile icon={<Clock className="w-3 h-3" />} label="Tiempo" value={metrics.minutes} unit="min activos" />
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1929]">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  Racha: {streak} {streak === 1 ? "día" : "días"} cumpliendo tu meta
                </span>
                {goalLockedBySpecialist ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B7A8D]">
                    <Target className="w-3 h-3" /> Meta fijada por tu especialista
                  </span>
                ) : null}
              </div>
              {!goalLockedBySpecialist && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] mb-1.5">Meta diaria de pasos</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {GOAL_CHIPS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleSetGoal(g)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          goal === g
                            ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                            : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:border-[var(--brand-primary)]/50"
                        }`}
                      >
                        {fmt(g)}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1000"
                      max="50000"
                      step="500"
                      defaultValue={goal}
                      key={goal}
                      onBlur={(e) => handleSetGoal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className="w-20 px-2 py-1 rounded-lg border border-[#E2E8F0] bg-white text-[11px] font-bold text-center text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                      aria-label="Meta personalizada de pasos"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gráfica semanal */}
      {(showTracking || hasAnyData) && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
            <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> Últimos 7 días
            </h3>
            <span className="text-[11px] font-semibold text-[#6B7A8D]">
              {daysHitGoal}/7 días con meta cumplida
            </span>
          </div>
          <div className="relative h-36">
            <div
              className="absolute left-0 right-0 border-t border-dashed border-emerald-400/70"
              style={{ bottom: `${(goal / weekMax) * 100}%` }}
            >
              <span className="absolute -top-4 right-0 text-[9px] font-bold text-emerald-600 bg-white px-1">Meta {fmt(goal)}</span>
            </div>
            <div className="absolute inset-0 flex items-end justify-between gap-2">
              {week.map((d) => {
                const h = Math.max(d.steps > 0 ? 4 : 0, (d.steps / weekMax) * 100);
                const hit = d.steps >= goal;
                return (
                  <div key={d.key} className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0">
                    <span className="text-[9px] font-bold text-[#6B7A8D]">{d.steps > 0 ? fmt(d.steps) : ""}</span>
                    <div
                      className="w-full max-w-[34px] rounded-t-lg transition-all"
                      style={{
                        height: `${h}%`,
                        background: hit ? "#10B981" : "var(--brand-primary)",
                        opacity: d.isToday ? 1 : 0.75,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between gap-2 mt-1.5">
            {week.map((d) => (
              <div
                key={d.key}
                className={`flex-1 text-center text-[10px] font-bold ${d.isToday ? "text-[var(--brand-primary)]" : "text-[#94A3B8]"}`}
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen NEAT */}
      {hasAnyData && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> Tu nivel de actividad (NEAT)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatTile icon={null} label="Promedio 7 días" value={avg7 > 0 ? fmt(avg7) : "—"} unit="pasos/día" />
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">Nivel</div>
              <span
                className="mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white"
                style={{ background: avg7 > 0 ? avgLevel.color : "#CBD5E1" }}
              >
                {avg7 > 0 ? avgLevel.label : "Sin datos"}
              </span>
            </div>
            <StatTile icon={null} label="Mejor día" value={bestDay.steps > 0 ? fmt(bestDay.steps) : "—"} unit="pasos" />
            <StatTile icon={null} label="Días medidos" value={daysWithData} unit="de los últimos 7" />
          </div>
          <div className="grid grid-cols-5 gap-1">
            {STEP_LEVELS.map((l) => (
              <div key={l.id} className="text-center">
                <div className="h-1.5 rounded-full" style={{ background: l.color, opacity: avg7 > 0 && avgLevel.id === l.id ? 1 : 0.35 }} />
                <div className="text-[9px] font-bold text-[#6B7A8D] mt-1 leading-tight">{l.label}</div>
                <div className="text-[9px] text-[#94A3B8] leading-tight">{l.short}</div>
              </div>
            ))}
          </div>
          {hasSpecialist && (
            <p className="text-[11px] text-[#6B7A8D] leading-relaxed">
              Tu especialista consulta este promedio al evaluar tu gasto energético para ajustar tus calorías de forma más precisa.
            </p>
          )}
        </div>
      )}

      {/* Calendario de constancia */}
      {(showTracking || hasAnyData) && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">Constancia (6 semanas)</h3>
            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-[#6B7A8D]">
              <span className="w-2.5 h-2.5 rounded bg-[#F1F5F9] border border-[#E2E8F0]" /> Sin datos
              <span className="w-2.5 h-2.5 rounded" style={{ background: "color-mix(in srgb, var(--brand-primary) 22%, white)" }} /> Parcial
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Meta
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {["L", "M", "M", "J", "V", "S", "D"].map((l, i) => (
              <div key={i} className="text-center text-[9px] font-bold text-[#94A3B8]">{l}</div>
            ))}
            {calendar.map((c) => (
              <div
                key={c.key}
                title={`${c.key}: ${fmt(c.steps)} pasos`}
                className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold ${c.isToday ? "ring-2 ring-[var(--brand-primary)] ring-offset-1" : ""}`}
                style={cellStyle(c)}
              >
                {c.steps >= goal && !c.future ? <Check className="w-3 h-3" /> : c.day}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
