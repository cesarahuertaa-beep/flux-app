/**
 * Motor Clínico de Composición Corporal y Prescripción Energética (FLUX)
 * Soporta evaluación progresiva en 3 capas:
 *  1. Básico (IMC, ICC, ICE, US Navy opcional)
 *  2. Plicometría / Antropometría:
 *     - Jackson-Pollock 3 pliegues + Siri ('plicometria_jp3')
 *     - Durnin-Womersley 4 pliegues + Siri ('plicometria_dw4')
 *     - ISAK Completo 4 componentes + Somatotipo Heath-Carter ('manual' / 'plicometria_isak')
 *  3. Bioimpedancia / InBody ('inbody')
 *
 * Incluye además el motor de cálculo metabólico (TMB, GET y distribución de macronutrientes).
 */

const META_MARKER = "\n<!--FLUX_EVAL_META:";
const META_END = "-->";

/**
 * Normaliza el género/sexo proveniente de `clientes.genero` ("Masculino"/"Femenino") o códigos ("M"/"F").
 * @param {string} raw
 * @returns {'M'|'F'}
 */
export function normalizeSexo(raw) {
  if (!raw) return "M";
  const s = String(raw).trim().toUpperCase();
  if (s.startsWith("F") || s === "MUJER") return "F";
  return "M";
}

/**
 * Calcula la edad exacta en años cumplidos a partir de `fecha_nacimiento` (YYYY-MM-DD).
 * @param {string} fechaNacimiento
 * @param {number} fallback
 * @returns {number}
 */
export function calcEdadFromBirthdate(fechaNacimiento, fallback = 25) {
  if (!fechaNacimiento) return fallback;
  const birth = new Date(
    fechaNacimiento.includes("T") ? fechaNacimiento : `${fechaNacimiento}T12:00:00`
  );
  if (isNaN(birth.getTime())) return fallback;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 && age < 120 ? age : fallback;
}

/**
 * Clasificación clínica de IMC según criterios OMS.
 */
export function classifyIMC(imc) {
  const val = parseFloat(imc);
  if (!val || isNaN(val)) return null;
  if (val < 18.5) return { label: "Bajo peso", tone: "amber" };
  if (val < 25.0) return { label: "Normopeso", tone: "emerald" };
  if (val < 30.0) return { label: "Sobrepeso", tone: "amber" };
  if (val < 35.0) return { label: "Obesidad I", tone: "rose" };
  if (val < 40.0) return { label: "Obesidad II", tone: "rose" };
  return { label: "Obesidad III", tone: "rose" };
}

/**
 * Clasificación de riesgo cardiometabólico por ICC (Índice Cintura-Cadera).
 */
export function classifyICC(icc, sexo = "M") {
  const val = parseFloat(icc);
  if (!val || isNaN(val)) return null;
  const s = normalizeSexo(sexo);
  if (s === "M") {
    if (val < 0.9) return { label: "Riesgo bajo", tone: "emerald" };
    if (val < 1.0) return { label: "Riesgo moderado", tone: "amber" };
    return { label: "Riesgo alto", tone: "rose" };
  } else {
    if (val < 0.8) return { label: "Riesgo bajo", tone: "emerald" };
    if (val < 0.85) return { label: "Riesgo moderado", tone: "amber" };
    return { label: "Riesgo alto", tone: "rose" };
  }
}

/**
 * Etiqueta legible para cada método/protocolo de evaluación.
 */
export function getMetodoLabel(metodo) {
  switch (metodo) {
    case "basico":
      return "Básico";
    case "plicometria_jp3":
      return "J-P 3 Pliegues";
    case "plicometria_dw4":
      return "D-W 4 Pliegues";
    case "plicometria_isak":
    case "manual":
      return "ISAK Completo";
    case "inbody":
      return "Bioimpedancia";
    default:
      return "Manual";
  }
}

/**
 * Extrae metadatos extendidos embebidos silenciosamente en `notas` (como cuello, pliegue_pectoral, ice, masa_libre_grasa)
 * sin alterar el esquema de columnas de PostgreSQL `metricas_progreso`.
 */
export function unpackMetricaMeta(notasRaw) {
  if (!notasRaw || typeof notasRaw !== "string") {
    return { cleanNotas: notasRaw || "", meta: {} };
  }
  const idx = notasRaw.indexOf(META_MARKER);
  if (idx === -1) {
    return { cleanNotas: notasRaw, meta: {} };
  }
  const cleanNotas = notasRaw.slice(0, idx);
  const rest = notasRaw.slice(idx + META_MARKER.length);
  const endIdx = rest.indexOf(META_END);
  const jsonStr = endIdx !== -1 ? rest.slice(0, endIdx) : rest;
  try {
    const meta = JSON.parse(jsonStr);
    return { cleanNotas, meta: meta && typeof meta === "object" ? meta : {} };
  } catch {
    return { cleanNotas, meta: {} };
  }
}

/**
 * Empaqueta notas limpias + metadatos extendidos en el string `notas`.
 */
export function packMetricaNotas(cleanNotas, meta = {}) {
  const base = (cleanNotas || "").trim();
  const cleanMeta = {};
  Object.entries(meta || {}).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") {
      cleanMeta[k] = v;
    }
  });
  if (Object.keys(cleanMeta).length === 0) return base || null;
  return `${base}${META_MARKER}${JSON.stringify(cleanMeta)}${META_END}`;
}

export const DB_METRICA_COLUMNS = new Set([
  "cliente_id",
  "fecha",
  "metodo_evaluacion",
  "peso",
  "estatura",
  "imc",
  "pliegue_triceps",
  "pliegue_subescapular",
  "pliegue_suprailiaco",
  "pliegue_abdominal",
  "pliegue_muslo",
  "pliegue_pantorrilla",
  "pliegue_pectoral",
  "pliegue_biceps",
  "cuello",
  "cintura",
  "cadera",
  "pecho",
  "brazo_relajado",
  "brazo_contraido",
  "muslo",
  "pantorrilla",
  "diametro_muneca",
  "diametro_codo",
  "diametro_rodilla",
  "inbody_smm",
  "inbody_tbw",
  "inbody_proteina",
  "inbody_mineral_oseo",
  "inbody_grasa_visceral",
  "inbody_bmr",
  "inbody_score",
  "inbody_magra_brazo_der",
  "inbody_magra_brazo_izq",
  "inbody_magra_pierna_der",
  "inbody_magra_pierna_izq",
  "inbody_magra_tronco",
  "calc_masa_grasa",
  "calc_masa_muscular",
  "calc_masa_osea",
  "calc_masa_residual",
  "somatotipo_x",
  "somatotipo_y",
  "grasa_pct",
  "musculo_pct",
  "icc",
  "glucosa",
  "presion_arterial",
  "notas",
  "fotos",
]);

