/**
 * Utilidad compartida para leer y resolver tarifas y límites de pacientes por bloque
 * desde configuracion_plataforma[0].tarifas_config.
 *
 * Modelo por Bloques Mensuales (30 días naturales):
 * - Nutriólogo Nivel 1 (1 a tier1_max pac.): $499 MXN
 * - Nutriólogo Nivel 2 (tier1_max+1 a tier2_max pac.): $699 MXN
 * - Nutriólogo Nivel 3 (tier2_max+1 en adelante): $949 MXN
 * - Nutriólogo Estudiante (1 a estudiante_max pac.): $239 MXN
 * - Administrativo Patrocinado Extra: $50 MXN
 * - Atleta Independiente (FLUX Pro Civil): $75 MXN
 */

export const DEFAULT_RATES = {
  nutri_tier1: 499,
  nutri_tier2: 699,
  nutri_tier3: 949,
  tier1_max: 20,
  tier2_max: 40,
  estudiante_max: 15,
  nutri_estudiante: 239,
  civil_premium: 75,
  admin_premium: 50,
  comision_pct: 32,
  domiciliacion_activa: true,
  stripe_link_tier1: "",
  stripe_link_tier2: "",
  stripe_link_tier3: "",
  stripe_link_estudiante: "",
  stripe_link_civil: "",
  stripe_portal_url: "",
  modelo_bloques: true,
  effective_from: "2020-01-01"
};

/**
 * Calcula la fecha del próximo corte sugerido en formato YYYY-MM-DD (a 30 días o día 10).
 */
