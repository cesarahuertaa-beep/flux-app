// Utilidades compartidas para rutinas híbridas (plano + por serie),
// etiquetas de serie, superseries, volumen semanal, migración y cálculo histórico 1RM/PR.
import { GRUPO_LABELS, normalizeMuscleGroup } from "../lib/constants.js";
import { getCurrentCycleWeekInfo, parseLocalDateNoon } from "./helpers.js";

const LB_TO_KG = 0.45359237;
const KG_TO_LB = 2.20462262;

export const SERIES_TYPES = {
  normal:  { id: "normal",  short: "",       badge: "Normal",       next: "warmup"  },
  warmup:  { id: "warmup",  short: "Calent.", badge: "Calentamiento", next: "dropset" },
  dropset: { id: "dropset", short: "Drop",    badge: "Drop Set",     next: "failure" },
  failure: { id: "failure", short: "Fallo",   badge: "Al fallo",     next: "normal"  },
};

export function normalizeSeriesType(rawType) {
  const t = String(rawType || "").trim().toLowerCase();
  if (t === "warmup" || t === "calentamiento" || t === "c" || t === "w") return "warmup";
  if (t === "dropset" || t === "drop" || t === "d") return "dropset";
  if (t === "failure" || t === "fallo" || t === "amrap" || t === "f") return "failure";
  return "normal";
}

export function normalizeExerciseName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function calcEpley1RM(pesoKg, reps) {
  const p = parseFloat(pesoKg);
  const r = parseFloat(reps);
  if (!p || !r || isNaN(p) || isNaN(r) || p <= 0 || r <= 0) return 0;
  if (r === 1) return p;
  return p * (1 + r / 30);
}

export function parseRawWeightToKg(rawVal) {
  if (rawVal === null || rawVal === undefined || rawVal === "" || rawVal === "-") return null;
  const s = String(rawVal).trim();
  if (!s) return null;
  if (s.startsWith("LB:")) {
    const lb = parseFloat(s.slice(3));
    return !isNaN(lb) && lb >= 0 ? Number((lb * LB_TO_KG).toFixed(4)) : null;
  }
  const n = parseFloat(s);
  return !isNaN(n) && n >= 0 ? Number(n.toFixed(4)) : null;
}

export function convertWeightToInput(pesoKg, unit = "kg") {
  if (pesoKg === null || pesoKg === undefined || pesoKg === "" || pesoKg === "-") return "";
  const raw = String(pesoKg).trim();
  if (raw.startsWith("LB:")) return raw.slice(3);
  const n = parseFloat(raw);
  if (isNaN(n)) return "";
  if (unit === "lb") {
    const lb = n * KG_TO_LB;
    return Math.abs(lb - Math.round(lb)) < 0.08 ? String(Math.round(lb)) : String(Number(lb.toFixed(1)));
  }
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : String(Number(n.toFixed(1)));
}

export function convertInputWeightToKg(inputVal, unit = "kg") {
  if (inputVal === null || inputVal === undefined || inputVal === "" || inputVal === "-") return null;
  const n = parseFloat(String(inputVal).trim());
  if (isNaN(n)) return null;
  return unit === "lb" ? Number((n * LB_TO_KG).toFixed(4)) : Number(n.toFixed(4));
}

export function normalizeSeriesDetalle(rawDetalle) {
  let arr = rawDetalle;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const r = parseInt(item.reps, 10);
      const p = parseRawWeightToKg(item.peso);
      const tipo = normalizeSeriesType(item.tipo);
      return {
        reps: !isNaN(r) && r > 0 ? r : null,
        peso: p,
        ...(tipo !== "normal" ? { tipo } : {}),
      };
    });
}

/** Convierte series_detalle guardado en kg hacia strings editables en la unidad del modal ('kg' | 'lb'). */
export function seriesDetalleToForm(rawDetalle, numSeries, fallbackReps = 10, fallbackPesoInput = "", unit = "kg") {
  const list = normalizeSeriesDetalle(rawDetalle);
  if (list.length === 0) return [];
  const count = Math.max(1, parseInt(numSeries, 10) || list.length || 4);
  return Array.from({ length: count }, (_, idx) => {
    const hasExplicitRow = idx < list.length;
    const item = list[idx];
    if (hasExplicitRow) {
      return {
        reps: item?.reps != null ? String(item.reps) : "",
        peso: item?.peso != null ? convertWeightToInput(item.peso, unit) : "",
        tipo: normalizeSeriesType(item?.tipo),
      };
    }
    return {
      reps: String(fallbackReps || 10),
      peso: String(fallbackPesoInput || ""),
      tipo: "normal",
    };
  });
}

/** Convierte el desglose editable del formulario a payload normalizado en kg (o [] si no está activo). */
export function seriesFormToDb(formSeries, unit = "kg", numSeries = null) {
  if (!Array.isArray(formSeries) || formSeries.length === 0) return [];
  const count = numSeries ? Math.max(1, parseInt(numSeries, 10) || formSeries.length) : formSeries.length;
  return Array.from({ length: count }, (_, idx) => {
    const s = formSeries[idx] || {};
    const r = parseInt(s.reps, 10);
    const tipo = normalizeSeriesType(s.tipo);
    return {
      reps: !isNaN(r) && r > 0 ? r : null,
      peso: convertInputWeightToKg(s.peso, unit),
      ...(tipo !== "normal" ? { tipo } : {}),
    };
  });
}

/** Verifica si el desglose por serie tiene valores o etiquetas distintos entre sí (justifica persistir detalle). */
export function hasCustomSeriesBreakdown(seriesList, scalarReps, scalarPesoKg) {
  if (!Array.isArray(seriesList) || seriesList.length === 0) return false;
  const refReps = parseInt(scalarReps, 10) || null;
  const refPeso = parseRawWeightToKg(scalarPesoKg);
  return seriesList.some((s) => {
    if (normalizeSeriesType(s?.tipo) !== "normal") return true;
    const repsDiff = s.reps != null && refReps != null ? s.reps !== refReps : s.reps !== refReps;
    const pesoDiff =
      s.peso != null && refPeso != null
        ? Math.abs(Number(s.peso) - Number(refPeso)) > 0.05
        : s.peso !== refPeso;
    return repsDiff || pesoDiff;
  });
}

/** Obtiene la sugerencia inicial (Semana 1 o sin historial en ciclo) para una serie puntual `si`. */
export function getSeriesSuggestion(exObj, serieIdx) {
  const list = normalizeSeriesDetalle(exObj?.series_detalle);
  const hasExplicitRow = serieIdx < list.length;
  const item = list[serieIdx];
  const reps = hasExplicitRow
    ? (item?.reps != null ? String(item.reps) : "-")
    : String(exObj?.reps_sugeridas || "10");
  const peso = hasExplicitRow
    ? (item?.peso !== null && item?.peso !== undefined && item?.peso !== "" ? String(item.peso) : "-")
    : (exObj?.peso_sugerido !== null && exObj?.peso_sugerido !== undefined && exObj?.peso_sugerido !== ""
        ? String(exObj.peso_sugerido)
        : "-");
  return { reps, peso };
}

