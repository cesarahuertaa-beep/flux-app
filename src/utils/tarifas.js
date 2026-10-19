/**
 * Utilidad compartida para leer y resolver tarifas de la plataforma con vigencia por corte (Opción A).
 * Si el Superadmin cambia las tarifas hoy, la nueva tarifa entra en vigor a partir del próximo corte,
 * respetando la tarifa anterior para cualquier adeudo pendiente de cortes ya pasados.
 */

export const DEFAULT_RATES = {
  nutri_tier1: 50,
  nutri_tier2: 45,
  nutri_tier3: 40,
  civil_premium: 75,
  comision_pct: 35,
  effective_from: "2020-01-01"
};

/**
 * Calcula la fecha del próximo corte (día 10) a partir de hoy en formato YYYY-MM-DD.
 * Si hoy es antes del día 10, el próximo corte es el día 10 de este mes.
 * Si hoy es el día 10 o después, el próximo corte es el día 10 del mes siguiente.
 */
export function getNextCutoffDateStr(today = new Date()) {
  const diaCorte = 10;
  let nextCutoff;
  if (today.getDate() < diaCorte) {
    nextCutoff = new Date(today.getFullYear(), today.getMonth(), diaCorte);
  } else {
    nextCutoff = new Date(today.getFullYear(), today.getMonth() + 1, diaCorte);
  }
  const yyyy = nextCutoff.getFullYear();
  const mm = String(nextCutoff.getMonth() + 1).padStart(2, "0");
  const dd = String(nextCutoff.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Extrae el historial de tarifas guardado en configuracion_plataforma[0].tarifas_config
 * (o desde columnas directas si existen).
 */
export function parseTarifasHistory(cfgRow) {
  if (!cfgRow) return [DEFAULT_RATES];
  try {
    if (cfgRow.tarifas_config) {
      const parsed = typeof cfgRow.tarifas_config === "string"
        ? JSON.parse(cfgRow.tarifas_config)
        : cfgRow.tarifas_config;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => ({
          nutri_tier1: Number(item.nutri_tier1 ?? DEFAULT_RATES.nutri_tier1),
          nutri_tier2: Number(item.nutri_tier2 ?? DEFAULT_RATES.nutri_tier2),
          nutri_tier3: Number(item.nutri_tier3 ?? DEFAULT_RATES.nutri_tier3),
          civil_premium: Number(item.civil_premium ?? DEFAULT_RATES.civil_premium),
          comision_pct: Number(item.comision_pct ?? DEFAULT_RATES.comision_pct),
          effective_from: item.effective_from || "2020-01-01",
          updated_at: item.updated_at || null
        }));
      }
    }
  } catch (e) {
    console.warn("Error leyendo tarifas_config:", e);
  }
  return [DEFAULT_RATES];
}

/**
 * Devuelve la configuración de tarifas más reciente programada por el Superadmin
 * (para mostrar/editar en el panel de Control Pagos).
 */
export function getLatestConfiguredRates(cfgRow) {
  const history = parseTarifasHistory(cfgRow);
  return history[history.length - 1] || DEFAULT_RATES;
}

/**
 * Resuelve qué tarifas aplican para una fecha de corte específica (YYYY-MM-DD o Date).
 * Si un corte ya pasó (ej. 10 de este mes) y sigue pendiente de pago, y el Superadmin
 * programó un cambio de tarifa con vigencia para el próximo corte, esta función devuelve
 * la tarifa anterior para ese corte pendiente y la tarifa nueva para el próximo corte.
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

  // Filtrar todas las versiones cuya fecha de entrada en vigor sea <= a la fecha del corte evaluado
  const applicable = history.filter(h => (h.effective_from || "2020-01-01") <= targetStr);
  if (applicable.length > 0) {
    return applicable[applicable.length - 1];
  }
  return history[0] || DEFAULT_RATES;
}
