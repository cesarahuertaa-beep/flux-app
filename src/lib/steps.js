// Contador de pasos y NEAT de FLUX.
// Nativo (Android/iOS vía WebView): lee el sensor de hardware a través de window.FluxStepsNative.
// PWA/navegador: sin acceso a sensores en segundo plano → solo muestra datos sincronizados desde la app móvil.

import { Capacitor } from "@capacitor/core";
import { dbGet, dbGetFresh, dbUpsert } from "./supabase";
import { ACTIVITY_FACTORS } from "./bodyComposition";

export const DEFAULT_STEP_GOAL = 8000;
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.fluxsport.app";

export function getStepsPlatform() {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}

const nativeBridge = () => (typeof window !== "undefined" ? window.FluxStepsNative || null : null);

export const isNativeStepsAvailable = () => Boolean(nativeBridge());

const safe = (fn, fallback) => {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
};

export const nativeStepsSupported = () => safe(() => nativeBridge().isSupported(), false);
export const nativeStepsPermission = () => safe(() => nativeBridge().hasPermission(), false);
export const nativeStepsPermissionBlocked = () => safe(() => nativeBridge().isPermissionBlocked(), false);
export const nativeStepsBatteryUnrestricted = () =>
  safe(() => nativeBridge().isIgnoringBatteryOptimizations?.() ?? true, true);
export const requestNativeBatteryUnrestricted = () =>
  safe(() => nativeBridge().requestIgnoreBatteryOptimizations?.(), null);
export const openNativeAppSettings = () => safe(() => nativeBridge().openAppSettings(), null);
export const requestNativeStepsPermission = () => safe(() => nativeBridge().requestPermission(), null);
export const startNativeSteps = () => safe(() => nativeBridge().start(), null);
/** Solicita una lectura al sensor (asíncrona); al terminar la app emite el evento 'flux:steps-updated'. */
export const refreshNativeSteps = () => safe(() => nativeBridge().refresh(), null);

/**
 * Declara en el puente nativo a qué cliente pertenecen los pasos (paciente, civil o perfil atleta
 * personal del profesional) para aislar historiales entre cuentas y habilitar el sync pasivo.
 */
export const setNativeStepsOwner = (clienteId) => {
  if (!clienteId) return null;
  return safe(() => nativeBridge()?.setOwnerClient?.(String(clienteId)), null);
};

/**
 * Sincroniza el historial de Supabase hacia el almacenamiento nativo como piso mínimo, evitando
 * que una reinstalación o cambio de teléfono sobrescriba con un número menor lo ya guardado en la nube.
 */
export const mergeNativeCloudHistory = (clienteId, cloudHistory) => {
  if (!clienteId || !cloudHistory || typeof cloudHistory !== "object") return null;
  if (Object.keys(cloudHistory).length === 0) return null;
  return safe(() => nativeBridge()?.mergeCloudHistory?.(String(clienteId), JSON.stringify(cloudHistory)), null);
};

export function getNativeHistory() {
  const raw = safe(() => nativeBridge().getHistoryJson(), "{}");
  try {
    const obj = JSON.parse(raw);
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      out[k] = Math.max(0, Math.round(Number(v) || 0));
    });
    return out;
  } catch {
    return {};
  }
}

export function getNativeEstimatedDays() {
  const raw = safe(() => nativeBridge()?.getEstimatedDaysJson?.() || "{}", "{}");
  try {
    const obj = JSON.parse(raw);
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v) out[k] = true;
    });
    return out;
  } catch {
    return {};
  }
}