function groupProgressRowsByWeek(rows, excludeSeriesSet = null) {
  const byWeek = new Map();
  for (const r of rows) {
    const w = parseInt(r.semana, 10);
    const s = parseInt(r.serie, 10);
    if (isNaN(w) || isNaN(s) || w < 0 || s < 0) continue;
    if (excludeSeriesSet && excludeSeriesSet.has(s)) continue;
    if (!byWeek.has(w)) byWeek.set(w, new Map());
    const wMap = byWeek.get(w);
    if (!wMap.has(s)) wMap.set(s, {});
    const cell = wMap.get(s);

    if (r.tipo === "reps") {
      const valStr = String(r.valor ?? "").trim();
      if (valStr && valStr !== "Falta") {
        const numR = parseInt(valStr, 10);
        if (!isNaN(numR) && numR > 0) cell.reps = numR;
      }
    } else if (r.tipo === "peso") {
      const kg = parseRawWeightToKg(r.valor);
      if (kg !== null && kg >= 0) cell.peso = kg;
    }
  }
  return byWeek;
}

function scoreSessionSummary(w, wMap) {
  let peak1RM = 0;
  let maxWeightKg = null;
  let peakReps = 0;
  let totalVolumeKg = 0;
  let totalReps = 0;
  let repWeightKg = null;
  let repReps = null;
  let repBest1RM = -1;
  let validSetsCount = 0;

  for (const cell of wMap.values()) {
    const reps = cell?.reps != null && cell.reps > 0 ? cell.reps : 0;
    const peso = cell?.peso != null && cell.peso >= 0 ? cell.peso : null;
    if (reps === 0 && (peso === null || peso <= 0)) continue;

    validSetsCount++;
    if (reps > peakReps) peakReps = reps;
    totalReps += reps;
    if (peso !== null && (maxWeightKg === null || peso > maxWeightKg)) {
      maxWeightKg = peso;
    }
    const e1rm = peso != null && peso > 0 && reps > 0 ? calcEpley1RM(peso, reps) : 0;
    if (e1rm > peak1RM) peak1RM = e1rm;
    if (peso !== null && peso > 0 && reps > 0) totalVolumeKg += peso * reps;

    const isBetterSet =
      e1rm - repBest1RM > 0.01 ||
      (Math.abs(e1rm - repBest1RM) <= 0.01 &&
        ((peso ?? -1) > (repWeightKg ?? -1) ||
          ((peso ?? -1) === (repWeightKg ?? -1) && reps > (repReps ?? 0))));
    if (isBetterSet) {
      repBest1RM = e1rm;
      repWeightKg = peso;
      repReps = reps || null;
    }
  }

  return {
    w,
    wMap,
    validSetsCount,
    peak1RM,
    maxWeightKg,
    peakReps,
    totalVolumeKg,
    totalReps,
    repWeightKg,
    repReps,
  };
}

export function isBetterExerciseMark(candidate, current) {
  if (!candidate) return false;
  if (!current) return true;
  const cand1RM = candidate.best1RM || 0;
  const cur1RM = current.best1RM || 0;
  if (Math.abs(cand1RM - cur1RM) > 0.01) return cand1RM > cur1RM;

  const candW = candidate.bestWeightKg ?? -1;
  const curW = current.bestWeightKg ?? -1;
  if (Math.abs(candW - curW) > 0.05) return candW > curW;

  const candVol = candidate.totalVolumeKg || 0;
  const curVol = current.totalVolumeKg || 0;
  if (Math.abs(candVol - curVol) > 0.1) return candVol > curVol;

  const candReps = candidate.bestReps || 0;
  const curReps = current.bestReps || 0;
  if (candReps !== curReps) return candReps > curReps;

  return (candidate.totalReps || 0) > (current.totalReps || 0);
}

function finalizeExtractedMarks(seriesMarks, meta, fallbackReps, fallbackPesoKg) {
  const firstReps = seriesMarks[0]?.reps ?? (parseInt(fallbackReps, 10) || 10);
  const summaryReps = meta.bestReps ?? firstReps;
  const summaryPeso = meta.bestWeightKg ?? meta.maxWeightKg ?? seriesMarks[0]?.peso ?? parseRawWeightToKg(fallbackPesoKg);
  const customDetalle = hasCustomSeriesBreakdown(seriesMarks, summaryReps, summaryPeso) ? seriesMarks : [];

  return {
    reps_sugeridas: summaryReps,
    peso_sugerido: summaryPeso,
    series_detalle: customDetalle,
    allSeriesMarks: seriesMarks,
    best1RM: meta.best1RM || 0,
    totalVolumeKg: meta.totalVolumeKg || 0,
    totalReps: meta.totalReps || 0,
    lastWeightKg: meta.bestWeightKg ?? meta.maxWeightKg ?? null,
    lastReps: summaryReps,
    bestWeightKg: meta.bestWeightKg ?? meta.maxWeightKg ?? null,
    bestReps: summaryReps,
    maxWeightKg: meta.maxWeightKg ?? null,
  };
}