/**
 * Enriquece un registro de `metricas_progreso` proveniente de la BD con campos derivados (`ice`, `masa_libre_grasa`, `somatotipo_endo/meso/ecto`, ` cleanNotas`).
 */
export function enrichMetrica(m) {
  if (!m || typeof m !== "object") return m;
  const rawNotasStr = typeof m._rawNotas === "string" ? m._rawNotas : m.notas;
  const { cleanNotas, meta } = unpackMetricaMeta(rawNotasStr);
  const peso = parseFloat(m.peso) || 0;
  const estatura = parseFloat(m.estatura) || 0;
  const cintura = parseFloat(m.cintura) || 0;
  const grasaPct = parseFloat(m.grasa_pct ?? m.inbody_pbf) || 0;
  const masaGrasa =
    parseFloat(m.calc_masa_grasa ?? m.inbody_grasa_masa) ||
    (peso > 0 && grasaPct > 0 ? Number(((peso * grasaPct) / 100).toFixed(2)) : 0);
  const mlg =
    parseFloat(meta.masa_libre_grasa) ||
    (peso > 0 && masaGrasa > 0 && peso > masaGrasa
      ? Number((peso - masaGrasa).toFixed(2))
      : null);
  const ice =
    parseFloat(meta.ice) ||
    (cintura > 0 && estatura > 0 ? Number((cintura / estatura).toFixed(2)) : null);

  return {
    ...m,
    ...meta,
    ciclo_id: m.ciclo_id || meta.ciclo_id || null,
    notas: cleanNotas,
    _rawNotas: rawNotasStr,
    metodo_evaluacion: m.metodo_evaluacion || meta.metodo_evaluacion || null,
    cuello: m.cuello ?? meta.cuello ?? "",
    pliegue_pectoral: m.pliegue_pectoral ?? meta.pliegue_pectoral ?? "",
    ice: ice ?? "",
    masa_libre_grasa: mlg ?? "",
    sum_pliegues: meta.sum_pliegues ?? m.sum_pliegues ?? "",
    somatotipo_endo: meta.somatotipo_endo ?? m.somatotipo_endo ?? "",
    somatotipo_meso: meta.somatotipo_meso ?? m.somatotipo_meso ?? "",
    somatotipo_ecto: meta.somatotipo_ecto ?? m.somatotipo_ecto ?? "",
    checkin_energia: meta.checkin_energia ?? m.checkin_energia ?? "",
    checkin_saciedad: meta.checkin_saciedad ?? m.checkin_saciedad ?? "",
    checkin_digestion: meta.checkin_digestion ?? m.checkin_digestion ?? "",
    checkin_descanso: meta.checkin_descanso ?? m.checkin_descanso ?? "",
    checkin_observaciones: meta.checkin_observaciones ?? m.checkin_observaciones ?? "",
    checkin_ajustes: meta.checkin_ajustes ?? m.checkin_ajustes ?? "",
    eval_objetivo: meta.eval_objetivo ?? m.eval_objetivo ?? "",
    eval_faf: meta.eval_faf ?? m.eval_faf ?? "",
    preferencias_alimentos: meta.preferencias_alimentos ?? m.preferencias_alimentos ?? "",
    aversiones_alimentos: meta.aversiones_alimentos ?? m.aversiones_alimentos ?? "",
    r24h_desayuno: meta.r24h_desayuno ?? m.r24h_desayuno ?? "",
    r24h_colacion_m: meta.r24h_colacion_m ?? m.r24h_colacion_m ?? "",
    r24h_comida: meta.r24h_comida ?? m.r24h_comida ?? "",
    r24h_colacion_v: meta.r24h_colacion_v ?? m.r24h_colacion_v ?? "",
    r24h_cena: meta.r24h_cena ?? m.r24h_cena ?? "",
    r24h_picoteos: meta.r24h_picoteos ?? m.r24h_picoteos ?? "",
    horas_sueno: meta.horas_sueno ?? m.horas_sueno ?? "",
    consumo_agua_estimado: meta.consumo_agua_estimado ?? m.consumo_agua_estimado ?? "",
    nivel_estres: meta.nivel_estres ?? m.nivel_estres ?? "3",
    dias_ejercicio_actual: meta.dias_ejercicio_actual ?? m.dias_ejercicio_actual ?? "",
    horario_ejercicio: meta.horario_ejercicio ?? m.horario_ejercicio ?? "",
  };
}

/**
 * Vincula evaluaciones corporales a sus respectivos planes/ciclos.
 * Si una métrica ya tiene `ciclo_id`, se respeta.
 * Si no lo tiene (métrica previa/legada), se asocia cronológicamente al ciclo correspondiente
 * para que no contamine nuevos planes futuros.
 */
export function linkMetricasToCiclos(metricasList, ciclosList) {
  if (!Array.isArray(metricasList) || metricasList.length === 0) return [];
  if (!Array.isArray(ciclosList) || ciclosList.length === 0) return metricasList;

  // Ordenar ciclos cronológicamente (del más antiguo al más reciente)
  const sortedCycles = [...ciclosList].sort((a, b) => {
    const tA = new Date(a.created_at || a.fecha_inicio || 0).getTime();
    const tB = new Date(b.created_at || b.fecha_inicio || 0).getTime();
    return tA - tB;
  });

  return metricasList.map(m => {
    if (m.ciclo_id) return m;

    if (sortedCycles.length === 1) {
      return { ...m, ciclo_id: sortedCycles[0].id };
    }

    const evalTime = new Date((m.fecha ? m.fecha + "T12:00:00" : m.created_at) || 0).getTime();
    let matchedCycle = sortedCycles[0];
    for (const c of sortedCycles) {
      const cycleTime = new Date(c.created_at || c.fecha_inicio || 0).getTime();
      if (cycleTime <= evalTime) {
        matchedCycle = c;
      } else {
        break;
      }
    }
    return { ...m, ciclo_id: matchedCycle.id };
  });
}