// ── Fechas locales (sin desfase UTC) ──
export const toDateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// ── Meta personal (pacientes autogestionados) ──
const goalKey = (id) => `flux_steps_goal_${id}`;
export const getLocalStepGoal = (clienteId) => {
  if (!clienteId) return null;
  try {
    const v = Number(localStorage.getItem(goalKey(clienteId)));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
};
export const setLocalStepGoal = (clienteId, goal) => {
  if (!clienteId) return;
  try {
    const clean = Math.max(1000, Math.min(50000, Math.round(Number(goal) || DEFAULT_STEP_GOAL)));
    localStorage.setItem(goalKey(clienteId), String(clean));
  } catch {
    // Ignore storage quota errors
  }
};

// ── Sincronización con la nube (tabla pasos_diarios) ──
const syncedKey = (id) => `flux_steps_synced_${id}`;

export async function syncStepsToCloud(clienteId, nativeHistory, cloudHistory = {}) {
  if (!clienteId || !nativeHistory) return;
  let synced = {};
  try {
    synced = JSON.parse(localStorage.getItem(syncedKey(clienteId)) || "{}");
  } catch {
    synced = {};
  }

  const merged = mergeStepHistories(cloudHistory, nativeHistory);
  const rows = Object.entries(merged)
    .filter(([fecha, pasos]) => {
      if (pasos <= 0) return false;
      const cloudVal = Number(cloudHistory?.[fecha]) || 0;
      // Si la nube ya tiene el mismo o mayor valor, no enviar una escritura redundante o destructiva
      if (cloudVal >= pasos && synced[fecha] === pasos) return false;
      if (cloudVal > pasos) return false;
      if (cloudVal === pasos) {
        synced[fecha] = pasos;
        return false;
      }
      return synced[fecha] !== pasos;
    })
    .map(([fecha, pasos]) => ({
      cliente_id: clienteId,
      fecha,
      pasos,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    try {
      localStorage.setItem(syncedKey(clienteId), JSON.stringify(synced));
    } catch {
      // Ignore storage errors
    }
    return;
  }

  try {
    await dbUpsert("pasos_diarios?on_conflict=cliente_id,fecha", rows, {
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
    const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
    if (isOnline) {
      rows.forEach((r) => {
        synced[r.fecha] = r.pasos;
      });
      try {
        localStorage.setItem(syncedKey(clienteId), JSON.stringify(synced));
      } catch {
        // Ignore storage errors
      }
    }
  } catch (e) {
    // La tabla puede no existir aún o no haber conexión: el dato queda en el dispositivo y se reintenta luego.
    console.warn("No se pudo sincronizar pasos:", e?.message || e);
  }
}

export async function fetchCloudSteps(clienteId, days = 35, { force = false } = {}) {
  if (!clienteId) return {};
  try {
    const from = toDateKey(addDays(new Date(), -(days - 1)));
    const path = `pasos_diarios?cliente_id=eq.${clienteId}&fecha=gte.${from}&order=fecha.desc&limit=${days + 5}`;
    const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
    const rows = force && isOnline ? await dbGetFresh(path) : await dbGet(path);
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      out[String(r.fecha).split("T")[0]] = Math.max(0, Number(r.pasos) || 0);
    });
    return out;
  } catch {
    return {};
  }
}

export function mergeStepHistories(...histories) {
  const out = {};
  histories.forEach((h) =>
    Object.entries(h || {}).forEach(([k, v]) => {
      out[k] = Math.max(out[k] || 0, Number(v) || 0);
    })
  );
  return out;
}

// ── Métricas derivadas ──
export function computeStepMetrics({ steps = 0, pesoKg = 70, estaturaCm = 170, sexo = "M" }) {
  const s = Math.max(0, Number(steps) || 0);
  const peso = Number(pesoKg) > 0 ? Number(pesoKg) : 70;
  const estatura = Number(estaturaCm) > 0 ? Number(estaturaCm) : 170;
  const stride = estatura * (sexo === "F" ? 0.413 : 0.415); // cm por zancada
  const km = (s * stride) / 100000;
  const kcal = Math.round(km * peso * 0.55); // costo neto aprox. de caminar ≈ 0.5–0.6 kcal/kg/km
  const minutes = Math.round(s / 105); // cadencia media ≈ 100–110 pasos/min
  return { km: Number(km.toFixed(2)), kcal, minutes };
}

// Clasificación de estilo de vida por pasos/día (Tudor-Locke & Bassett)
export const STEP_LEVELS = [
  { id: "sedentario", min: 0, label: "Sedentario", short: "< 5,000", color: "#EF4444", faf: 1.2 },
  { id: "bajo", min: 5000, label: "Poco activo", short: "5,000–7,499", color: "#F59E0B", faf: 1.375 },
  { id: "medio", min: 7500, label: "Algo activo", short: "7,500–9,999", color: "#84CC16", faf: 1.55 },
  { id: "activo", min: 10000, label: "Activo", short: "10,000–12,499", color: "#10B981", faf: 1.725 },
  { id: "muy_activo", min: 12500, label: "Muy activo", short: "≥ 12,500", color: "#0EA5E9", faf: 1.9 },
];

export function classifySteps(steps) {
  const s = Number(steps) || 0;
  let lvl = STEP_LEVELS[0];
  STEP_LEVELS.forEach((l) => {
    if (s >= l.min) lvl = l;
  });
  return lvl;
}

export function nearestActivityFactor(value) {
  return ACTIVITY_FACTORS.reduce(
    (best, cur) => (Math.abs(cur.value - value) < Math.abs(best.value - value) ? cur : best),
    ACTIVITY_FACTORS[0]
  );
}

/** Promedio de pasos de los últimos `days` días con datos (excluye hoy si está incompleto). */
export function averageSteps(history, days = 7, includeToday = false) {
  const today = new Date();
  const vals = [];
  for (let i = includeToday ? 0 : 1; i < days + (includeToday ? 0 : 1); i++) {
    const v = history?.[toDateKey(addDays(today, -i))];
    if (v > 0) vals.push(v);
  }
  if (vals.length === 0) return { avg: 0, daysWithData: 0 };
  return { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), daysWithData: vals.length };
}

/**
 * Racha de días consecutivos que cumplen la meta. Si hoy aún no la alcanza, cuenta desde ayer
 * para no "romper" la racha antes de que termine el día.
 */
export function computeStreak(history, goal) {
  const g = Number(goal) > 0 ? Number(goal) : DEFAULT_STEP_GOAL;
  const today = new Date();
  let cursor = 0;
  if (!(history?.[toDateKey(today)] >= g)) cursor = 1;
  let streak = 0;
  for (let i = cursor; i < 365; i++) {
    const v = history?.[toDateKey(addDays(today, -i))];
    if (v >= g) streak++;
    else break;
  }
  return streak;
}

/**
 * Sugerencia de FAF combinando el gasto medido por pasos (NEAT) con el programado en entrenamiento.
 * Se promedian ambos para no sobrestimar el gasto (los pasos del entrenamiento ya cuentan en el NEAT,
 * pero el entrenamiento de fuerza no se refleja en pasos).
 */
export function suggestFafWithSteps({ avgSteps, trainingFaf }) {
  const stepsLevel = classifySteps(avgSteps);
  const stepsFaf = stepsLevel.faf;
  const combined = trainingFaf ? (stepsFaf + Number(trainingFaf)) / 2 : stepsFaf;
  const info = nearestActivityFactor(combined);
  return { stepsLevel, stepsFaf, trainingFaf: trainingFaf || null, suggested: info };
}