function extractMarksFromRowsByMode(rows, numSeries, fallbackReps = 10, fallbackPesoKg = null, mode = "latest", excludeSeriesSet = null) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const count = Math.max(1, parseInt(numSeries, 10) || 4);
  const byWeek = groupProgressRowsByWeek(rows, excludeSeriesSet);
  if (byWeek.size === 0) return null;

  if (mode === "best") {
    const sessions = [];
    for (const [w, wMap] of byWeek.entries()) {
      const scored = scoreSessionSummary(w, wMap);
      if (scored.validSetsCount > 0) sessions.push(scored);
    }
    if (sessions.length === 0) return null;

    sessions.sort((a, b) => {
      if (Math.abs(a.peak1RM - b.peak1RM) > 0.01) return b.peak1RM - a.peak1RM;
      if (Math.abs((a.maxWeightKg ?? -1) - (b.maxWeightKg ?? -1)) > 0.05) return (b.maxWeightKg ?? -1) - (a.maxWeightKg ?? -1);
      if (Math.abs(a.totalVolumeKg - b.totalVolumeKg) > 0.1) return b.totalVolumeKg - a.totalVolumeKg;
      if (a.peakReps !== b.peakReps) return b.peakReps - a.peakReps;
      if (a.totalReps !== b.totalReps) return b.totalReps - a.totalReps;
      return b.w - a.w;
    });

    const bestSession = sessions[0];
    const fallbackKg = parseRawWeightToKg(fallbackPesoKg);
    const defaultSessionReps = bestSession.repReps ?? (parseInt(fallbackReps, 10) || 10);
    const defaultSessionPeso = bestSession.repWeightKg !== undefined && bestSession.repWeightKg !== null ? bestSession.repWeightKg : fallbackKg;
    const seriesMarks = [];

    for (let si = 0; si < count; si++) {
      const cell = bestSession.wMap.get(si);
      const hasCell = cell && ((cell.reps != null && cell.reps > 0) || (cell.peso != null && cell.peso >= 0));
      const finalReps = hasCell && cell.reps != null && cell.reps > 0 ? cell.reps : defaultSessionReps;
      const finalPeso = hasCell && cell.peso != null && cell.peso >= 0 ? cell.peso : defaultSessionPeso;
      seriesMarks.push({ reps: finalReps, peso: finalPeso });
    }

    return finalizeExtractedMarks(
      seriesMarks,
      {
        best1RM: bestSession.peak1RM,
        bestWeightKg: bestSession.repWeightKg,
        bestReps: bestSession.repReps,
        maxWeightKg: bestSession.maxWeightKg,
        totalVolumeKg: bestSession.totalVolumeKg,
        totalReps: bestSession.totalReps,
      },
      fallbackReps,
      fallbackPesoKg
    );
  }

  const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => b - a);
  const seriesMarks = [];
  let anyFound = false;
  let maxWeightKg = null;
  let bestReps = null;
  let best1RM = 0;
  let totalVolumeKg = 0;
  let totalReps = 0;

  for (let si = 0; si < count; si++) {
    let foundReps = null;
    let foundPeso = null;

    for (const w of sortedWeeks) {
      const cell = byWeek.get(w)?.get(si);
      if (!cell) continue;
      if (foundReps === null && cell.reps != null) {
        foundReps = cell.reps;
        if (cell.peso != null) foundPeso = cell.peso;
        break;
      }
    }
    if (foundPeso === null) {
      for (const w of sortedWeeks) {
        const cell = byWeek.get(w)?.get(si);
        if (cell?.peso != null) {
          foundPeso = cell.peso;
          break;
        }
      }
    }

    if (foundReps !== null || foundPeso !== null) anyFound = true;
    const finalReps = foundReps ?? (parseInt(fallbackReps, 10) || 10);
    const finalPeso = foundPeso ?? parseRawWeightToKg(fallbackPesoKg);

    seriesMarks.push({ reps: finalReps, peso: finalPeso });
    totalReps += finalReps;
    if (finalPeso != null && finalPeso > 0) totalVolumeKg += finalPeso * finalReps;
    if (finalPeso != null && (maxWeightKg === null || finalPeso > maxWeightKg)) {
      maxWeightKg = finalPeso;
    }
    const e1rm = calcEpley1RM(finalPeso, finalReps);
    if (e1rm > best1RM) {
      best1RM = e1rm;
      bestReps = finalReps;
    }
  }

  if (!anyFound) return null;

  return finalizeExtractedMarks(
    seriesMarks,
    { best1RM, bestWeightKg: maxWeightKg, bestReps, maxWeightKg, totalVolumeKg, totalReps },
    fallbackReps,
    fallbackPesoKg
  );
}

/** Extrae las últimas marcas reales alcanzadas a partir de filas de `progreso` (ignora "Falta", vacíos y calentamientos). */
export function extractLatestMarksFromRows(rows, numSeries, fallbackReps = 10, fallbackPesoKg = null, excludeSeriesSet = null) {
  return extractMarksFromRowsByMode(rows, numSeries, fallbackReps, fallbackPesoKg, "latest", excludeSeriesSet);
}

/** Extrae la mejor sesión/marca histórica alcanzada en `progreso` (por 1RM, carga, volumen y reps, excluyendo calentamientos). */
export function extractBestMarksFromRows(rows, numSeries, fallbackReps = 10, fallbackPesoKg = null, excludeSeriesSet = null) {
  return extractMarksFromRowsByMode(rows, numSeries, fallbackReps, fallbackPesoKg, "best", excludeSeriesSet);
}

/**
 * Construye índices históricos para un paciente:
 * - latestByKey: últimas marcas por `biblioteca_id` y por nombre normalizado
 * - bestByKey: mejores marcas reales históricas entre todos los ciclos/rutinas
 * - best1RMByKey: mejor 1RM histórico en ciclos previos al actual (`excludeCicloId`)
 */
export function buildPatientExerciseHistory(pastRutinas, allProgresoRows, excludeCicloId = null) {
  const latestByKey = {};
  const bestByKey = {};
  const best1RMByKey = {};
  if (!Array.isArray(pastRutinas) || !Array.isArray(allProgresoRows) || allProgresoRows.length === 0) {
    return { latestByKey, bestByKey, best1RMByKey };
  }

  // Indexar qué índices de serie eran calentamiento ("warmup") para excluirlos de 1RM/PR/mejores marcas
  const warmupSetByEjVar = new Map();
  for (const r of pastRutinas) {
    for (const ej of r.ejercicios || []) {
      if (!ej?.id) continue;
      const origDet = normalizeSeriesDetalle(ej.series_detalle);
      const origWarm = new Set();
      origDet.forEach((s, idx) => {
        if (s?.tipo === "warmup") origWarm.add(idx);
      });
      if (origWarm.size > 0) warmupSetByEjVar.set(`${ej.id}:original`, origWarm);

      let rawAlts = ej.alternativas;
      if (typeof rawAlts === "string") {
        try { rawAlts = JSON.parse(rawAlts); } catch { rawAlts = []; }
      }
      if (Array.isArray(rawAlts)) {
        rawAlts.forEach((alt, aIdx) => {
          const altDet = normalizeSeriesDetalle(alt?.series_detalle);
          const altWarm = new Set();
          altDet.forEach((s, idx) => {
            if (s?.tipo === "warmup") altWarm.add(idx);
          });
          if (altWarm.size > 0) warmupSetByEjVar.set(`${ej.id}:alt_${aIdx}`, altWarm);
        });
      }
    }
  }

  const progByEjVar = new Map();
  const best1RMByEjId = new Map();
  const setPairs = new Map();

  for (const r of allProgresoRows) {
    const vid = r.variante_id || "original";
    const k = `${r.ejercicio_id}:${vid}`;
    const sIdx = parseInt(r.serie, 10);
    if (!isNaN(sIdx) && warmupSetByEjVar.get(k)?.has(sIdx)) continue;

    if (!progByEjVar.has(k)) progByEjVar.set(k, []);
    progByEjVar.get(k).push(r);

    const pKey = `${r.ejercicio_id}:${vid}:${r.semana}:${r.serie}`;
    if (!setPairs.has(pKey)) setPairs.set(pKey, { ejId: r.ejercicio_id, vid });
    const pair = setPairs.get(pKey);
    if (r.tipo === "peso") pair.peso = parseRawWeightToKg(r.valor);
    else if (r.tipo === "reps") {
      const s = String(r.valor ?? "").trim();
      pair.reps = s && s !== "Falta" ? parseInt(s, 10) : 0;
    }
  }

  for (const pair of setPairs.values()) {
    const e1rm = calcEpley1RM(pair.peso, pair.reps);
    if (e1rm > 0) {
      const bKey = `${pair.ejId}:${pair.vid}`;
      if (e1rm > (best1RMByEjId.get(bKey) || 0)) best1RMByEjId.set(bKey, e1rm);
    }
  }

  for (const r of pastRutinas) {
    const isExcludedCycle = excludeCicloId && String(r.ciclo_id || "") === String(excludeCicloId);
    for (const ej of r.ejercicios || []) {
      const nSeries = parseInt(ej.num_series || ej.series, 10) || 4;
      let rawAlts = ej.alternativas;
      if (typeof rawAlts === "string") {
        try {
          rawAlts = JSON.parse(rawAlts);
        } catch {
          rawAlts = [];
        }
      }
      const normalizedEj = {
        ...ej,
        nombre: ej.nombre || ej.ejercicio || "",
        reps_sugeridas: ej.reps_sugeridas ?? ej.repeticiones ?? 10,
      };
      const variants = [
        { vid: "original", obj: normalizedEj },
        ...(Array.isArray(rawAlts)
          ? rawAlts.map((alt, idx) => ({
              vid: `alt_${idx}`,
              obj: {
                ...alt,
                nombre: alt?.nombre || alt?.ejercicio || "",
                reps_sugeridas: alt?.reps_sugeridas ?? alt?.repeticiones ?? normalizedEj.reps_sugeridas,
              },
            }))
          : []),
      ];

      for (const { vid, obj } of variants) {
        const bibKey = obj.biblioteca_id ? `bib:${obj.biblioteca_id}` : null;
        const nameNorm = normalizeExerciseName(obj.nombre);
        const nameKey = nameNorm ? `name:${nameNorm}` : null;

        if (!isExcludedCycle) {
          const hist1RM = best1RMByEjId.get(`${ej.id}:${vid}`) || 0;
          if (hist1RM > 0) {
            if (bibKey && hist1RM > (best1RMByKey[bibKey] || 0)) best1RMByKey[bibKey] = hist1RM;
            if (nameKey && hist1RM > (best1RMByKey[nameKey] || 0)) best1RMByKey[nameKey] = hist1RM;
          }
        }

        const rows = progByEjVar.get(`${ej.id}:${vid}`);
        if (!rows || rows.length === 0) continue;

        const latestExtracted = extractLatestMarksFromRows(rows, nSeries, obj.reps_sugeridas, obj.peso_sugerido);
        if (latestExtracted) {
          if (bibKey && !latestByKey[bibKey]) latestByKey[bibKey] = latestExtracted;
          if (nameKey && !latestByKey[nameKey]) latestByKey[nameKey] = latestExtracted;
        }

        const bestExtracted = extractBestMarksFromRows(rows, nSeries, obj.reps_sugeridas, obj.peso_sugerido);
        if (bestExtracted) {
          if (bibKey && isBetterExerciseMark(bestExtracted, bestByKey[bibKey])) bestByKey[bibKey] = bestExtracted;
          if (nameKey && isBetterExerciseMark(bestExtracted, bestByKey[nameKey])) bestByKey[nameKey] = bestExtracted;
        }
      }
    }
  }

  return { latestByKey, bestByKey, best1RMByKey };
}