/**
 * Prepara el payload limpio para `dbPost`/`dbPatch` en `metricas_progreso`,
 * garantizando que solo se envíen columnas existentes en PostgreSQL y empaquetando
 * los indicadores extendidos en `notas`.
 */
export function prepareMetricaPayload(rawData, calcResult = {}) {
  const merged = {};
  const extraMeta = {};

  // Campos de rawData: si pertenecen a la BD van a merged, si son extendidos van a extraMeta
  Object.entries(rawData || {}).forEach(([k, v]) => {
    if (v === "" || v === null || v === undefined) return;
    if (DB_METRICA_COLUMNS.has(k)) {
      merged[k] = v;
    } else {
      extraMeta[k] = v;
    }
  });

  // Metadatos críticos que SIEMPRE deben preservarse en notas (incluso si son columna de BD)
  if (rawData.ciclo_id) extraMeta.ciclo_id = rawData.ciclo_id;
  if (rawData.metodo_evaluacion) extraMeta.metodo_evaluacion = rawData.metodo_evaluacion;
  if (rawData.evalSexo) extraMeta.sexo = rawData.evalSexo;
  if (rawData.evalEdad) extraMeta.edad = rawData.evalEdad;
  if (rawData.cuello !== undefined && rawData.cuello !== "") extraMeta.cuello = rawData.cuello;
  if (rawData.pliegue_pectoral !== undefined && rawData.pliegue_pectoral !== "") extraMeta.pliegue_pectoral = rawData.pliegue_pectoral;
  if (rawData.checkin_observaciones !== undefined && rawData.checkin_observaciones !== "") extraMeta.checkin_observaciones = rawData.checkin_observaciones;
  if (rawData.checkin_ajustes !== undefined && rawData.checkin_ajustes !== "") extraMeta.checkin_ajustes = rawData.checkin_ajustes;
  if (rawData.checkin_energia !== undefined && rawData.checkin_energia !== "") extraMeta.checkin_energia = rawData.checkin_energia;
  if (rawData.checkin_saciedad !== undefined && rawData.checkin_saciedad !== "") extraMeta.checkin_saciedad = rawData.checkin_saciedad;
  if (rawData.checkin_digestion !== undefined && rawData.checkin_digestion !== "") extraMeta.checkin_digestion = rawData.checkin_digestion;
  if (rawData.eval_objetivo !== undefined && rawData.eval_objetivo !== "") extraMeta.eval_objetivo = rawData.eval_objetivo;
  if (rawData.eval_faf !== undefined && rawData.eval_faf !== "") extraMeta.eval_faf = rawData.eval_faf;
  if (rawData.preferencias_alimentos !== undefined && rawData.preferencias_alimentos !== "") extraMeta.preferencias_alimentos = rawData.preferencias_alimentos;
  if (rawData.aversiones_alimentos !== undefined && rawData.aversiones_alimentos !== "") extraMeta.aversiones_alimentos = rawData.aversiones_alimentos;
  if (rawData.r24h_desayuno !== undefined && rawData.r24h_desayuno !== "") extraMeta.r24h_desayuno = rawData.r24h_desayuno;
  if (rawData.r24h_colacion_m !== undefined && rawData.r24h_colacion_m !== "") extraMeta.r24h_colacion_m = rawData.r24h_colacion_m;
  if (rawData.r24h_comida !== undefined && rawData.r24h_comida !== "") extraMeta.r24h_comida = rawData.r24h_comida;
  if (rawData.r24h_colacion_v !== undefined && rawData.r24h_colacion_v !== "") extraMeta.r24h_colacion_v = rawData.r24h_colacion_v;
  if (rawData.r24h_cena !== undefined && rawData.r24h_cena !== "") extraMeta.r24h_cena = rawData.r24h_cena;
  if (rawData.r24h_picoteos !== undefined && rawData.r24h_picoteos !== "") extraMeta.r24h_picoteos = rawData.r24h_picoteos;
  if (rawData.horas_sueno !== undefined && rawData.horas_sueno !== "") extraMeta.horas_sueno = rawData.horas_sueno;
  if (rawData.consumo_agua_estimado !== undefined && rawData.consumo_agua_estimado !== "") extraMeta.consumo_agua_estimado = rawData.consumo_agua_estimado;
  if (rawData.nivel_estres !== undefined && rawData.nivel_estres !== "") extraMeta.nivel_estres = rawData.nivel_estres;

  Object.entries(calcResult || {}).forEach(([k, v]) => {
    if (k === "imc_info" || k === "icc_info") return;
    if (v === "" || v === null || v === undefined) return;
    if (DB_METRICA_COLUMNS.has(k)) {
      const n = parseFloat(v);
      merged[k] = isNaN(n) ? v : n;
    } else {
      extraMeta[k] = v;
    }
  });

  const { cleanNotas } = unpackMetricaMeta(merged.notas || "");
  const packedNotas = packMetricaNotas(cleanNotas, extraMeta);
  if (packedNotas) {
    merged.notas = packedNotas;
  } else {
    delete merged.notas;
  }

  const finalPayload = {};
  Object.entries(merged).forEach(([k, v]) => {
    if (DB_METRICA_COLUMNS.has(k) && v !== "" && v !== null && v !== undefined) {
      finalPayload[k] = v;
    }
  });
  return finalPayload;
}

/**
 * Constantes de densidad corporal de Durnin y Womersley (1974) por sexo y rango de edad.
 */
function getDurninWomersleyConstants(sexo, edad) {
  const s = normalizeSexo(sexo);
  const e = Number(edad) || 25;
  if (s === "M") {
    if (e < 20) return { c: 1.162, m: 0.063 };
    if (e <= 29) return { c: 1.1631, m: 0.0632 };
    if (e <= 39) return { c: 1.1422, m: 0.0544 };
    if (e <= 49) return { c: 1.162, m: 0.07 };
    return { c: 1.1715, m: 0.0779 };
  } else {
    if (e < 20) return { c: 1.1549, m: 0.0678 };
    if (e <= 29) return { c: 1.1599, m: 0.0717 };
    if (e <= 39) return { c: 1.1423, m: 0.0632 };
    if (e <= 49) return { c: 1.1333, m: 0.0612 };
    return { c: 1.1339, m: 0.0645 };
  }
}

