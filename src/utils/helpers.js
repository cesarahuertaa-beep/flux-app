// ── Shared Helpers ──────────────────────────────────────────────────────────

/**
 * Escapa caracteres HTML para prevenir XSS al inyectar en HTML strings.
 */
export const escapeHtml = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Parsea el campo `fotos` que puede ser array, JSON string, o URL string.
 */
export const parseFotos = (fotos) => {
  if (!fotos) return [];
  if (Array.isArray(fotos)) return fotos;
  try {
    return JSON.parse(fotos);
  } catch (e) {
    return typeof fotos === "string" && fotos.startsWith("http") ? [fotos] : [];
  }
};

/**
 * Parsea una fecha o timestamp a mediodía local (12:00:00) para evitar desfases
 * por zona horaria UTC (ej. UTC-6 en México convirtiendo T00:00:00Z al día anterior)
 * o por cambios de horario de verano (23h / 25h).
 */
export const parseLocalDateNoon = (dateStr) => {
  if (!dateStr) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  }
  const str = String(dateStr).trim();
  // Si es fecha pura YYYY-MM-DD o medianoche UTC (T00:00:00), tomar año/mes/día literal en zona local
  if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{4}-\d{2}-\d{2}T00:00:00/.test(str)) {
    const [y, m, d] = str.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    const [y, m, d] = str.slice(0, 10).split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d, 12, 0, 0, 0);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
};

/**
 * Calcula la semana actual del ciclo (1-indexed) en la zona horaria local del usuario.
 * El corte a la siguiente semana ocurre exactamente a las 00:00:00 hora local del día 8, 15, 22, etc.
 */
export const getCurrentCycleWeekInfo = (startStr) => {
  if (!startStr) return { currentCycleWeek: 1, isFuture: false };
  const t0 = parseLocalDateNoon(startStr);
  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const diffDays = Math.round((todayNoon.getTime() - t0.getTime()) / 86400000);
  const isFut = diffDays < 0;
  const wk = isFut ? 1 : Math.floor(diffDays / 7) + 1;
  return { currentCycleWeek: isNaN(wk) ? 1 : Math.max(1, wk), isFuture: isFut };
};

/**
 * Genera array de semanas con labels de fecha para una rutina o ciclo y determina cuál es la semana actual
 * usando aritmética segura en zona horaria local.
 */
export const getSemanasConFecha = (item, ciclo = null) => {
  if (!item && !ciclo) return [];
  const startRaw = item?.fecha_inicio || ciclo?.fecha_inicio || ciclo?.created_at || item?.created_at;
  const inicioNoon = parseLocalDateNoon(startRaw);

  let totalWeeks = parseInt(item?.semanas) || 0;
  if (!totalWeeks && ciclo?.nombre?.includes("|")) {
    totalWeeks = parseInt(ciclo.nombre.split("|")[1]) || 4;
  }
  if (!totalWeeks) totalWeeks = 4;

  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

  return Array.from({ length: totalWeeks }, (_, i) => {
    const start = new Date(inicioNoon);
    start.setDate(start.getDate() + i * 7);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const isCurrent = todayNoon.getTime() >= start.getTime() && todayNoon.getTime() <= end.getTime();

    const fmt = (d) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    return { label: `${fmt(start)}-${fmt(end)}`, idx: i, weekNum: i + 1, isCurrent };
  });
};