export function lookupExerciseHistory(map, obj) {
  if (!map || !obj) return null;
  const byBib = obj.biblioteca_id ? map[`bib:${obj.biblioteca_id}`] || null : null;
  const nameNorm = normalizeExerciseName(obj.nombre);
  const byName = nameNorm ? map[`name:${nameNorm}`] || null : null;
  if (byBib && byName) {
    if (typeof byBib === "object" && typeof byName === "object") {
      return isBetterExerciseMark(byName, byBib) ? byName : byBib;
    }
    if (typeof byBib === "number" && typeof byName === "number") {
      return Math.max(byBib, byName);
    }
  }
  return byBib || byName || null;
}

function buildWarmupSetFromDetalle(rawDetalle) {
  const set = new Set();
  normalizeSeriesDetalle(rawDetalle).forEach((s, idx) => {
    if (s?.tipo === "warmup") set.add(idx);
  });
  return set;
}

function mergeTypesFromOldDetalle(oldRawDetalle, migratedObj, nSeries) {
  const oldNorm = normalizeSeriesDetalle(oldRawDetalle);
  if (oldNorm.length === 0) return migratedObj;
  const hasAnyNonNormal = oldNorm.some((s) => s?.tipo && s.tipo !== "normal");
  if (!hasAnyNonNormal) return migratedObj;

  const baseSeries = Array.isArray(migratedObj.allSeriesMarks) && migratedObj.allSeriesMarks.length > 0
    ? migratedObj.allSeriesMarks
    : Array.from({ length: nSeries }, () => ({ reps: migratedObj.reps_sugeridas, peso: migratedObj.peso_sugerido }));

  const merged = Array.from({ length: nSeries }, (_, idx) => {
    const oldItem = oldNorm[idx];
    const tipo = normalizeSeriesType(oldItem?.tipo);
    if (tipo === "warmup") {
      return {
        reps: oldItem?.reps ?? baseSeries[idx]?.reps ?? migratedObj.reps_sugeridas,
        peso: oldItem?.peso !== undefined ? oldItem.peso : null,
        tipo: "warmup",
      };
    }
    return {
      reps: baseSeries[idx]?.reps ?? migratedObj.reps_sugeridas,
      peso: baseSeries[idx]?.peso ?? migratedObj.peso_sugerido,
      ...(tipo !== "normal" ? { tipo } : {}),
    };
  });

  return {
    ...migratedObj,
    series_detalle: merged,
  };
}

/** Aplica migración de mejores marcas reales sobre un ejercicio clonado (principal + alternativas). */
export function migrateClonedExerciseWithProgress(oldEj, progRowsByEjVar) {
  const nSeries = parseInt(oldEj.num_series || oldEj.series, 10) || 4;
  const origWarm = buildWarmupSetFromDetalle(oldEj.series_detalle);
  const origRows = progRowsByEjVar.get(`${oldEj.id}:original`) || [];
  const origRawMigrated = extractBestMarksFromRows(origRows, nSeries, oldEj.reps_sugeridas, oldEj.peso_sugerido, origWarm);
  const origMigrated = origRawMigrated ? mergeTypesFromOldDetalle(oldEj.series_detalle, origRawMigrated, nSeries) : null;

  const migratedAlts = (oldEj.alternativas || []).map((alt, idx) => {
    const altWarm = buildWarmupSetFromDetalle(alt.series_detalle);
    const altRows = progRowsByEjVar.get(`${oldEj.id}:alt_${idx}`) || [];
    const altRawMigrated = extractBestMarksFromRows(
      altRows,
      nSeries,
      alt.reps_sugeridas ?? oldEj.reps_sugeridas,
      alt.peso_sugerido ?? oldEj.peso_sugerido,
      altWarm
    );
    if (!altRawMigrated) {
      return {
        ...alt,
        peso_sugerido: parseRawWeightToKg(alt.peso_sugerido),
        series_detalle: normalizeSeriesDetalle(alt.series_detalle),
      };
    }
    const altMigrated = mergeTypesFromOldDetalle(alt.series_detalle, altRawMigrated, nSeries);
    return {
      ...alt,
      reps_sugeridas: altMigrated.reps_sugeridas,
      peso_sugerido: altMigrated.peso_sugerido,
      series_detalle: altMigrated.series_detalle,
    };
  });

  if (!origMigrated) {
    return {
      reps_sugeridas: +oldEj.reps_sugeridas || +oldEj.repeticiones || 10,
      peso_sugerido: parseRawWeightToKg(oldEj.peso_sugerido),
      series_detalle: normalizeSeriesDetalle(oldEj.series_detalle),
      alternativas: migratedAlts,
    };
  }

  return {
    reps_sugeridas: origMigrated.reps_sugeridas,
    peso_sugerido: origMigrated.peso_sugerido,
    series_detalle: origMigrated.series_detalle,
    alternativas: migratedAlts,
  };
}

