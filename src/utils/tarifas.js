/**
 * Utilidad compartida para leer y resolver tarifas y límites de pacientes por bloque
 * desde configuracion_plataforma[0].tarifas_config.
 *
 * Modelo por Bloques (Mensual 30 días / Anual 365 días con meses de regalo):
 * - Nutriólogo Nivel 1 (1 a tier1_max pac.): $499 MXN/mes
 * - Nutriólogo Nivel 2 (tier1_max+1 a tier2_max pac.): $699 MXN/mes
 * - Nutriólogo Nivel 3 (tier2_max+1 en adelante, Ilimitado): $949 MXN/mes
 * - Nutriólogo Estudiante (1 a estudiante_max pac.): $239 MXN/mes
 * - Atleta Independiente (FLUX Pro Civil): $75 MXN/mes
 * - Plan Anual por defecto: paga 10 meses y recibe 12 (2 meses gratis).
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
  comision_pct: 32,
  anual_activo: true,
  meses_anual: 10, // Meses cobrados por 12 meses de servicio (10 = 2 meses gratis)
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
 * Calcula la fecha del próximo corte sugerido en formato YYYY-MM-DD (a N días, por defecto 30).
 */
export function getNextCutoffDateStr(today = new Date(), days = 30) {
  const next = new Date(today);
  next.setDate(next.getDate() + days);
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

  const rawMesesAnual = Number(item.meses_anual ?? DEFAULT_RATES.meses_anual);
  const mesesAnual = Math.min(12, Math.max(1, isNaN(rawMesesAnual) ? DEFAULT_RATES.meses_anual : rawMesesAnual));

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
    comision_pct: Number(item.comision_pct ?? DEFAULT_RATES.comision_pct),
    anual_activo: item.anual_activo !== undefined ? Boolean(item.anual_activo) : true,
    meses_anual: mesesAnual,
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
 * Calcula el precio anual aplicando los meses cobrados (por defecto 10 meses = 2 gratis).
 */
export function getAnnualPrice(monthlyPrice, rates = DEFAULT_RATES) {
  const r = normalizeRateItem(rates);
  return Math.round(Number(monthlyPrice || 0) * r.meses_anual);
}

/**
 * Devuelve cuántos meses de regalo otorga la anualidad (por defecto 2).
 */
export function getFreeMonthsCount(rates = DEFAULT_RATES) {
  const r = normalizeRateItem(rates);
  return Math.max(0, Number((12 - r.meses_anual).toFixed(1)));
}

/**
 * Porcentaje aproximado de ahorro anual respecto a pagar 12 mensualidades.
 */
export function getAnnualDiscountPct(rates = DEFAULT_RATES) {
  const r = normalizeRateItem(rates);
  return Math.max(0, Math.round(((12 - r.meses_anual) / 12) * 100));
}

/**
 * Ahorro en MXN del plan anual frente a 12 meses individuales.
 */
export function getAnnualSavings(monthlyPrice, rates = DEFAULT_RATES) {
  const m = Number(monthlyPrice || 0);
  return Math.max(0, Math.round(m * 12 - getAnnualPrice(m, rates)));
}

/**
 * Calcula la diferencia prorrateada al subir de nivel dentro de un ciclo vigente.
 */
export function computeProratedUpgrade({
  currentCyclePrice = 0,
  newCyclePrice = 0,
  expirationDate = null,
  cycleDays = 365,
  minAmount = 10,
  today = new Date(),
} = {}) {
  const rawDiff = Math.max(0, Number(newCyclePrice || 0) - Number(currentCyclePrice || 0));
  if (rawDiff <= 0 || !expirationDate) {
    return { amount: 0, remainingDays: 0, cycleDays, ratio: 0 };
  }
  const expDay = new Date(expirationDate);
  expDay.setHours(0, 0, 0, 0);
  const todayDay = new Date(today);
  todayDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expDay - todayDay) / 86400000);
  const remainingDays = Math.max(1, Math.min(cycleDays, diffDays));
  const ratio = remainingDays / cycleDays;
  const amount = Math.max(minAmount, Math.round(rawDiff * ratio));
  return { amount, remainingDays, cycleDays, ratio };
}

/**
 * Determina si un recibo corresponde a un periodo 'anual' o 'mensual'.
 */
export function inferReceiptPeriod(receipt) {
  if (!receipt) return "mensual";
  if (receipt.periodo === "anual" || receipt.periodo === "mensual") {
    return receipt.periodo;
  }
  if (receipt.fecha_corte_mes && receipt.created_at) {
    const cut = new Date((receipt.fecha_corte_mes.includes("T") ? receipt.fecha_corte_mes : `${receipt.fecha_corte_mes}T12:00:00`));
    const created = new Date(receipt.created_at);
    const daysSpan = (cut - created) / 86400000;
    if (daysSpan > 180) return "anual";
  }
  return "mensual";
}

/**
 * Devuelve la fecha local en formato YYYY-MM desde un timestamp o fecha string (para agrupar cobros reales).
 */
export function getReceiptChargeMonthKey(receipt) {
  const raw = receipt?.created_at || receipt?.fecha_corte_mes;
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw).substring(0, 7);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
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
 * una sesión de cobro (mensual, anual o upgrade prorrateado) o del Portal de Clientes.
 */
