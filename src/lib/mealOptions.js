/**
 * mealOptions.js
 * Utilidades para manejo de opciones dinámicas de comidas (Opción Principal + Alternativas múltiples)
 * y metadatos de días (Hidratación y Suplementación diaria) con compatibilidad 100% retrocompatible.
 */

export const OPTION_SEPARATOR = "\n--- OTRA OPCIÓN ---\n";

/**
 * Parsea las opciones de una comida desde opcion1 y opcion2
 * Devuelve un array de strings [opcionPrincipal, alt1, alt2, ...]
 */
export function parseMealOptions(comida) {
  if (!comida) return [""];
  const list = [];
  const p1 = (comida.opcion1 || "").trim();
  list.push(p1);

  const p2 = (comida.opcion2 || "").trim();
  if (p2) {
    if (p2.includes(OPTION_SEPARATOR)) {
      const parts = p2.split(OPTION_SEPARATOR);
      parts.forEach(part => {
        const tr = (part || "").trim();
        if (tr) list.push(tr);
      });
    } else {
      list.push(p2);
    }
  }

  // Garantizar siempre al menos la opción principal
  if (list.length === 0) list.push("");
  return list;
}

/**
 * Serializa un array de opciones a { opcion1, opcion2 } para guardar en la base de datos
 */
export function formatMealOptions(optionsList) {
  if (!Array.isArray(optionsList) || optionsList.length === 0) {
    return { opcion1: "", opcion2: "" };
  }
  const opcion1 = (optionsList[0] || "").trim();
  const alts = optionsList.slice(1).map(o => (o || "").trim()).filter(Boolean);
  const opcion2 = alts.join(OPTION_SEPARATOR);
  return { opcion1, opcion2 };
}

/**
 * Parsea el string compuesto del día (código, título personalizado, agua y suplementos)
 * Formato: "LUN|Título|AGUA:3.2|SUP:Creatina 5g, Cafeína 200mg"
 */
export function parseDiaMetadata(diaString) {
  if (!diaString) {
    return { dayCode: "S/D", titulo: "", agua: "", suplementos: "" };
  }
  const parts = String(diaString).split("|");
  const dayCode = parts[0] || "S/D";
  const titulo = parts[1] || "";
  let agua = "";
  let suplementos = "";

  for (let i = 2; i < parts.length; i++) {
    const p = parts[i] || "";
    if (p.startsWith("AGUA:")) {
      agua = p.substring(5).trim();
    } else if (p.startsWith("SUP:")) {
      suplementos = p.substring(4).trim();
    }
  }

  return { dayCode, titulo, agua, suplementos };
}

/**
 * Formatea los datos del día en un string compatible con la base de datos
 */
export function formatDiaMetadata({ dayCode, titulo, agua, suplementos }) {
  const code = (dayCode || "S/D").trim();
  const title = (titulo || "").trim();
  const extra = [];
  if (agua && String(agua).trim()) {
    extra.push(`AGUA:${String(agua).trim()}`);
  }
  if (suplementos && String(suplementos).trim()) {
    extra.push(`SUP:${String(suplementos).trim()}`);
  }
  return [code, title, ...extra].join("|");
}