/** Carga filas de `progreso` estrictamente de un `cliente_id` paginando de a 1000 sin truncamientos silenciosos. */
export async function fetchPagedProgresoRows(getter, clientId, extraFilter = "") {
  if (!getter || !clientId) return { rows: [], ok: false };
  const PAGE = 1000;
  const all = [];
  const filterPart = extraFilter ? `&${extraFilter}` : "";

  try {
    for (let offset = 0; offset < 6000; offset += PAGE) {
      const chunk = await getter(
        `progreso?cliente_id=eq.${clientId}${filterPart}&select=*&order=updated_at.desc&limit=${PAGE}&offset=${offset}`
      );
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      all.push(...chunk);
      if (chunk.length < PAGE) break;
    }
    return { rows: all, ok: true };
  } catch {
    try {
      const fallback = await getter(
        `progreso?cliente_id=eq.${clientId}${filterPart}&select=*&limit=3000`
      );
      return { rows: Array.isArray(fallback) ? fallback : [], ok: Array.isArray(fallback) };
    } catch {
      return { rows: [], ok: false };
    }
  }
}

/**
 * Carga el historial de rutinas y marcas reales estrictamente para un `cliente_id` específico
 * (sin cruzar otros perfiles ni depender de `rutinas.created_at`).
 */
export async function fetchClientExerciseHistoryData(getter, clientId, { excludeCicloId = null } = {}) {
  if (!getter || !clientId) {
    return { latestByKey: {}, bestByKey: {}, best1RMByKey: {}, ok: false };
  }

  let pastRuts;
  let rutsOk;
  try {
    pastRuts = await getter(`rutinas?cliente_id=eq.${clientId}&select=*,ejercicios(*)&order=orden.asc`);
    rutsOk = Array.isArray(pastRuts);
  } catch {
    try {
      pastRuts = await getter(`rutinas?cliente_id=eq.${clientId}&select=*,ejercicios(*)`);
      rutsOk = Array.isArray(pastRuts);
    } catch {
      pastRuts = [];
      rutsOk = false;
    }
  }

  const progRes = await fetchPagedProgresoRows(getter, clientId);
  const progRows = progRes.rows;
  let enrichedRutinas = Array.isArray(pastRuts) ? pastRuts.map((r) => ({ ...r })) : [];

  // 1. Si el embed `ejercicios(*)` vino vacío en alguna rutina, consultar ejercicios por rutina_id
  const emptyRutIds = enrichedRutinas
    .filter((r) => r?.id && (!Array.isArray(r.ejercicios) || r.ejercicios.length === 0))
    .map((r) => r.id);

  if (emptyRutIds.length > 0) {
    const chunkSize = 50;
    const byRutina = new Map();
    for (let i = 0; i < emptyRutIds.length; i += chunkSize) {
      const slice = emptyRutIds.slice(i, i + chunkSize);
      const directEjs = await getter(`ejercicios?rutina_id=in.(${slice.join(",")})&select=*`).catch(() => []);
      (Array.isArray(directEjs) ? directEjs : []).forEach((ej) => {
        if (!byRutina.has(ej.rutina_id)) byRutina.set(ej.rutina_id, []);
        byRutina.get(ej.rutina_id).push(ej);
      });
    }
    enrichedRutinas = enrichedRutinas.map((r) =>
      (!Array.isArray(r.ejercicios) || r.ejercicios.length === 0) && byRutina.has(r.id)
        ? { ...r, ejercicios: byRutina.get(r.id) }
        : r
    );
  }

  // 2. Respaldo final (patrón Progreso.jsx): resolver ejercicio_id presentes en progreso no cubiertos aún
  const coveredEjIds = new Set();
  const rutinaCicloById = new Map();
  enrichedRutinas.forEach((r) => {
    if (r?.id) rutinaCicloById.set(r.id, r.ciclo_id || null);
    (r.ejercicios || []).forEach((ej) => {
      if (ej?.id) coveredEjIds.add(String(ej.id));
    });
  });

  const missingEjIds = [];
  const seenMissing = new Set();
  for (const pr of progRows) {
    const ejId = pr?.ejercicio_id;
    if (ejId && !coveredEjIds.has(String(ejId)) && !seenMissing.has(String(ejId))) {
      seenMissing.add(String(ejId));
      missingEjIds.push(ejId);
    }
  }

  if (missingEjIds.length > 0) {
    const extraEjsByCiclo = new Map();
    for (let i = 0; i < missingEjIds.length; i += 60) {
      const slice = missingEjIds.slice(i, i + 60);
      const directEjs = await getter(`ejercicios?id=in.(${slice.join(",")})&select=*`).catch(() => []);
      (Array.isArray(directEjs) ? directEjs : []).forEach((ej) => {
        const cId = (ej.rutina_id && rutinaCicloById.get(ej.rutina_id)) || "__orphan__";
        if (!extraEjsByCiclo.has(cId)) extraEjsByCiclo.set(cId, []);
        extraEjsByCiclo.get(cId).push(ej);
      });
    }
    for (const [cId, ejsList] of extraEjsByCiclo.entries()) {
      enrichedRutinas.push({
        id: `fallback_${cId}`,
        ciclo_id: cId === "__orphan__" ? null : cId,
        ejercicios: ejsList,
      });
    }
  }

  const history = buildPatientExerciseHistory(enrichedRutinas, progRows, excludeCicloId);
  return {
    ...history,
    progRows,
    ok: rutsOk && progRes.ok,
  };
}

/** Obtiene el tipo de serie ('normal' | 'warmup' | 'dropset' | 'failure') en el índice `si`. */
export function getSeriesType(exObj, si) {
  if (!exObj) return "normal";
  if (Array.isArray(exObj.seriesForm) && exObj.seriesForm.length > 0) {
    return normalizeSeriesType(exObj.seriesForm[si]?.tipo);
  }
  const det = normalizeSeriesDetalle(exObj.series_detalle);
  return normalizeSeriesType(det[si]?.tipo);
}

export function isWarmupSeries(exObj, si) {
  return getSeriesType(exObj, si) === "warmup";
}