export function getNextCutoffDateStr(today = new Date()) {
  const next = new Date(today);
  next.setDate(next.getDate() + 30);
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normaliza un registro de tarifas. Si detecta tarifas antiguas por paciente (<= $100 MXN
 * sin bandera modelo_bloques), migra limpiamente los montos de Nivel 1/2/3 a los nuevos
 * bloques por defecto ($499 / $699 / $949) respetando el resto de valores configurados.
 */
function normalizeRateItem(item = {}) {
  const isLegacyPerPatient =
    !item.modelo_bloques &&
    Number(item.nutri_tier1 || 0) <= 100 &&
    Number(item.nutri_tier2 || 0) <= 100 &&
    Number(item.nutri_tier3 || 0) <= 100;

  return {
    nutri_tier1: isLegacyPerPatient
      ? DEFAULT_RATES.nutri_tier1
      : Number(item.nutri_tier1 ?? DEFAULT_RATES.nutri_tier1),
    nutri_tier2: isLegacyPerPatient
      ? DEFAULT_RATES.nutri_tier2
      : Number(item.nutri_tier2 ?? DEFAULT_RATES.nutri_tier2),
    nutri_tier3: isLegacyPerPatient
      ? DEFAULT_RATES.nutri_tier3
      : Number(item.nutri_tier3 ?? DEFAULT_RATES.nutri_tier3),
    tier1_max: Math.max(1, Number(item.tier1_max ?? DEFAULT_RATES.tier1_max)),
    tier2_max: Math.max(2, Number(item.tier2_max ?? DEFAULT_RATES.tier2_max)),
    estudiante_max: Math.max(1, Number(item.estudiante_max ?? DEFAULT_RATES.estudiante_max)),
    nutri_estudiante: Number(item.nutri_estudiante ?? DEFAULT_RATES.nutri_estudiante),
    civil_premium: Number(item.civil_premium ?? DEFAULT_RATES.civil_premium),
    admin_premium: Number(item.admin_premium ?? DEFAULT_RATES.admin_premium),
    comision_pct: Number(item.comision_pct ?? DEFAULT_RATES.comision_pct),
    domiciliacion_activa: item.domiciliacion_activa !== undefined ? Boolean(item.domiciliacion_activa) : true,
    stripe_link_tier1: String(item.stripe_link_tier1 || "").trim(),
    stripe_link_tier2: String(item.stripe_link_tier2 || "").trim(),
    stripe_link_tier3: String(item.stripe_link_tier3 || "").trim(),
    stripe_link_estudiante: String(item.stripe_link_estudiante || "").trim(),
    stripe_link_civil: String(item.stripe_link_civil || "").trim(),
    stripe_portal_url: String(item.stripe_portal_url || "").trim(),
    modelo_bloques: true,
    effective_from: item.effective_from || "2020-01-01",
    updated_at: item.updated_at || null
  };
}

/**
 * Construye el enlace de suscripción con tarjeta domiciliada (Stripe Payment Link)
 * inyectando client_reference_id y prefilled_email para conciliación automática por Webhook.
 */
export function buildCardCheckoutUrl(baseUrl, { userId, email } = {}) {
  const clean = String(baseUrl || "").trim();
  if (!clean) return "";
  try {
    const url = new URL(clean);
    if (userId) url.searchParams.set("client_reference_id", String(userId));
    if (email) url.searchParams.set("prefilled_email", String(email).trim());
    return url.toString();
  } catch {
    return clean;
  }
}

/**
 * Opción B (Dinámica por API): Solicita a la Edge Function `stripe-checkout`
 * una sesión de cobro o del Portal de Clientes con el monto exacto calculado en servidor.
 */
export async function createDynamicStripeSession({
  action = "checkout",
  userType = "nutriologo",
  userId = "",
  email = "",
  isUpgrade = false,
} = {}) {
  const supaUrl = import.meta.env.VITE_SUPABASE_URL;
  const supaKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const returnUrl = typeof window !== "undefined" ? window.location.href.split("?")[0] : "https://fluxsport.app";

  const res = await fetch(`${supaUrl}/functions/v1/stripe-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supaKey,
      Authorization: `Bearer ${supaKey}`,
    },
    body: JSON.stringify({
      action,
      userType,
      userId,
      email,
      isUpgrade,
      returnUrl,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "Aún no se ha activado la llave de Stripe en el servidor.");
  }
  return data.url;
}

/**
 * Extrae el historial de tarifas guardado en configuracion_plataforma[0].tarifas_config.
 */
export function parseTarifasHistory(cfgRow) {
  if (!cfgRow) return [DEFAULT_RATES];
  try {
    if (cfgRow.tarifas_config) {
      const parsed =
        typeof cfgRow.tarifas_config === "string"
          ? JSON.parse(cfgRow.tarifas_config)
          : cfgRow.tarifas_config;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeRateItem);
      }
    }
  } catch (e) {
    console.warn("Error leyendo tarifas_config:", e);
  }
  return [DEFAULT_RATES];
}

/**
 * Devuelve la configuración de tarifas más reciente programada por el Superadmin.
 */
export function getLatestConfiguredRates(cfgRow) {
  const history = parseTarifasHistory(cfgRow);
  return history[history.length - 1] || DEFAULT_RATES;
}

/**
 * Resuelve qué tarifas aplican para una fecha de corte específica (YYYY-MM-DD o Date).
 */
export function getRatesForCutoff(cfgRow, cutoffDateOrStr) {
  const history = parseTarifasHistory(cfgRow);
  if (!cutoffDateOrStr) return history[history.length - 1] || DEFAULT_RATES;

  let targetStr;
  if (typeof cutoffDateOrStr === "string") {
    targetStr = cutoffDateOrStr.substring(0, 10);
  } else if (cutoffDateOrStr instanceof Date && !isNaN(cutoffDateOrStr)) {
    const yyyy = cutoffDateOrStr.getFullYear();
    const mm = String(cutoffDateOrStr.getMonth() + 1).padStart(2, "0");
    const dd = String(cutoffDateOrStr.getDate()).padStart(2, "0");
    targetStr = `${yyyy}-${mm}-${dd}`;
  } else {
    return history[history.length - 1] || DEFAULT_RATES;
  }

  const applicable = history.filter(h => (h.effective_from || "2020-01-01") <= targetStr);
  if (applicable.length > 0) {
    return applicable[applicable.length - 1];
  }
  return history[0] || DEFAULT_RATES;
}

/**
 * Resuelve el nivel, monto mensual del bloque y capacidad de pacientes
 * para un Nutriólogo (Titulado o Estudiante) según sus pacientes activos y las tarifas vigentes.
 */
export function resolveNutriPlanByVolume(activeCount = 0, isEstudiante = false, rates = DEFAULT_RATES) {
  const r = normalizeRateItem(rates);
  const count = Math.max(0, Number(activeCount) || 0);

  if (isEstudiante) {
    return {
      tier: 1,
      tierLabel: "Plan Estudiante",
      rangeLabel: `1 a ${r.estudiante_max} pacientes`,
      minPatients: 1,
      maxPatients: r.estudiante_max,
      blockPrice: r.nutri_estudiante,
      nextTierLabel: "Nivel 1 Profesional",
      nextTierPrice: r.nutri_tier1,
      nextTierMax: r.tier1_max,
      isOverLimit: count > r.estudiante_max
    };
  }

  if (count <= r.tier1_max) {
    return {
      tier: 1,
      tierLabel: "Nivel 1",
      rangeLabel: `1 a ${r.tier1_max} pacientes`,
      minPatients: 1,
      maxPatients: r.tier1_max,
      blockPrice: r.nutri_tier1,
      nextTierLabel: "Nivel 2",
      nextTierPrice: r.nutri_tier2,
      nextTierMax: r.tier2_max,
      isOverLimit: false
    };
  }

  if (count <= r.tier2_max) {
    return {
      tier: 2,
      tierLabel: "Nivel 2",
      rangeLabel: `${r.tier1_max + 1} a ${r.tier2_max} pacientes`,
      minPatients: r.tier1_max + 1,
      maxPatients: r.tier2_max,
      blockPrice: r.nutri_tier2,
      nextTierLabel: "Nivel 3",
      nextTierPrice: r.nutri_tier3,
      nextTierMax: null,
      isOverLimit: false
    };
  }

  return {
    tier: 3,
    tierLabel: "Nivel 3",
    rangeLabel: `${r.tier2_max + 1}+ pacientes (Ilimitado)`,
    minPatients: r.tier2_max + 1,
    maxPatients: null,
    blockPrice: r.nutri_tier3,
    nextTierLabel: null,
    nextTierPrice: null,
    nextTierMax: null,
    isOverLimit: false
  };
}
