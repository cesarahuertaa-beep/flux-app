import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Footprints, Flame, MapPin, Clock, Target, Trophy, Smartphone, Check, Lock, Activity, TrendingUp, Zap } from "lucide-react";
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
  nativeStepsBatteryUnrestricted,
  requestNativeBatteryUnrestricted,
  openNativeAppSettings,
  requestNativeStepsPermission,
  startNativeSteps,
  refreshNativeSteps,
  setNativeStepsOwner,
  mergeNativeCloudHistory,
  getNativeHistory,
  getNativeEstimatedDays,
  getLocalStepGoal,
  setLocalStepGoal,
  fetchCloudSteps,
  syncStepsToCloud,
  mergeStepHistories,
  computeStepMetrics,
  classifySteps,
  averageSteps,
  computeStreak,
  toDateKey,
  addDays,
} from "../../lib/steps";

const DAY_LABELS = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
const GOAL_PRESETS = [6000, 8000, 10000, 12000];
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
    <div className="px-2 py-1 sm:bg-[#F8FAFC] sm:border sm:border-[#E2E8F0] sm:rounded-xl sm:p-3 text-center">
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
  const [batteryUnrestricted, setBatteryUnrestricted] = useState(() =>
    native ? nativeStepsBatteryUnrestricted() : true
  );
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [nativeHistory, setNativeHistory] = useState(() => {
    if (!native) return {};
    if (clienteId) setNativeStepsOwner(clienteId);
    return getNativeHistory();
  });
  const [estimatedDays, setEstimatedDays] = useState(() => (native ? getNativeEstimatedDays() : {}));
  const [cloudHistory, setCloudHistory] = useState({});
  const [localGoal, setLocalGoal] = useState(() => getLocalStepGoal(clienteId));
  const [requesting, setRequesting] = useState(false);
  const pollRef = useRef(null);

  const hasSpecialist = Boolean(cliente?.nutriologo_id);
  const specialistGoal = Number(metaPasos) > 0 ? Number(metaPasos) : null;
  const goal = specialistGoal || (Number(localGoal) > 0 ? Number(localGoal) : DEFAULT_STEP_GOAL);

  const handleSelectLocalGoal = useCallback(
    (nextGoal) => {
      const clean = Math.max(1000, Math.min(50000, Math.round(Number(nextGoal) || DEFAULT_STEP_GOAL)));
      setLocalGoal(clean);
      if (clienteId) setLocalStepGoal(clienteId, clean);
    },
    [clienteId]
  );

  const history = useMemo(() => mergeStepHistories(cloudHistory, nativeHistory), [cloudHistory, nativeHistory]);

  // Asegurar que el puente nativo tenga asignado el cliente activo (paciente, civil o perfil atleta de especialista)
  useEffect(() => {
    if (!native || !clienteId) return;
    setNativeStepsOwner(clienteId);
  }, [native, clienteId]);

  // Historial en la nube (PWA: datos sincronizados desde el teléfono; nativo: respaldo y piso mínimo)
  useEffect(() => {
    let active = true;
    if (!clienteId) return undefined;
    fetchCloudSteps(clienteId, 42, { force: isActive }).then((h) => {
      if (!active) return;
      setCloudHistory(h);
      const savedGoal = getLocalStepGoal(clienteId);
      if (savedGoal) setLocalGoal(savedGoal);
      if (native && h && Object.keys(h).length > 0) {
        mergeNativeCloudHistory(clienteId, h);
        setNativeHistory(getNativeHistory());
        setEstimatedDays(getNativeEstimatedDays());
      }
    });
    return () => {
      active = false;
    };
  }, [clienteId, isActive, native]);

  // Contador nativo: programar worker + alarma nocturna y escuchar actualizaciones del sensor
  useEffect(() => {
    if (!native || !supported || !permission) return undefined;
    startNativeSteps();
    const onUpdated = () => {
      setNativeHistory(getNativeHistory());
      setEstimatedDays(getNativeEstimatedDays());
    };
    window.addEventListener("flux:steps-updated", onUpdated);
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

  // Respaldar en la nube lo registrado por el sensor sin sobrescribir conteos mayores de la nube
  useEffect(() => {
    if (!native || !permission || !clienteId || Object.keys(nativeHistory).length === 0) return undefined;
    const t = setTimeout(() => syncStepsToCloud(clienteId, nativeHistory, cloudHistory), 1500);
    return () => clearTimeout(t);
  }, [native, permission, clienteId, nativeHistory, cloudHistory]);

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
      setBatteryUnrestricted(nativeStepsBatteryUnrestricted());
    };
    const onPermSync = (e) => {
      const granted = Boolean(e?.detail?.granted);
      const blocked = Boolean(e?.detail?.blocked);
      if (typeof e?.detail?.batteryUnrestricted === "boolean") {
        setBatteryUnrestricted(e.detail.batteryUnrestricted);
      } else {
        setBatteryUnrestricted(nativeStepsBatteryUnrestricted());
      }
      setRequesting(false);
      setPermission(granted);
      setPermissionBlocked(!granted && blocked);
      if (granted) {
        setPermissionDenied(false);
        setNativeHistory(getNativeHistory());
        setEstimatedDays(getNativeEstimatedDays());
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
    const baseDate = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = addDays(baseDate, -i);
      const key = toDateKey(d);
      out.push({
        key,
        label: DAY_LABELS[d.getDay()],
        steps: history[key] || 0,
        isToday: key === todayKey,
        isEstimated: Boolean(estimatedDays[key]),
      });
    }
    return out;
  }, [history, todayKey, estimatedDays]);

  const hasEstimatedInWeek = week.some((d) => d.isEstimated && d.steps > 0);
  const weekMax = Math.max(goal, ...week.map((d) => d.steps), 1);

  // Si aún no hay días previos cerrados pero hoy ya registró pasos, incluir hoy para no mostrar "Sin datos" el día 1
  const closedStats = averageSteps(history, 7, false);
  const { avg: avg7, daysWithData } =
    closedStats.daysWithData > 0 ? closedStats : averageSteps(history, 7, true);
  const avgLevel = classifySteps(avg7);
  const streak = computeStreak(history, goal);
  const daysHitGoal = week.filter((d) => d.steps >= goal).length;
  const bestDay = Object.entries(history).reduce(
    (best, [k, v]) => (v > best.steps ? { key: k, steps: v } : best),
    { key: null, steps: 0 }
  );

  const calendar = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // lunes=0
    const start = addDays(today, -(dow + 35));
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const key = toDateKey(d);
      cells.push({
        key,
        day: d.getDate(),
        future: key > todayKey,
        steps: history[key] || 0,
        isToday: key === todayKey,
      });
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
    <div className="flex-1 flex flex-col bg-[#F7F9FC] min-h-full">
      {/* ── Header Estándar FLUX (Escritorio con subtítulo + Móvil compacto) ── */}
      <div className="px-4 sm:px-6 md:px-8 py-3 md:pt-8 md:pb-6 bg-white border-b border-[#F0F4FA] shrink-0">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="hidden md:block text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1 whitespace-nowrap">
              Actividad Diaria • NEAT
            </p>
            <h1 className="text-lg md:text-2xl font-bold text-[#0B1929] whitespace-nowrap" style={{ fontFamily: "DM Sans" }}>
              Pasos y Actividad
            </h1>
            <p className="hidden md:block text-sm text-[#6B7A8D] mt-1">
              {hasSpecialist && specialistGoal
                ? `Meta diaria sugerida por tu especialista: ${fmt(goal)} pasos · Cualquier paso extra sigue sumando`
                : `Meta diaria sugerida: ${fmt(goal)} pasos · Tu movimiento cotidiano suma a tu gasto energético`}
            </p>
          </div>

          {(showTracking || hasAnyData) && (
            <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 shrink-0">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0" />
              <div className="text-right sm:text-left">
                <p className="text-[9px] sm:text-[10px] text-[#9A3412] font-mono font-semibold uppercase tracking-wider leading-none">
                  Racha Activa
                </p>
                <p className="text-sm sm:text-lg font-bold text-[#C2410C] font-mono leading-none mt-0.5 whitespace-nowrap">
                  {streak} <span className="text-[10px] sm:text-xs font-sans font-semibold">{streak === 1 ? "día" : "días"}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Contenido Principal (Sin huecos ni bordes dobles en móvil, tarjetas espaciadas en escritorio) ── */}
      <div className="px-0 md:px-8 py-0 md:py-6 pb-28 md:pb-8 max-w-5xl w-full mx-auto space-y-0 md:space-y-4">
        {/* Aviso PWA / navegador o iOS sin puente nativo */}
        {!native && (
          <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] md:border-[var(--brand-primary)]/25 px-4 py-4 sm:p-5 shadow-none md:shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-[#0B1929]">
                  {platform === "ios"
                    ? "Conteo automático de pasos próximamente en iPhone"
                    : "Contador de pasos disponible en la app móvil"}
                </p>
                <p className="text-xs text-[#6B7A8D] mt-0.5 leading-relaxed">
                  {platform === "ios"
                    ? "Estamos preparando la integración con los sensores de movimiento de iOS. Si ya sincronizaste pasos desde otro dispositivo vinculado a tu cuenta, puedes consultar tu historial aquí."
                    : "El conteo en segundo plano utiliza el sensor de movimiento físico del teléfono. Desde el navegador puedes consultar el historial que tu app móvil haya sincronizado."}
                </p>
                {platform !== "ios" && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    <a
                      href={PLAY_STORE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-xs"
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
          <div className="bg-amber-50 rounded-none md:rounded-2xl border-b md:border border-amber-200 px-4 py-3.5 text-xs text-amber-900 flex items-start gap-2">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Este dispositivo no cuenta con sensor de pasos, por lo que no es posible medir tu actividad diaria.</span>
          </div>
        )}

        {/* Permiso requerido */}
        {native && supported && !permission && (
          <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] md:border-[var(--brand-primary)]/25 px-4 py-4 sm:p-5 shadow-none md:shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-[#0B1929]">
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
              className="px-4 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 disabled:opacity-60 transition-opacity shadow-xs cursor-pointer shrink-0"
            >
              {permissionBlocked
                ? "Abrir Ajustes"
                : requesting
                ? "Esperando respuesta..."
                : "Activar contador"}
            </button>
          </div>
        )}

        {/* Aviso de batería sin restricciones para conteo pasivo 24/7 sin abrir la app */}
        {showTracking && !batteryUnrestricted && (
          <div className="bg-amber-50/80 rounded-none md:rounded-2xl border-b md:border border-amber-200/80 px-4 py-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0B1929]">
                  Conteo pasivo sin interrupciones
                </p>
                <p className="text-[11px] text-[#6B7A8D] mt-0.5 leading-relaxed">
                  Para que Android registre y cierre tus pasos a medianoche incluso los días que no abras FLUX, permite la ejecución en segundo plano sin ahorro de batería.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => requestNativeBatteryUnrestricted()}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Permitir en segundo plano
            </button>
          </div>
        )}

        {/* Anillo + métricas del día */}
        {(showTracking || hasAnyData) && (
          <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] px-4 py-4 sm:p-6 shadow-none md:shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
              <StepRing steps={todaySteps} goal={goal} />
              <div className="flex-1 w-full space-y-3">
                {showTracking && todaySteps === 0 && (
                  <p className="text-[11px] text-[#6B7A8D] text-center sm:text-left">
                    Sensor activo: tu conteo diario avanzará automáticamente al caminar.
                  </p>
                )}
                <div className="grid grid-cols-3 divide-x divide-[#E2E8F0] sm:divide-x-0 sm:gap-2.5 pt-1 sm:pt-0">
                  <StatTile icon={<MapPin className="w-3 h-3" />} label="Distancia" value={metrics.km} unit="km" />
                  <StatTile icon={<Flame className="w-3 h-3" />} label="Activas" value={fmt(metrics.kcal)} unit="kcal" />
                  <StatTile icon={<Clock className="w-3 h-3" />} label="Tiempo" value={metrics.minutes} unit="min activos" />
                </div>
                <div className="pt-2 border-t border-[#F0F4FA] flex flex-wrap items-center justify-center sm:justify-between gap-2 text-[11px] font-semibold text-[#6B7A8D]">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                    <span>
                      {hasSpecialist && specialistGoal
                        ? `Meta diaria sugerida por tu especialista: ${fmt(goal)} pasos`
                        : `Meta diaria personal: ${fmt(goal)} pasos`}
                    </span>
                  </div>
                  {!specialistGoal && (
                    <div className="flex items-center gap-1">
                      {GOAL_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSelectLocalGoal(preset)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                            goal === preset
                              ? "bg-[var(--brand-primary)] text-white"
                              : "bg-[#F0F4FA] text-[#6B7A8D] hover:text-[#0B1929]"
                          }`}
                        >
                          {preset / 1000}k
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gráfica semanal */}
        {(showTracking || hasAnyData) && (
          <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] px-4 py-4 sm:p-5 shadow-none md:shadow-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> Últimos 7 días
              </h3>
              <span className="text-[11px] font-semibold text-[#6B7A8D]">
                {daysHitGoal}/7 días con meta cumplida
              </span>
            </div>

            {/* Fila superior: etiquetas de conteo separadas del área proporcional de barras */}
            <div className="flex justify-between gap-2 mb-1 h-4 items-end">
              {week.map((d) => (
                <div key={d.key} className="flex-1 text-center text-[9px] font-bold text-[#6B7A8D] truncate">
                  {d.steps > 0 ? `${d.isEstimated ? "~" : ""}${fmt(d.steps)}` : ""}
                </div>
              ))}
            </div>

            {/* Área proporcional 0..weekMax donde barra 100% coincide exacto con la línea de Meta */}
            <div className="relative h-32">
              <div
                className="absolute left-0 right-0 border-t border-dashed border-emerald-400/70 z-10 pointer-events-none"
                style={{ bottom: `${Math.min(100, (goal / weekMax) * 100)}%` }}
              >
                <span className="absolute -top-3.5 right-0 text-[9px] font-bold text-emerald-600 bg-white/90 px-1 rounded">
                  Meta {fmt(goal)}
                </span>
              </div>
              <div className="absolute inset-0 flex items-end justify-between gap-2">
                {week.map((d) => {
                  const h = Math.min(100, Math.max(d.steps > 0 ? 4 : 0, (d.steps / weekMax) * 100));
                  const hit = d.steps >= goal;
                  return (
                    <div key={d.key} className="flex-1 h-full flex items-end justify-center min-w-0">
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

            {hasEstimatedInWeek && (
              <p className="text-[10px] text-[#6B7A8D] mt-2">
                ~ Días con reparto nocturno estimado cuando el teléfono estuvo en ahorro profundo de batería.
              </p>
            )}
          </div>
        )}

        {/* Resumen NEAT */}
        {hasAnyData && (
          <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] px-4 py-4 sm:p-5 shadow-none md:shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> Tu nivel de actividad (NEAT)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2.5">
              <StatTile icon={null} label="Promedio 7 días" value={avg7 > 0 ? fmt(avg7) : "—"} unit="pasos/día" />
              <div className="px-2 py-1 sm:bg-[#F8FAFC] sm:border sm:border-[#E2E8F0] sm:rounded-xl sm:p-3 text-center flex flex-col items-center justify-center">
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
            <div className="grid grid-cols-5 gap-1 pt-1">
              {STEP_LEVELS.map((l) => (
                <div key={l.id} className="text-center">
                  <div className="h-1.5 rounded-full" style={{ background: l.color, opacity: avg7 > 0 && avgLevel.id === l.id ? 1 : 0.35 }} />
                  <div className="text-[9px] font-bold text-[#6B7A8D] mt-1 leading-tight">{l.label}</div>
                  <div className="text-[9px] text-[#94A3B8] leading-tight">{l.short}</div>
                </div>
              ))}
            </div>
            {hasSpecialist && (
              <p className="hidden md:block text-[11px] text-[#6B7A8D] leading-relaxed">
                Tu especialista consulta este promedio al evaluar tu gasto energético para ajustar tus calorías de forma más precisa.
              </p>
            )}
          </div>
        )}

        {/* Calendario de constancia */}
        {(showTracking || hasAnyData) && (
          <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] px-4 py-4 sm:p-5 shadow-none md:shadow-sm">
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
    </div>
  );
}