/** Genera etiquetas visuales consistentes (`C1`, `C2`, `1`, `2`, `D`, `F`) para una lista de series. */
export function getSeriesVisualLabels(exObj, totalSeries = null) {
  const count = Math.max(
    1,
    parseInt(totalSeries ?? exObj?.num_series ?? exObj?.series, 10) ||
      (Array.isArray(exObj?.seriesForm) && exObj.seriesForm.length) ||
      4
  );
  let warmIdx = 0;
  let workIdx = 0;
  return Array.from({ length: count }, (_, si) => {
    const tipo = getSeriesType(exObj, si);
    if (tipo === "warmup") {
      warmIdx++;
      return { si, tipo, label: `C${warmIdx}`, isWarmup: true, shortTag: "Calent." };
    }
    workIdx++;
    if (tipo === "dropset") {
      return { si, tipo, label: `${workIdx}·D`, isWarmup: false, shortTag: "Drop" };
    }
    if (tipo === "failure") {
      return { si, tipo, label: `${workIdx}·F`, isWarmup: false, shortTag: "Fallo" };
    }
    return { si, tipo: "normal", label: String(workIdx), isWarmup: false, shortTag: "" };
  });
}

/** Retorna la lista de índices de serie efectivos (excluyendo calentamiento; fallback a todas si todas fueran warmup). */
export function getEffectiveSeriesIndices(exObj, totalSeries = null) {
  const labels = getSeriesVisualLabels(exObj, totalSeries);
  const effective = labels.filter((l) => !l.isWarmup).map((l) => l.si);
  return effective.length > 0 ? effective : labels.map((l) => l.si);
}

/** Cuenta series efectivas de un ejercicio (excluyendo series etiquetadas como calentamiento). */
export function countEffectiveSeries(exObj) {
  const labels = getSeriesVisualLabels(exObj);
  return labels.filter((l) => !l.isWarmup).length;
}

/** Calcula el volumen semanal de series efectivas por grupo muscular (solo ejercicios principales). */
export function computeWeeklyMuscleVolume(rutinasList = []) {
  const byMuscle = {};
  let totalEffectiveSets = 0;
  let totalWarmupSets = 0;

  (Array.isArray(rutinasList) ? rutinasList : []).forEach((r) => {
    (r?.ejercicios || []).forEach((ej) => {
      const labels = getSeriesVisualLabels(ej);
      const eff = labels.filter((l) => !l.isWarmup).length;
      const warm = labels.length - eff;
      totalEffectiveSets += eff;
      totalWarmupSets += warm;

      const grp = normalizeMuscleGroup(ej?.grupo_muscular) || "general";
      if (eff > 0) {
        byMuscle[grp] = (byMuscle[grp] || 0) + eff;
      }
    });
  });

  const muscleList = Object.entries(byMuscle)
    .map(([id, sets]) => ({
      id,
      label: GRUPO_LABELS[id] || id.replace(/_/g, " "),
      sets,
    }))
    .sort((a, b) => b.sets - a.sets);

  return { byMuscle, muscleList, totalEffectiveSets, totalWarmupSets };
}

/** Extrae el rango objetivo [min, max] de series por músculo desde `smartTrainingPrescription`. */
export function parseRecommendedVolumeRange(smartPrescription) {
  const str = String(smartPrescription?.volumenRpe || "");
  const match = str.match(/(\d+)\s*[-–]\s*(\d+)\s*series/i);
  if (match) {
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    if (!isNaN(min) && !isNaN(max) && max >= min) return { min, max };
  }
  return { min: 10, max: 16 };
}

/** Normaliza bloques de superserie/biserie para que todo bloque tenga >=2 ejercicios contiguos con letras A, B, C... */
export function normalizeSupersetBlocks(ejercicios = []) {
  if (!Array.isArray(ejercicios) || ejercicios.length === 0) return [];
  const list = ejercicios.map((e) => ({ ...e, bloque_grupo: e?.bloque_grupo ? String(e.bloque_grupo).trim() : null }));

  // Detectar carreras contiguas del mismo bloque_grupo; bloques de longitud 1 se limpian a null
  const runs = [];
  let idx = 0;
  while (idx < list.length) {
    const g = list[idx].bloque_grupo;
    if (!g) {
      runs.push({ start: idx, len: 1, group: null });
      idx++;
      continue;
    }
    let end = idx + 1;
    while (end < list.length && list[end].bloque_grupo === g) end++;
    runs.push({ start: idx, len: end - idx, group: end - idx >= 2 ? g : null });
    idx = end;
  }

  let letterCode = 65; // 'A'
  for (const run of runs) {
    const finalCode = run.group ? String.fromCharCode(letterCode++) : null;
    for (let k = run.start; k < run.start + run.len; k++) {
      list[k].bloque_grupo = finalCode;
    }
  }
  return list;
}

