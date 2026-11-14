/**
 * mealOptions.js
 * Utilidades para manejo de opciones dinámicas de comidas (Opción Principal + Alternativas múltiples)
 * y metadatos de días (Hidratación y Suplementación diaria) con compatibilidad 100% retrocompatible.
 */

export const OPTION_SEPARATOR = "\n--- OTRA OPCIÓN ---\n";

import {
  stripSmaeTag,
  extractSmaeMapFromMealText,
  embedSmaeMapInMealText,
  extractMealIngredientsFromText,
} from "./smaeData";

/**
 * Parsea las opciones de una comida desde opcion1 y opcion2
 * Devuelve un array de strings [opcionPrincipal, alt1, alt2, ...]
 */
export function parseMealOptions(comida) {
  if (!comida) return [""];
  const cleanSmaeTag = stripSmaeTag;
  const list = [];
  const p1 = cleanSmaeTag(comida.opcion1 || "");
  list.push(p1);

  const p2 = String(comida.opcion2 || "");
  if (p2.trim()) {
    if (p2.includes(OPTION_SEPARATOR)) {
      const parts = p2.split(OPTION_SEPARATOR);
      parts.forEach(part => {
        const tr = cleanSmaeTag(part || "");
        if (tr) list.push(tr);
      });
    } else {
      const tr = cleanSmaeTag(p2);
      if (tr) list.push(tr);
    }
  }

  // Garantizar siempre al menos la opción principal
  if (list.length === 0) list.push("");
  return list;
}

/**
 * Extrae tanto los textos limpios como las listas de ingredientes SMAE estructurados ([INGS:...])
 * para cada opción (0 = Principal A, 1 = Alternativa B, etc.)
 */
export function parseMealOptionsStructured(comida) {
  if (!comida) return { opciones: [""], ingredientesPorOpcion: { 0: [] } };
  const rawParts = [String(comida.opcion1 || "")];
  const p2 = String(comida.opcion2 || "");
  if (p2.trim()) {
    if (p2.includes(OPTION_SEPARATOR)) {
      p2.split(OPTION_SEPARATOR).forEach((part) => {
        if (String(part || "").trim()) rawParts.push(String(part));
      });
    } else {
      rawParts.push(p2);
    }
  }
  const opciones = [];
  const ingredientesPorOpcion = {};
  rawParts.forEach((rawStr, idx) => {
    const { cleanText, ingredientes } = extractMealIngredientsFromText(rawStr);
    opciones.push(cleanText);
    ingredientesPorOpcion[idx] = ingredientes || [];
  });
  if (opciones.length === 0) {
    opciones.push("");
    ingredientesPorOpcion[0] = [];
  }
  return { opciones, ingredientesPorOpcion };
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
 * Igual que formatMealOptions, pero conserva los equivalentes SMAE de la comida de origen
 * (`sourceMeal.smaeMap` o la etiqueta embebida en `sourceMeal.opcion1`). Úsese al copiar
 * comidas (plantillas, duplicados) para no perder el desglose SMAE.
 */
export function formatMealOptionsKeepSmae(optionsList, sourceMeal = {}) {
  const { opcion1, opcion2 } = formatMealOptions(optionsList);
  const fromMeal = sourceMeal?.smaeMap && Object.keys(sourceMeal.smaeMap).length > 0 ? sourceMeal.smaeMap : null;
  const smaeMap = fromMeal || extractSmaeMapFromMealText(sourceMeal?.opcion1 || "").smaeMap || {};
  return { opcion1: embedSmaeMapInMealText(opcion1, smaeMap), opcion2 };
}

/**
 * Parsea el string compuesto del día (código, título personalizado, agua, suplementos y equivalentes SMAE)
 * Formato: "LUN|Título|AGUA:3.2|SUP:Creatina 5g, Cafeína 200mg|SMAE:verduras=4,frutas=2"
 */
export function parseDiaMetadata(diaString) {
  if (!diaString) {
    return { dayCode: "S/D", titulo: "", agua: "", suplementos: "", smae: "" };
  }
  const parts = String(diaString).split("|");
  const dayCode = parts[0] || "S/D";
  const titulo = parts[1] || "";
  let agua = "";
  let suplementos = "";
  let smae = "";

  for (let i = 2; i < parts.length; i++) {
    const p = parts[i] || "";
    if (p.startsWith("AGUA:")) {
      agua = p.substring(5).trim();
    } else if (p.startsWith("SUP:")) {
      suplementos = p.substring(4).trim();
    } else if (p.startsWith("SMAE:")) {
      smae = p.substring(5).trim();
    }
  }

  return { dayCode, titulo, agua, suplementos, smae };
}

/**
 * Formatea los datos del día en un string compatible con la base de datos
 */
export function formatDiaMetadata({ dayCode, titulo, agua, suplementos, smae }) {
  const code = (dayCode || "S/D").trim();
  const title = (titulo || "").trim();
  const extra = [];
  if (agua && String(agua).trim()) {
    extra.push(`AGUA:${String(agua).trim()}`);
  }
  if (suplementos && String(suplementos).trim()) {
    extra.push(`SUP:${String(suplementos).trim()}`);
  }
  if (smae && String(smae).trim()) {
    extra.push(`SMAE:${String(smae).trim()}`);
  }
  return [code, title, ...extra].join("|");
}