export async function createDynamicStripeSession({
  action = "checkout",
  userType = "nutriologo",
  userId = "",
  email = "",
  isUpgrade = false,
  tier = 0,
  billingPeriod = "monthly", // "monthly" | "annual"
} = {}) {
  const supaUrl = import.meta.env.VITE_SUPABASE_URL;
  const supaKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  let returnUrl = "https://flux-sport.com";
  if (typeof window !== "undefined") {
    try {
      const parsed = new URL(window.location.href);
      parsed.searchParams.delete("pago");
      returnUrl = parsed.toString();
    } catch {
      returnUrl = window.location.href.split("?")[0];
    }
  }

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
      tier,
      billingPeriod,
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
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return [normalizeRateItem(parsed.current || parsed)];
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
 * Resuelve las especificaciones del plan según el número de nivel (1, 2 o 3)
 * para un Nutriólogo o Estudiante.
 */
export function getNutriPlanByTier(tier = 1, isEstudiante = false, rates = DEFAULT_RATES) {
  const r = normalizeRateItem(rates);
  if (isEstudiante) {
    const annualPrice = getAnnualPrice(r.nutri_estudiante, r);
    return {
      tier: 1,
      tierLabel: "Plan Estudiante",
      rangeLabel: `1 a ${r.estudiante_max} pacientes`,
      minPatients: 1,
      maxPatients: r.estudiante_max,
      blockPrice: r.nutri_estudiante,
      annualPrice,
      annualSavings: getAnnualSavings(r.nutri_estudiante, r),
      monthlyEquivalent: Math.round(annualPrice / 12),
      nextTierLabel: "Nivel 1 Profesional",
      nextTierPrice: r.nutri_tier1,
      nextTierAnnualPrice: getAnnualPrice(r.nutri_tier1, r),
      nextTierMax: r.tier1_max,
      isOverLimit: false
    };
  }

  const t = Number(tier) || 1;
  if (t === 2) {
    const annualPrice = getAnnualPrice(r.nutri_tier2, r);
    return {
      tier: 2,
      tierLabel: "Nivel 2",
      rangeLabel: `${r.tier1_max + 1} a ${r.tier2_max} pacientes`,
      minPatients: r.tier1_max + 1,
      maxPatients: r.tier2_max,
      blockPrice: r.nutri_tier2,
      annualPrice,
      annualSavings: getAnnualSavings(r.nutri_tier2, r),
      monthlyEquivalent: Math.round(annualPrice / 12),
      nextTierLabel: "Nivel 3",
      nextTierPrice: r.nutri_tier3,
      nextTierAnnualPrice: getAnnualPrice(r.nutri_tier3, r),
      nextTierMax: null,
      isOverLimit: false
    };
  }

  if (t === 3) {
    const annualPrice = getAnnualPrice(r.nutri_tier3, r);
    return {
      tier: 3,
      tierLabel: "Nivel 3",
      rangeLabel: `${r.tier2_max + 1}+ pacientes (Ilimitado)`,
      minPatients: r.tier2_max + 1,
      maxPatients: null,
      blockPrice: r.nutri_tier3,
      annualPrice,
      annualSavings: getAnnualSavings(r.nutri_tier3, r),
      monthlyEquivalent: Math.round(annualPrice / 12),
      nextTierLabel: null,
      nextTierPrice: null,
      nextTierAnnualPrice: null,
      nextTierMax: null,
      isOverLimit: false
    };
  }

  const annualPrice = getAnnualPrice(r.nutri_tier1, r);
  return {
    tier: 1,
    tierLabel: "Nivel 1",
    rangeLabel: `1 a ${r.tier1_max} pacientes`,
    minPatients: 1,
    maxPatients: r.tier1_max,
    blockPrice: r.nutri_tier1,
    annualPrice,
    annualSavings: getAnnualSavings(r.nutri_tier1, r),
    monthlyEquivalent: Math.round(annualPrice / 12),
    nextTierLabel: "Nivel 2",
    nextTierPrice: r.nutri_tier2,
    nextTierAnnualPrice: getAnnualPrice(r.nutri_tier2, r),
    nextTierMax: r.tier2_max,
    isOverLimit: false
  };
}

/**
 * Resuelve el nivel, monto del bloque y capacidad de pacientes
 * para un Nutriólogo (Titulado o Estudiante) según sus pacientes activos y las tarifas vigentes.
 */
export function resolveNutriPlanByVolume(activeCount = 0, isEstudiante = false, rates = DEFAULT_RATES) {
  const r = normalizeRateItem(rates);
  const count = Math.max(0, Number(activeCount) || 0);

  if (isEstudiante) {
    const plan = getNutriPlanByTier(1, true, r);
    return {
      ...plan,
      isOverLimit: count > r.estudiante_max
    };
  }

  if (count <= r.tier1_max) {
    return getNutriPlanByTier(1, false, r);
  }

  if (count <= r.tier2_max) {
    return getNutriPlanByTier(2, false, r);
  }

  return getNutriPlanByTier(3, false, r);
}