/**
 * Calcula la composición corporal según la capa/protocolo seleccionado.
 * @param {Object} data - Formulario de evaluación
 * @param {string} sexoInput - 'M'/'F' o 'Masculino'/'Femenino'
 * @param {number} edadInput - Edad en años
 */
export function calculateBodyComposition(data, sexoInput = "M", edadInput = 25) {
  const sexo = normalizeSexo(sexoInput);
  const edad = Number(edadInput) > 0 ? Number(edadInput) : 25;
  const metodo = data?.metodo_evaluacion || "manual";
  const result = {};

  const peso = parseFloat(data?.peso) || 0;
  const estatura = parseFloat(data?.estatura) || 0; // cm
  const cintura = parseFloat(data?.cintura) || 0; // cm
  const cadera = parseFloat(data?.cadera) || 0; // cm
  const cuello = parseFloat(data?.cuello) || 0; // cm

  // ── 1. Indicadores Antropométricos Base (Todas las capas) ──
  if (peso > 0 && estatura > 0) {
    const estM = estatura / 100;
    const imc = peso / (estM * estM);
    result.imc = imc.toFixed(1);
    result.imc_info = classifyIMC(imc);
  }

  if (cintura > 0 && cadera > 0) {
    const icc = cintura / cadera;
    result.icc = icc.toFixed(2);
    result.icc_info = classifyICC(icc, sexo);
  }

  if (cintura > 0 && estatura > 0) {
    result.ice = (cintura / estatura).toFixed(2);
  }

  // ── CAPA 3: BIOIMPEDANCIA / INBODY ──
  if (metodo === "inbody") {
    const pbf = parseFloat(data?.inbody_pbf ?? data?.grasa_pct) || 0;
    const fatKg =
      parseFloat(data?.inbody_grasa_masa ?? data?.calc_masa_grasa) ||
      (peso > 0 && pbf > 0 ? (peso * pbf) / 100 : 0);
    const smmKg = parseFloat(data?.inbody_smm ?? data?.calc_masa_muscular) || 0;

    if (pbf > 0) result.grasa_pct = pbf.toFixed(1);
    else if (peso > 0 && fatKg > 0) result.grasa_pct = ((fatKg / peso) * 100).toFixed(1);

    if (fatKg > 0) result.calc_masa_grasa = fatKg.toFixed(2);
    if (smmKg > 0) {
      result.calc_masa_muscular = smmKg.toFixed(2);
      if (peso > 0) result.musculo_pct = ((smmKg / peso) * 100).toFixed(1);
    }
    if (peso > 0 && fatKg > 0 && peso > fatKg) {
      result.masa_libre_grasa = (peso - fatKg).toFixed(2);
    }
    return result;
  }

  // ── CAPA 1: BÁSICO (Consultorio General / Seguimiento Rápido) ──
  if (metodo === "basico") {
    let pctGrasa = parseFloat(data?.grasa_pct) || 0;

    // Si no se ingresó % grasa manual pero hay circunferencias para ecuación US Navy:
    if (pctGrasa <= 0 && estatura > 0 && cintura > 0 && cuello > 0) {
      if (sexo === "M" && cintura > cuello) {
        const navy =
          495 /
            (1.0324 -
              0.19077 * Math.log10(cintura - cuello) +
              0.15456 * Math.log10(estatura)) -
          450;
        if (navy > 2 && navy < 65) pctGrasa = navy;
      } else if (sexo === "F" && cadera > 0 && cintura + cadera > cuello) {
        const navy =
          495 /
            (1.29579 -
              0.35004 * Math.log10(cintura + cadera - cuello) +
              0.221 * Math.log10(estatura)) -
          450;
        if (navy > 5 && navy < 70) pctGrasa = navy;
      }
    }

    if (pctGrasa > 0) {
      result.grasa_pct = pctGrasa.toFixed(1);
      if (peso > 0) {
        const masaGrasa = peso * (pctGrasa / 100);
        result.calc_masa_grasa = masaGrasa.toFixed(2);
        result.masa_libre_grasa = Math.max(0, peso - masaGrasa).toFixed(2);
      }
    }
    return result;
  }

  // ── CAPA 2A: JACKSON-POLLOCK 3 PLIEGUES ('plicometria_jp3') ──
  const pTricipital =
    parseFloat(data?.pliegue_triceps ?? data?.pliegue_tricipital) || 0;
  const pSubescapular = parseFloat(data?.pliegue_subescapular) || 0;
  const pSuprailiaco = parseFloat(data?.pliegue_suprailiaco) || 0;
  const pAbdominal = parseFloat(data?.pliegue_abdominal) || 0;
  const pMuslo = parseFloat(data?.pliegue_muslo) || 0;
  const pPantorrilla = parseFloat(data?.pliegue_pantorrilla) || 0;
  const pBicipital =
    parseFloat(data?.pliegue_biceps ?? data?.pliegue_bicipital) || 0;
  const pPectoral = parseFloat(data?.pliegue_pectoral) || pBicipital || 0;

  if (metodo === "plicometria_jp3") {
    const sum3 =
      sexo === "M"
        ? pPectoral + pAbdominal + pMuslo
        : pTricipital + pSuprailiaco + pMuslo;

    if (sum3 > 0) {
      result.sum_pliegues = sum3.toFixed(1);
      const dc =
        sexo === "M"
          ? 1.10938 -
            0.0008267 * sum3 +
            0.0000016 * sum3 * sum3 -
            0.0002574 * edad
          : 1.0994921 -
            0.0009929 * sum3 +
            0.0000023 * sum3 * sum3 -
            0.0001392 * edad;

      if (dc > 0.9 && dc < 1.2) {
        const pctGrasa = Math.max(2, (4.95 / dc - 4.5) * 100);
        result.grasa_pct = pctGrasa.toFixed(1);
        if (peso > 0) {
          const masaGrasa = peso * (pctGrasa / 100);
          result.calc_masa_grasa = masaGrasa.toFixed(2);
          result.masa_libre_grasa = Math.max(0, peso - masaGrasa).toFixed(2);
        }
      }
    }
    return result;
  }

  // ── CAPA 2B: DURNIN-WOMERSLEY 4 PLIEGUES ('plicometria_dw4') ──
  if (metodo === "plicometria_dw4") {
    const sum4 = pBicipital + pTricipital + pSubescapular + pSuprailiaco;
    if (sum4 > 0) {
      result.sum_pliegues = sum4.toFixed(1);
      const { c, m } = getDurninWomersleyConstants(sexo, edad);
      const dc = c - m * Math.log10(sum4);
      if (dc > 0.9 && dc < 1.2) {
        const pctGrasa = Math.max(2, (4.95 / dc - 4.5) * 100);
        result.grasa_pct = pctGrasa.toFixed(1);
        if (peso > 0) {
          const masaGrasa = peso * (pctGrasa / 100);
          result.calc_masa_grasa = masaGrasa.toFixed(2);
          result.masa_libre_grasa = Math.max(0, peso - masaGrasa).toFixed(2);
        }
      }
    }
    return result;
  }

  // ── CAPA 2C: ISAK COMPLETO / MANUAL (Fraccionamiento 4 Componentes + Heath-Carter) ──
  const sum6 =
    pTricipital + pSubescapular + pSuprailiaco + pAbdominal + pMuslo + pPantorrilla;
  let pctGrasa = 0;

  if (sum6 > 0) {
    result.sum_pliegues = sum6.toFixed(1);
    if (sexo === "M") {
      pctGrasa = 0.1051 * sum6 + 2.585; // Yuhasz Hombres
    } else {
      pctGrasa = 0.1548 * sum6 + 3.58; // Yuhasz Mujeres
    }
    result.grasa_pct = pctGrasa.toFixed(1);
  } else if (data?.grasa_pct) {
    pctGrasa = parseFloat(data.grasa_pct) || 0;
  }

  let masaGrasa = 0;
  if (peso > 0 && pctGrasa > 0) {
    masaGrasa = peso * (pctGrasa / 100);
    result.calc_masa_grasa = masaGrasa.toFixed(2);
    result.masa_libre_grasa = Math.max(0, peso - masaGrasa).toFixed(2);
  }

  // Masa Ósea (Rocha)
  const dMuneca = parseFloat(data?.diametro_muneca) || 0; // cm
  const dRodilla = parseFloat(data?.diametro_rodilla) || 0; // cm
  let masaOsea = 0;

  if (estatura > 0 && dMuneca > 0 && dRodilla > 0) {
    const estM = estatura / 100;
    const rM = dMuneca / 100;
    const fM = dRodilla / 100;
    masaOsea = 3.02 * Math.pow(estM * estM * rM * fM * 400, 0.712);
    result.calc_masa_osea = masaOsea.toFixed(2);
  }

  // Masa Residual (Wurch)
  let masaResidual = 0;
  if (peso > 0) {
    const factorWurch = sexo === "M" ? 0.241 : 0.209;
    masaResidual = peso * factorWurch;
    result.calc_masa_residual = masaResidual.toFixed(2);
  }

  // Masa Muscular (Fraccionamiento de 4 componentes)
  if (peso > 0 && masaGrasa > 0 && masaOsea > 0 && masaResidual > 0) {
    const masaMuscular = peso - (masaGrasa + masaOsea + masaResidual);
    if (masaMuscular > 0) {
      result.calc_masa_muscular = masaMuscular.toFixed(2);
      result.musculo_pct = ((masaMuscular / peso) * 100).toFixed(1);
    }
  }

  // Somatotipo de Heath-Carter
  const dCodo = parseFloat(data?.diametro_codo) || 0;
  const pBrazoContraido = parseFloat(data?.brazo_contraido) || 0;
  const cPantorrilla = parseFloat(data?.pantorrilla) || 0;

  // Endomorfia
  let endo = 0;
  if (estatura > 0 && pTricipital > 0 && pSubescapular > 0 && pSuprailiaco > 0) {
    const sum3Endo = pTricipital + pSubescapular + pSuprailiaco;
    const X = sum3Endo * (170.18 / estatura);
    endo = -0.7182 + 0.1451 * X - 0.00068 * Math.pow(X, 2) + 0.0000014 * Math.pow(X, 3);
    endo = Math.max(0.1, endo);
    result.somatotipo_endo = endo.toFixed(1);
  }

  // Mesomorfia
  let meso = 0;
  if (
    estatura > 0 &&
    dCodo > 0 &&
    dRodilla > 0 &&
    pBrazoContraido > 0 &&
    cPantorrilla > 0
  ) {
    const pbc = pBrazoContraido - pTricipital / 10;
    const ppc = cPantorrilla - pPantorrilla / 10;
    meso =
      0.858 * dCodo +
      0.601 * dRodilla +
      0.188 * pbc +
      0.161 * ppc -
      0.131 * estatura +
      4.5;
    meso = Math.max(0.1, meso);
    result.somatotipo_meso = meso.toFixed(1);
  }

  // Ectomorfia
  let ecto = 0;
  if (peso > 0 && estatura > 0) {
    const cap = estatura / Math.pow(peso, 1 / 3);
    if (cap >= 40.75) {
      ecto = 0.732 * cap - 28.58;
    } else if (cap > 38.25 && cap < 40.75) {
      ecto = 0.463 * cap - 17.63;
    } else {
      ecto = 0.1;
    }
    ecto = Math.max(0.1, ecto);
    result.somatotipo_ecto = ecto.toFixed(1);
  }

  // Coordenadas Somatocarta (X, Y)
  if (endo > 0 && meso > 0 && ecto > 0) {
    const sX = ecto - endo;
    const sY = 2 * meso - (endo + ecto);
    result.somatotipo_x = sX.toFixed(2);
    result.somatotipo_y = sY.toFixed(2);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR DE PRESCRIPCIÓN ENERGÉTICA Y MACRONUTRIENTES (TMB, GET, MACROS)
// ═══════════════════════════════════════════════════════════════════════════════

export const TMB_FORMULAS = [
  { id: "mifflin", label: "Mifflin-St Jeor", requiresMLG: false },
  { id: "katch", label: "Katch-McArdle (MLG)", requiresMLG: true },
  { id: "cunningham", label: "Cunningham (MLG)", requiresMLG: true },
  { id: "harris", label: "Harris-Benedict (Rev.)", requiresMLG: false },
];

export const ACTIVITY_FACTORS = [
  { value: 1.2, label: "Sedentario", short: "1.20" },
  { value: 1.375, label: "Ligero (1–3 d/sem)", short: "1.375" },
  { value: 1.55, label: "Moderado (3–5 d/sem)", short: "1.55" },
  { value: 1.725, label: "Activo (6–7 d/sem)", short: "1.725" },
  { value: 1.9, label: "Atleta / Doble sesión", short: "1.90" },
];

export const GOAL_PRESETS = [
  { id: "cut_20", label: "Déficit -20%", title: "Definición Intensa", pct: -20, desc: "Pérdida acelerada de grasa corporal" },
  { id: "cut_15", label: "Déficit -15%", title: "Pérdida de Grasa", pct: -15, desc: "Déficit sostenible preservando masa muscular" },
  { id: "cut_10", label: "Déficit -10%", title: "Recomposición Corporal", pct: -10, desc: "Oxidación gradual de grasa y mejora muscular" },
  { id: "maint", label: "Mantenimiento", title: "Mantenimiento / Rendimiento", pct: 0, desc: "Equilibrio energético y consolidación" },
  { id: "bulk_10", label: "Superávit +10%", title: "Ganancia Muscular Limpia", pct: 10, desc: "Aumento de masa muscular minimizando grasa" },
  { id: "bulk_15", label: "Superávit +15%", title: "Volumen / Fuerza", pct: 15, desc: "Superávit para ganancia de peso y fuerza" },
];

export function getGoalPresetInfo(val) {
  if (val === null || val === undefined || val === "") return null;
  const byId = GOAL_PRESETS.find((g) => g.id === String(val));
  if (byId) return byId;
  const num = Number(val);
  if (!isNaN(num)) {
    return GOAL_PRESETS.find((g) => g.pct === num) || null;
  }
  return null;
}

export function getActivityFactorInfo(val) {
  const num = parseFloat(val);
  if (!num || isNaN(num)) return null;
  return (
    ACTIVITY_FACTORS.find((af) => Math.abs(af.value - num) < 0.02) ||
    ACTIVITY_FACTORS[2]
  );
}

/**
 * Infiere el código de objetivo ('cut_15', 'cut_10', 'bulk_10', 'maint', etc.) a partir de texto libre
 * del expediente inicial o del enfoque del plan.
 */
export function inferGoalFromText(rawText = "") {
  const s = String(rawText || "").toLowerCase();
  if (!s) return "cut_15";
  if (/(recomposi|tonific|definir y ganar|mantener musculo)/i.test(s)) return "cut_10";
  if (/(agresiv|rapido|urgente|competencia|corte)/i.test(s) && /(bajar|grasa|perder|defin)/i.test(s)) return "cut_20";
  if (/(bajar|perder|grasa|definici|adelgaz|oxidar|reducci|peso)/i.test(s)) return "cut_15";
  if (/(volumen intenso|subir rapido|ectomorfo|ganar mucho)/i.test(s)) return "bulk_15";
  if (/(muscul|hipertrof|volumen|aument|subir|ganar|fuerza|masa)/i.test(s)) return "bulk_10";
  if (/(manten|salud|rendimiento|energia|habito|bienestar)/i.test(s)) return "maint";
  return "cut_15";
}

/**
 * Infiere el Factor de Actividad Física (FAF) a partir de los hábitos declarados en el expediente.
 */
export function inferFafFromAnamnesis(anamnesis = {}) {
  const ana = anamnesis || {};
  const combined = `${ana.dias_entrenamiento || ""} ${ana.frecuencia_ejercicio || ""} ${ana.tipo_entrenamiento || ""} ${ana.ocupacion_actividad || ""}`.toLowerCase();
  if (/(doble sesi|atleta|alto rendimiento|2 veces al dia|construcci|campo)/i.test(combined)) return 1.9;
  if (/(6|7)\s*(dias|días|veces)|diario|todos los dias/i.test(combined)) return 1.725;
  if (/(3|4|5)\s*(dias|días|veces)|moderad/i.test(combined)) return 1.55;
  if (/(1|2)\s*(dias|días|veces)|liger|caminar/i.test(combined)) return 1.375;
  if (/(sedentari|ningun|no entren|0 dias|oficina)/i.test(combined)) return 1.2;
  return 1.55;
}

/**
 * Calcula la Tasa Metabólica Basal (TMB / BMR) en kcal/día.
 */
export function calculateTMB({
  formula = "mifflin",
  peso = 0,
  estatura = 0,
  edad = 25,
  sexo = "M",
  mlg = 0,
  biaBmr = 0,
}) {
  const p = parseFloat(peso) || 0;
  const h = parseFloat(estatura) || 0;
  const e = parseFloat(edad) || 25;
  const s = normalizeSexo(sexo);
  const ffm = parseFloat(mlg) || 0;
  const bmrDirect = parseFloat(biaBmr) || 0;

  if (formula === "bia" && bmrDirect > 0) {
    return Math.round(bmrDirect);
  }
  if (formula === "katch" && ffm > 0) {
    return Math.round(370 + 21.6 * ffm);
  }
  if (formula === "cunningham" && ffm > 0) {
    return Math.round(500 + 22 * ffm);
  }
  if (p <= 0 || h <= 0) return 0;

  if (formula === "harris") {
    // Ecuación de Harris-Benedict revisada por Roza y Shizgal (1984)
    const hb =
      s === "M"
        ? 88.362 + 13.397 * p + 4.799 * h - 5.677 * e
        : 447.593 + 9.247 * p + 3.098 * h - 4.33 * e;
    return Math.round(hb);
  }

  // Default: Mifflin-St Jeor (1990)
  const msj =
    s === "M"
      ? 10 * p + 6.25 * h - 5 * e + 5
      : 10 * p + 6.25 * h - 5 * e - 161;
  return Math.round(msj);
}

/**
 * Calcula GET, Kcal Objetivo y distribución de macronutrientes (modo g/kg o modo %).
 */
export function calculateEnergyPrescription({
  formula = "mifflin",
  peso = 0,
  estatura = 0,
  edad = 25,
  sexo = "M",
  mlg = 0,
  biaBmr = 0,
  faf = 1.55,
  goalPct = 0,
  customKcal = null,
  mode = "g_kg", // 'g_kg' | 'pct'
  protGKg = 2.0,
  fatGKg = 0.9,
  protPct = 30,
  carbPct = 45,
  fatPct = 25,
}) {
  const p = parseFloat(peso) || 0;
  const tmb = calculateTMB({ formula, peso: p, estatura, edad, sexo, mlg, biaBmr });
  const get = tmb > 0 ? Math.round(tmb * (parseFloat(faf) || 1.2)) : 0;
  const targetKcal =
    customKcal !== null && customKcal !== "" && Number(customKcal) > 0
      ? Math.round(Number(customKcal))
      : Math.round(get * (1 + (parseFloat(goalPct) || 0) / 100));

  if (targetKcal <= 0) {
    return {
      tmb,
      get,
      targetKcal: 0,
      proteinasG: 0,
      carbohidratosG: 0,
      grasasG: 0,
      protGKg: 0,
      carbGKg: 0,
      fatGKg: 0,
      protPct: 0,
      carbPct: 0,
      fatPct: 0,
    };
  }

  let proteinasG = 0;
  let grasasG = 0;
  let carbohidratosG = 0;

  if (mode === "g_kg" && p > 0) {
    proteinasG = Math.round(p * (parseFloat(protGKg) || 0));
    grasasG = Math.round(p * (parseFloat(fatGKg) || 0));
    const usedKcal = proteinasG * 4 + grasasG * 9;
    const remKcal = Math.max(0, targetKcal - usedKcal);
    carbohidratosG = Math.round(remKcal / 4);
  } else {
    const pPct = parseFloat(protPct) || 0;
    const cPct = parseFloat(carbPct) || 0;
    const fPct = parseFloat(fatPct) || 0;
    proteinasG = Math.round((targetKcal * (pPct / 100)) / 4);
    carbohidratosG = Math.round((targetKcal * (cPct / 100)) / 4);
    grasasG = Math.round((targetKcal * (fPct / 100)) / 9);
  }

  const totalCalcKcal = proteinasG * 4 + carbohidratosG * 4 + grasasG * 9 || targetKcal;

  return {
    tmb,
    get,
    targetKcal,
    proteinasG,
    carbohidratosG,
    grasasG,
    protGKg: p > 0 ? Number((proteinasG / p).toFixed(2)) : 0,
    carbGKg: p > 0 ? Number((carbohidratosG / p).toFixed(2)) : 0,
    fatGKg: p > 0 ? Number((grasasG / p).toFixed(2)) : 0,
    protPct: Math.round(((proteinasG * 4) / totalCalcKcal) * 100),
    carbPct: Math.round(((carbohidratosG * 4) / totalCalcKcal) * 100),
    fatPct: Math.round(((grasasG * 9) / totalCalcKcal) * 100),
  };
}

/**
 * Motor Inteligente de Prescripción Energética y Macros potenciado por IA Clínica.
 * Combina datos permanentes del Expediente Clínico (género, edad, patologías)
 * con datos dinámicos de la Evaluación del Plan (peso, MLG, % grasa, objetivo de etapa, FAF, check-in).
 */
export function generateSmartMacroPrescription({
  cliente = {},
  metrica = null,
  prevMetrica = null,
  clinicalRec = null,
  ciclo = null,
}) {
  const anamnesis = clinicalRec?.anamnesis || {};
  const enriched = metrica ? enrichMetrica(metrica) : null;
  const enrichedPrev = prevMetrica ? enrichMetrica(prevMetrica) : null;

  const sexo = normalizeSexo(
    cliente?.genero || cliente?.sexo || anamnesis?.genero || enriched?.sexo || "M"
  );
  const edad = calcEdadFromBirthdate(
    cliente?.fecha_nacimiento || anamnesis?.fecha_nacimiento,
    Number(enriched?.edad) || 25
  );

  const peso =
    parseFloat(enriched?.peso) ||
    parseFloat(cliente?.peso) ||
    parseFloat(enrichedPrev?.peso) ||
    0;

  const rawEstatura =
    parseFloat(enriched?.estatura) ||
    parseFloat(enrichedPrev?.estatura) ||
    parseFloat(cliente?.estatura) ||
    parseFloat(anamnesis?.estatura) ||
    0;
  const estaturaEstimada = rawEstatura <= 0;
  const estatura = rawEstatura > 0 ? rawEstatura : sexo === "F" ? 162 : 172;

  const mlg = parseFloat(enriched?.masa_libre_grasa) || 0;
  const grasaPct = parseFloat(enriched?.grasa_pct) || 0;
  const biaBmr = parseFloat(enriched?.inbody_bmr) || 0;

  // 1. Selección inteligente de fórmula TMB
  let formula = "mifflin";
  let formulaLabel = "Mifflin-St Jeor";
  if (biaBmr > 0) {
    formula = "bia";
    formulaLabel = "BMR Bioimpedancia";
  } else if (mlg > 0) {
    formula = "katch";
    formulaLabel = `Katch-McArdle (${mlg} kg MLG)`;
  }

  // 2. Nivel de Actividad Física (FAF) del ciclo actual
  const fafVal =
    parseFloat(enriched?.eval_faf) ||
    parseFloat(enrichedPrev?.eval_faf) ||
    inferFafFromAnamnesis(anamnesis);
  const fafInfo = getActivityFactorInfo(fafVal) || ACTIVITY_FACTORS[2];

  // 3. Objetivo Energético de la etapa actual
  const cycleParts = String(ciclo?.nombre || "").split("|");
  const cycleEnfoque = cycleParts[4] || ciclo?.enfoque || "";
  const rawGoalId =
    enriched?.eval_objetivo ||
    (cycleEnfoque ? inferGoalFromText(cycleEnfoque) : "") ||
    enrichedPrev?.eval_objetivo ||
    inferGoalFromText(anamnesis?.objetivo_principal || anamnesis?.objetivo_expectativas || cliente?.objetivo || "");

  const goalInfo = getGoalPresetInfo(rawGoalId) || GOAL_PRESETS[1]; // Default: Déficit -15%
  let goalPct = goalInfo.pct;

  // 4. Ajuste clínico inteligente de Proteína y Grasas (g/kg)
  const patologiasStr = `${anamnesis?.patologias || ""} ${anamnesis?.medicacion_suplementos || ""}`.toLowerCase();
  const tieneCondicionMetabolica = /(insulina|diabetes|sop|ovario poliqu|hipotiroid|tiroid|metabolic)/i.test(patologiasStr);
  const tieneCondicionRenal = /(renal|riñon|rinon|nefro)/i.test(patologiasStr);

  // Detectar si hay porcentaje de grasa elevado para escalar proteína de forma realista
  const highBodyFat =
    (sexo === "M" && grasaPct >= 26) ||
    (sexo === "F" && grasaPct >= 34) ||
    (peso > 0 && estatura > 0 && peso / ((estatura / 100) ** 2) >= 29);

  let protGKg = 2.0;
  let fatGKg = 0.9;

  if (tieneCondicionRenal) {
    protGKg = 1.4;
  } else if (goalPct < 0) {
    // En déficit calórico se eleva proteína para proteger masa magra
    protGKg = highBodyFat ? 1.8 : fafInfo.value >= 1.55 ? 2.2 : 2.0;
  } else if (goalPct > 0) {
    // En superávit calórico los carbohidratos ejercen ahorro proteico
    protGKg = 1.9;
  } else {
    protGKg = 1.9;
  }

  if (tieneCondicionMetabolica) {
    // En resistencia a la insulina / SOP / hipotiroidismo se prioriza saciedad y control glucémico
    fatGKg = 1.0;
  } else if (goalPct <= -15) {
    fatGKg = 0.85;
  } else if (goalPct > 0) {
    fatGKg = 0.95;
  } else {
    fatGKg = 0.9;
  }

  // Ajuste sutil si en el check-in de la evaluación reportó hambre severa o baja energía (<=2/5)
  const lowEnergyOrSatiety =
    (enriched?.checkin_energia && Number(enriched.checkin_energia) <= 2) ||
    (enriched?.checkin_saciedad && Number(enriched.checkin_saciedad) <= 2);

  if (lowEnergyOrSatiety && goalPct <= -20) {
    goalPct = -15; // Modera déficit agresivo para sostener adherencia
  }

  const calc = calculateEnergyPrescription({
    formula,
    peso,
    estatura,
    edad,
    sexo,
    mlg,
    biaBmr,
    faf: fafInfo.value,
    goalPct,
    mode: "g_kg",
    protGKg,
    fatGKg,
  });

  // 5. Construir explicación clínica clara y etiquetas de respaldo
  const clinicalNotes = [];
  if (enriched) {
    clinicalNotes.push(`Evaluación ${enriched.fecha || "actual"}`);
  } else {
    clinicalNotes.push("Basado en Perfil y Expediente");
  }
  clinicalNotes.push(formulaLabel);
  clinicalNotes.push(`FAF ${fafInfo.short} (${fafInfo.label})`);
  clinicalNotes.push(`${goalInfo.title} (${goalPct > 0 ? `+${goalPct}` : goalPct}%)`);

  if (tieneCondicionMetabolica) {
    clinicalNotes.push("Ajuste glucémico/endocrino (Expediente)");
  }
  if (lowEnergyOrSatiety) {
    clinicalNotes.push("Protección de saciedad/energía (Check-in)");
  }
  if (estaturaEstimada && formula !== "katch" && formula !== "bia") {
    clinicalNotes.push(`Estatura ref. ${estatura} cm`);
  }

  const sourceLabel = enriched
    ? "Evaluación del Plan"
    : "Perfil y Expediente Clínico";

  const rationale =
    peso > 0
      ? `Prescripción calculada desde la ${sourceLabel} mediante ${formulaLabel} (TMB ${calc.tmb} kcal × FAF ${fafInfo.short} = ${calc.get} kcal GET). Para el objetivo de ${goalInfo.title} (${goalPct > 0 ? `+${goalPct}` : goalPct}%), se establecen ${calc.targetKcal} kcal con ${calc.protGKg} g/kg de proteína (${calc.proteinasG}g) para preservar masa muscular, ${calc.fatGKg} g/kg de grasas (${calc.grasasG}g) y ${calc.carbohidratosG}g de carbohidratos.`
      : "Registra el peso del paciente en la pestaña Evaluación para generar automáticamente la prescripción energética y de macronutrientes.";

  return {
    hasEnoughData: peso > 0 && calc.targetKcal > 0,
    hasEvaluation: Boolean(enriched),
    hasExplicitEvalParams: Boolean(enriched?.eval_objetivo && enriched?.eval_faf),
    peso,
    estatura: rawEstatura > 0 ? rawEstatura : estatura,
    edad,
    sexo,
    mlg,
    grasaPct,
    biaBmr,
    formula,
    formulaLabel,
    faf: fafInfo.value,
    fafInfo,
    goalId: goalInfo.id,
    goalInfo,
    goalPct,
    protGKg,
    fatGKg,
    ...calc,
    rationale,
    clinicalNotes,
    preferencias: enriched?.preferencias_alimentos || anamnesis?.preferencias_alimentos || "",
    aversiones: enriched?.aversiones_alimentos || anamnesis?.aversiones_alimentos || "",
    r24h: {
      desayuno: enriched?.r24h_desayuno || anamnesis?.r24h_desayuno || "",
      colacion_m: enriched?.r24h_colacion_m || anamnesis?.r24h_colacion_m || "",
      comida: enriched?.r24h_comida || anamnesis?.r24h_comida || "",
      colacion_v: enriched?.r24h_colacion_v || anamnesis?.r24h_colacion_v || "",
      cena: enriched?.r24h_cena || anamnesis?.r24h_cena || "",
      picoteos: enriched?.r24h_picoteos || anamnesis?.r24h_picoteos || "",
    },
  };
}

