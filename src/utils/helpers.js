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
 * Genera array de semanas con labels de fecha para una rutina.
 */
export const getSemanasConFecha = (rutina) => {
  if (!rutina) return [];
  const inicio = rutina.fecha_inicio
    ? new Date(rutina.fecha_inicio + "T12:00:00")
    : new Date();
  return Array.from({ length: rutina.semanas }, (_, i) => {
    const start = new Date(inicio);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { label: `${fmt(start)}-${fmt(end)}`, idx: i };
  });
};
