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
} from "./smaeData.js";
import { getCurrentCycleWeekInfo, hasCycleSlotArrived } from "../utils/helpers.js";

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

/** Cuenta las comidas completadas de un día nutricional dado su registro de progreso. */
export function countCompletedMealsForDay(dia, progRec) {
  const comidas = Array.isArray(dia?.comidas) ? dia.comidas : [];
  const totalC = comidas.length;
  const doneMap =
    progRec && typeof progRec.comidas_done === "object" && progRec.comidas_done !== null
      ? progRec.comidas_done
      : {};
  let doneCount = comidas.filter((c, ci) =>
    Boolean(
      (c?.id && doneMap[c.id]) ||
        doneMap[ci] ||
        doneMap[String(ci)] ||
        (c?.orden != null && doneMap[c.orden])
    )
  ).length;
  if (doneCount === 0 && Number(progRec?.comidas_realizadas) > 0) {
    const rawCount = Number(progRec.comidas_realizadas);
    doneCount = totalC > 0 ? Math.min(rawCount, totalC) : rawCount;
  }
  return doneCount;
}

/** Resuelve la meta diaria de hidratación (ml) a partir de metadatos del día, registro o peso del paciente. */
export function resolveNutritionDayWaterGoalMl(dia, progRec, fallbackMl = 2500) {
  const meta = parseDiaMetadata(dia?.dia || dia?.nombre || "");
  const parsedLitros = parseFloat(String(meta?.agua || "").replace(",", "."));
  if (!isNaN(parsedLitros) && parsedLitros > 0) {
    return Math.round(parsedLitros * 1000);
  }
  if (Number(progRec?.meta_agua_ml) > 0) {
    return Number(progRec.meta_agua_ml);
  }
  return fallbackMl;
}

/**
 * Calcula KPIs globales del ciclo nutricional para la vista Tracking (sin contar semanas o días futuros sin registro).
 */
export function computeCycleNutritionKpis({
  nutriDias = [],
  nutriProgreso = {},
  ciclo = null,
  refItem = null,
  clientePeso = null,
}) {
  const safeDias = Array.isArray(nutriDias) ? nutriDias : [];
  let totalWeeks = parseInt(refItem?.semanas, 10) || 0;
  if (!totalWeeks && ciclo?.nombre?.includes("|")) {
    totalWeeks = parseInt(ciclo.nombre.split("|")[1], 10) || 4;
  }
  if (!totalWeeks) totalWeeks = 4;

  const startRaw =
    refItem?.fecha_inicio ||
    ciclo?.fecha_inicio ||
    ciclo?.created_at ||
    refItem?.created_at ||
    null;
  const weekInfo = startRaw
    ? getCurrentCycleWeekInfo(startRaw)
    : { currentCycleWeek: 1, isFuture: false };
  const maxAllowedWeekIdx = weekInfo.isFuture
    ? -1
    : Math.min(totalWeeks - 1, Math.max(0, (weekInfo.currentCycleWeek || 1) - 1));
  const hasActiveCurrentWeek = !weekInfo.isFuture && (weekInfo.currentCycleWeek || 1) <= totalWeeks;

  const pesoNum = parseFloat(clientePeso);
  const defaultWaterGoalMl =
    !isNaN(pesoNum) && pesoNum > 0 ? Math.round((pesoNum * 35) / 50) * 50 : 2500;

  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

  let expectedMealsToDate = 0;
  let completedMealsToDate = 0;
  let expectedDays = 0;
  let activeDaysCount = 0;
  let completeDaysCount = 0;
  let totalWaterMl = 0;
  let expectedWaterMlToDate = 0;
  let currentWeekActiveCount = 0;
  let currentWeekCompleteCount = 0;
  let currentWeekExpectedDays = 0;

  for (let w = 0; w <= maxAllowedWeekIdx; w++) {
    const weekNum = w + 1;
    for (let dIdx = 0; dIdx < safeDias.length; dIdx++) {
      const d = safeDias[dIdx];
      const totalC = (d?.comidas || []).length;
      const rec = nutriProgreso?.[`${d.id}-${weekNum}`];
      const doneCount = countCompletedMealsForDay(d, rec);
      const aguaMl = Math.max(0, Number(rec?.agua_ml) || 0);
      const metaAguaMl = resolveNutritionDayWaterGoalMl(d, rec, defaultWaterGoalMl);

      const dayHasActivity = doneCount > 0 || aguaMl > 0;
      const isDayComplete = totalC > 0 ? doneCount >= totalC : dayHasActivity;

      const meta = parseDiaMetadata(d?.dia || d?.nombre || "");
      const dayTag =
        meta.dayCode && meta.dayCode !== "S/D"
          ? meta.dayCode
          : d?.dia_semana || d?.nombre || "";

      const hasArrived = hasCycleSlotArrived({
        dayTagOrName: dayTag,
        slotIdx: dIdx,
        totalSlots: safeDias.length,
        weekIdx: w,
        startStr: startRaw,
        todayNoon,
      });

      const countsInExpected = hasArrived || dayHasActivity;
      if (countsInExpected) {
        expectedDays++;
        expectedMealsToDate += totalC;
        expectedWaterMlToDate += metaAguaMl;
      }
      if (dayHasActivity) activeDaysCount++;
      if (isDayComplete) completeDaysCount++;

      completedMealsToDate += doneCount;
      totalWaterMl += aguaMl;

      if (hasActiveCurrentWeek && w === maxAllowedWeekIdx) {
        if (countsInExpected) currentWeekExpectedDays++;
        if (dayHasActivity) currentWeekActiveCount++;
        if (isDayComplete) currentWeekCompleteCount++;
      }
    }
  }

  const adherenceMealsPct =
    expectedMealsToDate > 0
      ? Math.min(100, Math.round((completedMealsToDate / expectedMealsToDate) * 100))
      : 0;
  const avgWaterL =
    expectedDays > 0 ? (totalWaterMl / (expectedDays * 1000)).toFixed(2) : "0.00";
  const avgWaterGoalL =
    expectedDays > 0
      ? (expectedWaterMlToDate / (expectedDays * 1000)).toFixed(2)
      : (defaultWaterGoalMl / 1000).toFixed(2);
  const waterPct =
    expectedWaterMlToDate > 0
      ? Math.min(100, Math.round((totalWaterMl / expectedWaterMlToDate) * 100))
      : 0;

  return {
    expectedMealsToDate,
    completedMealsToDate,
    adherenceMealsPct,
    expectedDays,
    activeDaysCount,
    completeDaysCount,
    totalWaterMl,
    expectedWaterMlToDate,
    avgWaterL,
    avgWaterGoalL,
    waterPct,
    hasActiveCurrentWeek,
    currentWeekActiveCount,
    currentWeekCompleteCount,
    currentWeekExpectedDays,
  };
}
