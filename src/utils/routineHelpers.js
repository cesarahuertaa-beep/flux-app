// Utilidades compartidas para rutinas híbridas (plano + por serie),
// migración de marcas reales entre ciclos y cálculo histórico de 1RM/PR.

const LB_TO_KG = 0.45359237;
const KG_TO_LB = 2.20462262;

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
      return {
        reps: !isNaN(r) && r > 0 ? r : null,
        peso: p,
      };
    });
}

/** Convierte series_detalle guardado en kg hacia strings editables en la unidad del modal ('kg' | 'lb'). */
export function seriesDetalleToForm(rawDetalle, numSeries, fallbackReps = 10, fallbackPesoInput = "", unit = "kg") {
  const list = normalizeSeriesDetalle(rawDetalle);
  if (list.length === 0) return [];
  const count = Math.max(1, parseInt(numSeries, 10) || list.length || 4);
  return Array.from({ length: count }, (_, idx) => {
    const item = list[idx];
    return {
      reps: item?.reps != null ? String(item.reps) : String(fallbackReps || 10),
      peso: item?.peso != null ? convertWeightToInput(item.peso, unit) : String(fallbackPesoInput || ""),
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
    return {
      reps: !isNaN(r) && r > 0 ? r : null,
      peso: convertInputWeightToKg(s.peso, unit),
    };
  });
}

/** Verifica si el desglose por serie tiene valores distintos entre sí (justifica persistir detalle). */
export function hasCustomSeriesBreakdown(seriesList, scalarReps, scalarPesoKg) {
  if (!Array.isArray(seriesList) || seriesList.length === 0) return false;
  const refReps = parseInt(scalarReps, 10) || null;
  const refPeso = parseRawWeightToKg(scalarPesoKg);
  return seriesList.some((s) => {
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
  const item = list[serieIdx];
  const reps = item?.reps != null ? String(item.reps) : String(exObj?.reps_sugeridas || "10");
  const peso =
    item?.peso !== null && item?.peso !== undefined && item?.peso !== ""
      ? String(item.peso)
      : exObj?.peso_sugerido !== null && exObj?.peso_sugerido !== undefined && exObj?.peso_sugerido !== ""
      ? String(exObj.peso_sugerido)
      : "-";
  return { reps, peso };
}

function groupProgressRowsByWeek(rows) {
  const byWeek = new Map();
  for (const r of rows) {
    const w = parseInt(r.semana, 10);
    const s = parseInt(r.serie, 10);
    if (isNaN(w) || isNaN(s) || w < 0 || s < 0) continue;
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

function extractMarksFromRowsByMode(rows, numSeries, fallbackReps = 10, fallbackPesoKg = null, mode = "latest") {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const count = Math.max(1, parseInt(numSeries, 10) || 4);
  const byWeek = groupProgressRowsByWeek(rows);
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
    let lastValidSet = null;
    const seriesMarks = [];

    for (let si = 0; si < count; si++) {
      const cell = bestSession.wMap.get(si);
      const hasCell = cell && (cell.reps != null || cell.peso != null);
      const finalReps = hasCell && cell.reps != null ? cell.reps : (lastValidSet?.reps ?? (parseInt(fallbackReps, 10) || 10));
      const finalPeso = hasCell && cell.peso != null ? cell.peso : (lastValidSet ? lastValidSet.peso : fallbackKg);
      const entry = { reps: finalReps, peso: finalPeso };
      if (hasCell && (cell.reps > 0 || (cell.peso != null && cell.peso >= 0))) lastValidSet = entry;
      seriesMarks.push(entry);
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

/** Extrae las últimas marcas reales alcanzadas a partir de filas de `progreso` (ignora "Falta" y vacíos). */
export function extractLatestMarksFromRows(rows, numSeries, fallbackReps = 10, fallbackPesoKg = null) {
  return extractMarksFromRowsByMode(rows, numSeries, fallbackReps, fallbackPesoKg, "latest");
}

/** Extrae la mejor sesión/marca histórica alcanzada en `progreso` (por 1RM, carga, volumen y reps). */
export function extractBestMarksFromRows(rows, numSeries, fallbackReps = 10, fallbackPesoKg = null) {
  return extractMarksFromRowsByMode(rows, numSeries, fallbackReps, fallbackPesoKg, "best");
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

  const progByEjVar = new Map();
  const best1RMByEjId = new Map();
  const setPairs = new Map();

  for (const r of allProgresoRows) {
    const vid = r.variante_id || "original";
    const k = `${r.ejercicio_id}:${vid}`;
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
      const nSeries = parseInt(ej.num_series, 10) || 4;
      const variants = [
        { vid: "original", obj: ej },
        ...(Array.isArray(ej.alternativas) ? ej.alternativas.map((alt, idx) => ({ vid: `alt_${idx}`, obj: alt })) : []),
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
  if (obj.biblioteca_id && map[`bib:${obj.biblioteca_id}`]) {
    return map[`bib:${obj.biblioteca_id}`];
  }
  const nameNorm = normalizeExerciseName(obj.nombre);
  if (nameNorm && map[`name:${nameNorm}`]) {
    return map[`name:${nameNorm}`];
  }
  return null;
}

/** Aplica migración de mejores marcas reales sobre un ejercicio clonado (principal + alternativas). */
export function migrateClonedExerciseWithProgress(oldEj, progRowsByEjVar) {
  const nSeries = parseInt(oldEj.num_series || oldEj.series, 10) || 4;
  const origRows = progRowsByEjVar.get(`${oldEj.id}:original`) || [];
  const origMigrated = extractBestMarksFromRows(origRows, nSeries, oldEj.reps_sugeridas, oldEj.peso_sugerido);

  const migratedAlts = (oldEj.alternativas || []).map((alt, idx) => {
    const altRows = progRowsByEjVar.get(`${oldEj.id}:alt_${idx}`) || [];
    const altMigrated = extractBestMarksFromRows(altRows, nSeries, alt.reps_sugeridas ?? oldEj.reps_sugeridas, alt.peso_sugerido ?? oldEj.peso_sugerido);
    if (!altMigrated) {
      return {
        ...alt,
        peso_sugerido: parseRawWeightToKg(alt.peso_sugerido),
        series_detalle: normalizeSeriesDetalle(alt.series_detalle),
      };
    }
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
