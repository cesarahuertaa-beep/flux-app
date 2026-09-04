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
 * Genera array de semanas con labels de fecha para una rutina y determina cuál es la semana actual.
 */
export const getSemanasConFecha = (rutina) => {
  if (!rutina) return [];
  
  // Si no hay fecha de inicio, por defecto usamos la fecha de hoy
  const inicio = rutina.fecha_inicio
    ? new Date(rutina.fecha_inicio + "T12:00:00")
    : new Date();
  
  const now = new Date();

  return Array.from({ length: rutina.semanas }, (_, i) => {
    // Calculamos el inicio de esta semana
    const start = new Date(inicio);
    start.setDate(start.getDate() + i * 7);
    start.setHours(0, 0, 0, 0); // Inicio del día (Lunes)

    // Calculamos el fin de esta semana
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999); // Fin del día (Domingo)

    // Es la semana actual si 'now' cae entre start y end
    const isCurrent = now >= start && now <= end;

    const fmt = (d) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      
    return { label: `${fmt(start)}-${fmt(end)}`, idx: i, isCurrent };
  });
};