/** Formatea descanso sugerido en segundos (ej. 90 -> "1m 30s" o "90s"). */
export function formatRestLabel(seconds) {
  const s = parseInt(seconds, 10);
  if (!s || isNaN(s) || s <= 0) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m} min` : `${m}m ${rem}s`;
}

/** Devuelve el nombre legible de un bloque según cantidad de ejercicios contiguos. */
export function getSupersetShortKind(size) {
  if (size >= 4) return "Circuito";
  if (size === 3) return "Triserie";
  return "Biserie";
}

/** Calcula metadatos de bloques contiguos (A1, A2, cabecera de bloque, límites) alineados con `ejercicios`. */
export function computeSupersetMetadata(ejercicios = []) {
  if (!Array.isArray(ejercicios) || ejercicios.length === 0) return [];
  const meta = new Array(ejercicios.length);
  let idx = 0;

  while (idx < ejercicios.length) {
    const rawGroup = ejercicios[idx]?.bloque_grupo ? String(ejercicios[idx].bloque_grupo).trim() : "";
    let end = idx;
    if (rawGroup) {
      while (
        end + 1 < ejercicios.length &&
        String(ejercicios[end + 1]?.bloque_grupo || "").trim() === rawGroup
      ) {
        end++;
      }
    }
    const len = rawGroup ? end - idx + 1 : 1;
    if (rawGroup && len >= 2) {
      const shortKind = getSupersetShortKind(len);
      const blockTitle = `${shortKind} ${rawGroup}`;
      const blockCodesJoined = Array.from({ length: len }, (_, k) => `${rawGroup}${k + 1}`).join(" \u2194 ");
      for (let k = idx; k <= end; k++) {
        const pos = k - idx;
        meta[k] = {
          isMember: true,
          groupCode: rawGroup,
          isStart: k === idx,
          isEnd: k === end,
          posInBlock: pos,
          blockSize: len,
          codeLabel: `${rawGroup}${pos + 1}`,
          shortKind,
          blockTitle,
          blockCodesJoined,
          blockStartIdx: idx,
          blockEndIdx: end,
        };
      }
    } else {
      meta[idx] = {
        isMember: false,
        groupCode: null,
        isStart: false,
        isEnd: false,
        posInBlock: 0,
        blockSize: 1,
        codeLabel: String(idx + 1),
        shortKind: "",
        blockTitle: "",
        blockCodesJoined: "",
        blockStartIdx: idx,
        blockEndIdx: idx,
      };
    }
    idx = end + 1;
  }

  return meta;
}

/** Agrupa una lista de ejercicios en tarjetas únicas (`superset` o `single`) preservando su orden. */
export function groupExercisesIntoBlocks(ejercicios = []) {
  if (!Array.isArray(ejercicios) || ejercicios.length === 0) return [];
  const metaList = computeSupersetMetadata(ejercicios);
  const blocks = [];
  let i = 0;

  while (i < ejercicios.length) {
    const m = metaList[i];
    if (m?.isMember) {
      const items = [];
      for (let k = m.blockStartIdx; k <= m.blockEndIdx; k++) {
        items.push({ ex: ejercicios[k], index: k, meta: metaList[k] });
      }
      blocks.push({
        type: "superset",
        groupCode: m.groupCode,
        shortKind: m.shortKind,
        blockTitle: m.blockTitle,
        blockCodesJoined: m.blockCodesJoined,
        items,
      });
      i = m.blockEndIdx + 1;
    } else {
      blocks.push({
        type: "single",
        groupCode: null,
        shortKind: "",
        blockTitle: "",
        blockCodesJoined: "",
        items: [{ ex: ejercicios[i], index: i, meta: m }],
      });
      i++;
    }
  }

  return blocks;
}

/** Construye serie semanal (1RM Epley máximo y volumen efectivo) por ejercicio excluyendo calentamientos. */
export function buildExerciseChartSeries({
  ex,
  activeObj = null,
  variantId = "original",
  progreso = {},
  totalSemanas = 4,
  weightUnit = "kg",
}) {
  if (!ex) return { points: [], hasData: false, best1RMKg: 0, latest1RMKg: 0, totalVolumeKg: 0 };
  const targetObj = activeObj || ex;
  const nSeries = parseInt(targetObj?.num_series || ex.num_series, 10) || 4;
  const effectiveIdx = getEffectiveSeriesIndices(targetObj, nSeries);
  const factor = weightUnit === "lb" ? KG_TO_LB : 1;

  const rawPoints = [];
  let best1RMKg = 0;
  let latest1RMKg = 0;
  let totalVolumeKgAll = 0;
  let lastValidWeekIdx = -1;

  for (let w = 0; w < Math.max(1, totalSemanas); w++) {
    let weekMax1RMKg = 0;
    let weekVolumeKg = 0;
    let weekSets = 0;
    let weekBestWeightKg = 0;
    let weekBestReps = 0;
    const set1RMMap = {};

    for (const s of effectiveIdx) {
      const pRaw = progreso[`${ex.id}-${w}-${s}-peso-${variantId}`];
      const rRaw = progreso[`${ex.id}-${w}-${s}-reps-${variantId}`];
      const rStr = String(rRaw ?? "").trim();
      if (!rStr || rStr === "Falta") continue;
      const reps = parseFloat(rStr);
      const pesoKg = parseRawWeightToKg(pRaw);
      if (isNaN(reps) || reps <= 0 || pesoKg === null || pesoKg < 0) continue;

      weekSets++;
      if (pesoKg > 0) {
        weekVolumeKg += pesoKg * reps;
        const e1rm = calcEpley1RM(pesoKg, reps);
        if (e1rm > 0) {
          set1RMMap[`serie_${s}`] = Math.round(e1rm * factor * 10) / 10;
          if (e1rm > weekMax1RMKg) {
            weekMax1RMKg = e1rm;
            weekBestWeightKg = pesoKg;
            weekBestReps = reps;
          }
        }
      }
    }

    if (weekSets > 0) {
      lastValidWeekIdx = w;
      totalVolumeKgAll += weekVolumeKg;
      if (weekMax1RMKg > best1RMKg) best1RMKg = weekMax1RMKg;
      if (weekMax1RMKg > 0) latest1RMKg = weekMax1RMKg;
    }

    rawPoints.push({
      week: `Sem ${w + 1}`,
      weekIdx: w,
      hasData: weekSets > 0,
      max1RM: weekMax1RMKg > 0 ? Math.round(weekMax1RMKg * factor * 10) / 10 : null,
      max1RMKg: weekMax1RMKg,
      totalVolume: weekVolumeKg > 0 ? Math.round(weekVolumeKg * factor) : 0,
      totalVolumeKg: Math.round(weekVolumeKg),
      setsCount: weekSets,
      bestWeightDisplay: weekBestWeightKg > 0 ? Number((weekBestWeightKg * factor).toFixed(1)) : null,
      bestReps: weekBestReps || null,
      ...set1RMMap,
    });
  }

  const trimmed = lastValidWeekIdx === -1 ? [] : rawPoints.slice(0, lastValidWeekIdx + 1);
  return {
    points: trimmed,
    hasData: trimmed.length > 0,
    best1RMKg: Number(best1RMKg.toFixed(2)),
    latest1RMKg: Number(latest1RMKg.toFixed(2)),
    totalVolumeKg: Math.round(totalVolumeKgAll),
  };
}

const ROUTINE_WEEKDAY_MAP = {
  DOM: 0, DOMINGO: 0,
  LUN: 1, LUNES: 1,
  MAR: 2, MARTES: 2,
  MIE: 3, MIÉ: 3, MIERCOLES: 3, MIÉRCOLES: 3,
  JUE: 4, JUEVES: 4,
  VIE: 5, VIERNES: 5,
  SAB: 6, SÁB: 6, SABADO: 6, SÁBADO: 6,
};

function getRoutineJsWeekday(routine) {
  const parts = String(routine?.nombre || "").split("|");
  const rawTag = (parts.length > 1 ? parts[0] : parts[0] || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(ROUTINE_WEEKDAY_MAP, rawTag)
    ? ROUTINE_WEEKDAY_MAP[rawTag]
    : null;
}

function hasRoutineSessionArrived({ routine, routineIdx, totalRoutines, weekIdx, startStr, todayNoon }) {
  if (!startStr) return true;
  const inicioNoon = parseLocalDateNoon(startStr);
  const weekStart = new Date(inicioNoon.getFullYear(), inicioNoon.getMonth(), inicioNoon.getDate() + weekIdx * 7, 12, 0, 0, 0);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 12, 0, 0, 0);

  if (weekEnd.getTime() < todayNoon.getTime()) return true;
  if (weekStart.getTime() > todayNoon.getTime()) return false;

  const jsWeekday = getRoutineJsWeekday(routine);
  const offsetDays = jsWeekday !== null
    ? (jsWeekday - weekStart.getDay() + 7) % 7
    : (totalRoutines <= 1 ? 0 : Math.floor((routineIdx * 7) / totalRoutines));

  const sessionDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + offsetDays, 12, 0, 0, 0);
  return sessionDate.getTime() <= todayNoon.getTime();
}

/** Calcula KPIs globales del ciclo y por rutina para la vista Tracking del especialista (sin contar semanas/días futuros no trabajados). */
export function computeCycleTrainingKpis({
  rutinas = [],
  progreso = {},
  finalizedSessions = {},
  currentWeekIdx = 0,
  totalSemanas = 4,
  cycleStartDate = null,
}) {
  const safeRutinas = Array.isArray(rutinas) ? rutinas : [];
  const weeklyVol = computeWeeklyMuscleVolume(safeRutinas);
  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

  let expectedSetsToDate = 0;
  let completedSetsToDate = 0;
  let totalVolumeKg = 0;
  let activeSessionsCount = 0;
  let sealedSessionsCount = 0;
  let expectedSessions = 0;
  let prsCount = 0;
  const routineSummaries = {};
  const completedByMuscle = {};
  const expectedByMuscle = {};

  for (let rIdx = 0; rIdx < safeRutinas.length; rIdx++) {
    const r = safeRutinas[rIdx];
    const ejs = Array.isArray(r?.ejercicios) ? r.ejercicios : [];
    const weeksLen = Math.max(1, parseInt(r?.semanas || totalSemanas, 10) || 4);
    const rStartRaw = r?.fecha_inicio || cycleStartDate || r?.created_at;
    const rWeekInfo = rStartRaw
      ? getCurrentCycleWeekInfo(rStartRaw)
      : { currentCycleWeek: currentWeekIdx >= 0 ? currentWeekIdx + 1 : 1, isFuture: currentWeekIdx < 0 };
    const maxAllowedWeekIdx = rWeekInfo.isFuture
      ? -1
      : Math.min(weeksLen - 1, Math.max(0, (rWeekInfo.currentCycleWeek || 1) - 1));

    let rExpectedSets = 0;
    let rCompletedSets = 0;
    const sealedWeeks = [];

    for (let w = 0; w <= maxAllowedWeekIdx; w++) {
      const isSealed = Boolean(finalizedSessions?.[`${r.id}-${w + 1}`]?.finalizada);
      if (isSealed) {
        sealedSessionsCount++;
        sealedWeeks.push(w + 1);
      }

      let sessionHasCompleted = false;
      const sessionExpectedEntries = [];

      for (const ej of ejs) {
        const nSeries = parseInt(ej?.num_series, 10) || 4;
        const effIdx = getEffectiveSeriesIndices(ej, nSeries);
        const variantsList = [
          "original",
          ...(Array.isArray(ej?.alternativas) ? ej.alternativas.map((_, altI) => `alt_${altI}`) : []),
        ];
        const principalGrp = normalizeMuscleGroup(ej?.grupo_muscular) || "general";
        sessionExpectedEntries.push({ grp: principalGrp, count: effIdx.length });

        for (const s of effIdx) {
          let setCompleted = false;
          let setMaxVol = 0;
          let completedVid = "original";
          for (const vid of variantsList) {
            const rRaw = progreso[`${ej.id}-${w}-${s}-reps-${vid}`];
            const pRaw = progreso[`${ej.id}-${w}-${s}-peso-${vid}`];
            const rStr = String(rRaw ?? "").trim();
            if (!rStr || rStr === "Falta") continue;
            const rNum = parseFloat(rStr);
            const pKg = parseRawWeightToKg(pRaw);
            if (!isNaN(rNum) && rNum > 0 && pKg !== null && pKg >= 0) {
              if (!setCompleted) completedVid = vid;
              setCompleted = true;
              if (pKg > 0) setMaxVol = Math.max(setMaxVol, pKg * rNum);
            }
          }
          if (setCompleted) {
            sessionHasCompleted = true;
            rCompletedSets++;
            totalVolumeKg += setMaxVol;
            let completedGrp = principalGrp;
            if (completedVid !== "original") {
              const altIdxNum = parseInt(completedVid.replace("alt_", ""), 10);
              const altObj = !isNaN(altIdxNum) ? (ej?.alternativas || [])[altIdxNum] : null;
              if (altObj?.grupo_muscular) {
                completedGrp = normalizeMuscleGroup(altObj.grupo_muscular) || principalGrp;
              }
            }
            completedByMuscle[completedGrp] = (completedByMuscle[completedGrp] || 0) + 1;
          }
        }
      }

      const hasArrived = hasRoutineSessionArrived({
        routine: r,
        routineIdx: rIdx,
        totalRoutines: safeRutinas.length,
        weekIdx: w,
        startStr: rStartRaw,
        todayNoon,
      });
      const countsInExpected = hasArrived || sessionHasCompleted || isSealed;
      if (countsInExpected) {
        if (ejs.length > 0) expectedSessions++;
        for (const entry of sessionExpectedEntries) {
          rExpectedSets += entry.count;
          expectedByMuscle[entry.grp] = (expectedByMuscle[entry.grp] || 0) + entry.count;
        }
      }
      if (sessionHasCompleted) activeSessionsCount++;
    }

    // Contar mejoras de 1RM dentro del ciclo solo hasta la semana actual (sin semanas futuras)
    if (maxAllowedWeekIdx >= 1) {
      for (const ej of ejs) {
        const series = buildExerciseChartSeries({
          ex: ej,
          progreso,
          totalSemanas: maxAllowedWeekIdx + 1,
          weightUnit: "kg",
        });
        const valid1RMs = series.points.filter((pt) => pt.max1RMKg > 0).map((pt) => pt.max1RMKg);
        if (valid1RMs.length >= 2 && Math.max(...valid1RMs.slice(1)) > valid1RMs[0] + 0.1) {
          prsCount++;
        }
      }
    }

    expectedSetsToDate += rExpectedSets;
    completedSetsToDate += rCompletedSets;
    routineSummaries[r.id] = {
      expectedSets: rExpectedSets,
      completedSets: rCompletedSets,
      adherencePct: rExpectedSets > 0 ? Math.min(100, Math.round((rCompletedSets / rExpectedSets) * 100)) : 0,
      sealedWeeks,
    };
  }

  const adherenceSetsPct =
    expectedSetsToDate > 0
      ? Math.min(100, Math.round((completedSetsToDate / expectedSetsToDate) * 100))
      : 0;

  const muscleIds = new Set([...Object.keys(completedByMuscle), ...Object.keys(expectedByMuscle)]);
  const completedMuscleList = Array.from(muscleIds)
    .map((id) => ({
      id,
      label: GRUPO_LABELS[id] || id.replace(/_/g, " "),
      sets: completedByMuscle[id] || 0,
      expectedSets: expectedByMuscle[id] || 0,
    }))
    .filter((m) => m.sets > 0 || m.expectedSets > 0)
    .sort((a, b) => b.sets - a.sets || b.expectedSets - a.expectedSets);

  return {
    weeklyVol,
    completedByMuscle,
    completedMuscleList,
    expectedSetsToDate,
    completedSetsToDate,
    adherenceSetsPct,
    expectedSessions,
    activeSessionsCount,
    sealedSessionsCount,
    totalVolumeKg: Math.round(totalVolumeKg),
    prsCount,
    routineSummaries,
  };
}
