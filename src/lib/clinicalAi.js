// Clinical AI Engine for FLUX
// Synthesizes clinical intake questionnaires, extracts key highlights, food preferences/aversions,
// and produces actionable clinical diagnoses for nutritionists and coaches.

import { invokeEdgeFunction } from "./supabase";

/**
 * Splits comma-, semicolon-, slash-, or conjunction-separated strings into clean, deduplicated tags.
 */
export function parseTags(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const cleaned = rawText
    .replace(/^(ningun[ao]s?|no|n\/a|nada|ninguno\.)/i, "")
    .trim();
  if (!cleaned) return [];
  
  const rawParts = cleaned.split(/[,;\n/•\+\-]+|\s+(?:y|e|\&)\s+/i);
  const seen = new Set();
  const result = [];

  for (const part of rawParts) {
    const trimmed = part.trim();
    const lower = trimmed.toLowerCase();
    if (trimmed.length > 1 && !/^(ningun[ao]s?|no|n\/a|nada)$/i.test(trimmed) && !seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }

  return result;
}

/**
 * Normaliza y une listas en español con conectores gramaticalmente correctos ('y' / 'e').
 */
export function joinSpanishList(items) {
  if (!items || items.length === 0) return "";
  if (items.length === 1) return items[0];
  const last = items[items.length - 1];
  const initial = items.slice(0, -1).join(", ");
  const conj = /^[iíIÍ]|^h[iíIÍ]/.test(last.trim()) ? " e " : " y ";
  return `${initial}${conj}${last}`;
}

/**
 * Extracts and classifies all critical points of an anamnesis record for quick nutritionist review.
 */
export function extractClinicalHighlights(anamnesis = {}, cliente = {}) {
  const ana = anamnesis || {};
  
  // 1. Patologías y Condiciones Médicas
  const patologiasRaw = (ana.patologias || "").trim();
  const patologias = parseTags(patologiasRaw);
  const tienePatologias = patologias.length > 0 || (patologiasRaw.length > 2 && !/^(no|ningun|nada|n\/a)/i.test(patologiasRaw));

  // 2. Alergias e Intolerancias (Alta prioridad)
  const alergiasRaw = (ana.alergias_intolerancias || "").trim();
  const alergias = parseTags(alergiasRaw);
  const tieneAlergias = alergias.length > 0 || (alergiasRaw.length > 2 && !/^(no|ningun|nada|n\/a)/i.test(alergiasRaw));

  // 3. Lesiones y Cirugías
  const lesionesRaw = (ana.cirugias_lesiones || "").trim();
  const lesiones = parseTags(lesionesRaw);
  const tieneLesiones = lesiones.length > 0 || (lesionesRaw.length > 2 && !/^(no|ningun|nada|n\/a)/i.test(lesionesRaw));

  // 4. Medicación y Suplementos
  const medicacionRaw = (ana.medicacion_suplementos || "").trim();
  const medicacion = parseTags(medicacionRaw);
  const tieneMedicacion = medicacion.length > 0 || (medicacionRaw.length > 2 && !/^(no|ningun|nada|n\/a)/i.test(medicacionRaw));

  // 5. Síntomas Digestivos / GI (Normal, Norml, Sin síntomas, Bien, etc. representan salud GI óptima, NUNCA exclusión)
  const digestivoRaw = (ana.sintomas_gi || "").trim();
  const isNormalGI = !digestivoRaw || /^(norm[a-z]*|bien|sin|ning[uú]n[ao]s?|nada|ok|n\/a)$/i.test(digestivoRaw);
  const sintomasGI = isNormalGI ? [] : parseTags(digestivoRaw);
  const tieneSintomasGI = !isNormalGI && (sintomasGI.length > 0 || digestivoRaw.length > 2);

  // 6. Alimentos que Rechaza (Aversiones) — ¡CRÍTICO!
  const aversionesRaw = (ana.aversiones_alimentos || "").trim();
  const aversiones = parseTags(aversionesRaw);
  const tieneAversiones = aversiones.length > 0 || (aversionesRaw.length > 2 && !/^(no|ningun|nada)/i.test(aversionesRaw));

  // 7. Alimentos Favoritos (Preferencias)
  const preferenciasRaw = (ana.preferencias_alimentos || "").trim();
  const preferencias = parseTags(preferenciasRaw);
  const tienePreferencias = preferencias.length > 0 || (preferenciasRaw.length > 2 && !/^(no|ningun|nada)/i.test(preferenciasRaw));

  // 8. Objetivo
  const objetivo = (ana.objetivo_principal || ana.objetivo_expectativas || cliente?.objetivo || "").trim();

  // 9. Hábitos y R24H
  const sueno = (ana.horas_sueno || "").trim();
  const estresNivel = parseInt(ana.nivel_estres || "3", 10);
  const estresEtiqueta =
    estresNivel >= 4 ? "Estrés alto" : estresNivel === 3 ? "Estrés moderado" : "Estrés bajo";
  const agua = (ana.consumo_agua_estimado || "").trim();
  const alcoholTabaco = (ana.consumo_alcohol_tabaco || "").trim();
  const ocupacion = (ana.ocupacion_actividad || "").trim();
  const picoteos = (ana.r24h_picoteos || "").trim();

  // Desglose rápido R24H
  const r24h = {
    desayuno: (ana.r24h_desayuno || "").trim(),
    colacion_m: (ana.r24h_colacion_m || "").trim(),
    comida: (ana.r24h_comida || "").trim(),
    colacion_v: (ana.r24h_colacion_v || "").trim(),
    cena: (ana.r24h_cena || "").trim(),
    picoteos: picoteos,
  };
  const tieneR24h = Boolean(
    r24h.desayuno || r24h.comida || r24h.cena || r24h.colacion_m || r24h.colacion_v || r24h.picoteos
  );

  // Antecedentes Heredofamiliares
  const heredoRaw = (ana.antecedentes_heredofamiliares || "").trim();
  const heredo = parseTags(heredoRaw);
  const tieneHeredo = heredo.length > 0 || (heredoRaw.length > 2 && !/^(no|ningun|nada|n\/a)/i.test(heredoRaw));

  // 10. Generación de Diagnóstico Clínico Estructurado (Motor Analítico Local Limpio)
  const sexoStr = cliente?.genero === "F" || cliente?.sexo === "F" ? "Paciente femenina" : "Paciente masculino";
  let sintesisParts = [];

  // Oración 1: Patología y Diagnóstico con razonamiento metabólico y corrección de typos
  if (tienePatologias) {
    const isDiabetes = /d[aeií]bet/i.test(patologiasRaw);
    const isTiroides = /hipot[iy]roid|t[iy]roid/i.test(patologiasRaw);
    const isHipertension = /hipert|presi[oó]n/i.test(patologiasRaw);
    const isInsulina = /insulin|resistencia/i.test(patologiasRaw);

    if (isDiabetes) {
      sintesisParts.push(`${sexoStr} con diagnóstico de Diabetes Mellitus tipo 1, perfil clínico que exige un conteo riguroso de carbohidratos, índice glucémico controlado y coordinación con su pauta de insulina para prevenir descompensaciones.`);
    } else if (isInsulina) {
      sintesisParts.push(`${sexoStr} con resistencia a la insulina, condición que demanda restricción de azúcares simples y priorización de fibra soluble para estabilizar la curva glucémica postprandial.`);
    } else if (isTiroides) {
      sintesisParts.push(`${sexoStr} con antecedente tiroideo (${patologiasRaw}), requiriendo ajuste del gasto energético basal y micronutrientes de soporte metabólico.`);
    } else if (isHipertension) {
      sintesisParts.push(`${sexoStr} con hipertensión arterial, aconsejándose un estricto control de sodio y equilibrio electrolítico en el plan.`);
    } else {
      sintesisParts.push(`${sexoStr} con perfil clínico condicionado por ${patologiasRaw}, requiriendo pautas adaptadas a sus antecedentes.`);
    }
  } else {
    sintesisParts.push(`${sexoStr} sin patologías crónicas reportadas, con función metabólica favorable como punto de partida clínico.`);
  }

  // Oración 2: Alergias o intolerancias alimentarias crónicas (exclusión estricta)
  if (tieneAlergias) {
    sintesisParts.push(`Se establece la exclusión estricta de ${joinSpanishList(alergias)} para garantizar la seguridad clínica y prevenir reacciones adversas.`);
  }

  // Oración 3: Medicación o Antecedentes Heredofamiliares
  if (tieneMedicacion && tieneHeredo) {
    sintesisParts.push(`Bajo tratamiento actual con ${medicacionRaw}, registrando además antecedentes familiares de ${heredoRaw} para vigilancia metabólica preventiva.`);
  } else if (tieneMedicacion) {
    sintesisParts.push(`Reporta consumo de ${medicacionRaw}, a considerar en posibles interacciones farmacológicas.`);
  } else if (tieneHeredo) {
    sintesisParts.push(`Registra antecedentes familiares de ${heredoRaw}, indicativo para monitorización preventiva.`);
  }

  // Oración 4: Digestión, cirugías y contexto
  let clinList = [];
  if (isNormalGI) {
    clinList.push("función digestiva conservada");
  } else if (tieneSintomasGI) {
    clinList.push(`atención a sintomatología gastrointestinal (${digestivoRaw.toLowerCase()})`);
  }
  if (tieneLesiones) {
    clinList.push(`antecedente de ${lesionesRaw}`);
  }
  if (ocupacion) {
    clinList.push(`contexto de ${ocupacion}`);
  }
  if (clinList.length > 0) {
    sintesisParts.push(`Presenta ${joinSpanishList(clinList)}, base favorable para consolidar la adherencia y el balance integral.`);
  }

  const sintesisTexto = sintesisParts.join(" ");

  return {
    nombre: cliente?.nombre || "El paciente",
    objetivo,
    patologias: {
      tags: patologias,
      raw: patologiasRaw,
      presente: tienePatologias,
    },
    alergias: {
      tags: alergias,
      raw: alergiasRaw,
      presente: tieneAlergias,
    },
    heredo: {
      tags: heredo,
      raw: heredoRaw,
      presente: tieneHeredo,
    },
    lesiones: {
      tags: lesiones,
      raw: lesionesRaw,
      presente: tieneLesiones,
    },
    medicacion: {
      tags: medicacion,
      raw: medicacionRaw,
      presente: tieneMedicacion,
    },
    digestivo: {
      tags: sintomasGI,
      raw: digestivoRaw,
      presente: tieneSintomasGI,
      isNormal: isNormalGI,
    },
    aversiones: {
      tags: aversiones,
      raw: aversionesRaw,
      presente: tieneAversiones,
    },
    preferencias: {
      tags: preferencias,
      raw: preferenciasRaw,
      presente: tienePreferencias,
    },
    habitos: {
      sueno,
      estresNivel,
      estresEtiqueta,
      agua,
      alcoholTabaco,
      ocupacion,
      picoteos,
    },
    r24h,
    tieneR24h,
    sintesisTexto,
    notasConsulta: (ana.notas_consulta || "").trim(),
    completadoPor: ana.completado_por || null,
    actualizadoEn: ana.updated_at || null,
  };
}

/**
 * Obtiene la API Key de Gemini desde variables de entorno si está configurada.
 */
export function getGeminiApiKey() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
      const k = import.meta.env.VITE_GEMINI_API_KEY.trim();
      if (k && (k.startsWith("AIzaSy") || k.length >= 20)) return k;
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env && process.env.VITE_GEMINI_API_KEY) {
      const k = process.env.VITE_GEMINI_API_KEY.trim();
      if (k && (k.startsWith("AIzaSy") || k.length >= 20)) return k;
    }
  } catch {}
  return "";
}

/**
 * Generates an intelligent clinical diagnosis using Google Gemini or falls back to analytical synthesis.
 */
export async function generateClinicalAiSynopsis(anamnesis, cliente) {
  const highlights = extractClinicalHighlights(anamnesis, cliente);
  const apiKey = getGeminiApiKey();

  // 1. Intentar llamar a la Edge Function de Supabase (Backend seguro y centralizado)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const edgeRes = await invokeEdgeFunction("clinical-ai", {
      action: "clinical-synopsis",
      anamnesis,
      cliente,
      geminiKey: apiKey,
    });
    clearTimeout(timeoutId);

    if (edgeRes?.diagnostico || edgeRes?.texto) {
      return {
        texto: edgeRes.diagnostico || edgeRes.texto,
        diagnostico: edgeRes.diagnostico || edgeRes.texto,
        alertas: edgeRes.alertas || null,
        medicacion_normalizada: edgeRes.medicacion_normalizada || null,
        heredo_normalizado: edgeRes.heredo_normalizado || null,
        contexto_normalizado: edgeRes.contexto_normalizado || null,
        directrices_nutricionales: edgeRes.directrices_nutricionales || [],
        origen: edgeRes.origen || "edge_function",
        model: edgeRes.model || "gemini-3.5-flash-lite",
        generadoEn: edgeRes.generadoEn || new Date().toISOString(),
        highlights,
      };
    }
  } catch {
    // Continuar a llamada directa o fallback
  }

  const patologiasRaw = (anamnesis?.patologias || "").trim();
  const alergiasRaw = (anamnesis?.alergias_intolerancias || "").trim();
  const medicacionRaw = (anamnesis?.medicacion_suplementos || "").trim();
  const heredoRaw = (anamnesis?.antecedentes_heredofamiliares || "").trim();
  const lesionesRaw = (anamnesis?.cirugias_lesiones || "").trim();
  const digestivoRaw = (anamnesis?.sintomas_gi || "").trim();
  const ocupacionRaw = (anamnesis?.ocupacion_actividad || "").trim();
  const alcoholTabacoRaw = (anamnesis?.consumo_alcohol_tabaco || "").trim();
  const notasRaw = (anamnesis?.notas_consulta || "").trim();
  const objetivo = (anamnesis?.objetivo_principal || cliente?.objetivo || "").trim();

  const prompt = `Eres un médico especialista en medicina interna y nutrición clínica de élite en FLUX.
Tu tarea es REALIZAR UNA AUDITORÍA Y SÍNTESIS INTEGRAL DEL EXPEDIENTE CLÍNICO DE UN PACIENTE REAL.
Debes interpretar datos médicos, corregir errores ortográficos o descripciones coloquiales del paciente y generar una síntesis profesional y estructurada.

═══════════════════════════════════════════════════════════
DATOS DEL PACIENTE:
═══════════════════════════════════════════════════════════
- Nombre: ${cliente?.nombre || "Paciente"}
- Sexo: ${cliente?.genero === "F" || cliente?.sexo === "F" ? "Femenino" : "Masculino"}
- Objetivo: ${objetivo || "Mejorar salud y composición corporal"}

INFORMACIÓN REPORTADA EN EL EXPEDIENTE:
1. Patologías / Diagnósticos: ${patologiasRaw || "Ninguna"}
2. Alergias e Intolerancias: ${alergiasRaw || "Ninguna"}
3. Medicación y Suplementos: ${medicacionRaw || "Ninguna"}
4. Antecedentes Heredofamiliares: ${heredoRaw || "Ninguno"}
5. Cirugías y Lesiones: ${lesionesRaw || "Ninguna"}
6. Digestión / Síntomas GI: ${digestivoRaw || "Normal"}
7. Ocupación y Actividad: ${ocupacionRaw || "No especificada"}
8. Alcohol / Tabaco: ${alcoholTabacoRaw || "No reportado"}
${notasRaw ? `9. Notas de consulta: ${notasRaw}` : ""}

INSTRUCCIONES CLÍNICAS:
1. Normaliza los textos coloquiales o con faltas de ortografía a terminología médica limpia (ej. 'solo para contralar a hipertension' -> 'Terapia antihipertensiva oral', 'ambuelos tubieron diabetes' -> 'Diabetes Mellitus tipo 2 en abuelos').
2. Si hay 'intolerancia a la lactosa', el alimento real a excluir son 'Lácteos y derivados con lactosa' (¡NUNCA digas 'excluir la intolerancia'!).
3. Redacta un diagnóstico integral cruzando patologías, herencia y medicación.
4. Proporciona entre 3 y 4 directrices dietoterapéuticas precisas para el nutriólogo.

Debes responder ÚNICAMENTE con un JSON válido con la siguiente estructura:
{
  "diagnostico": "string con diagnóstico clínico integral (3-4 oraciones profesionales)",
  "alertas": {
    "patologias_normalizadas": ["patología corregida"],
    "exclusiones_alimentarias": ["alimento real 1 a evitar"],
    "observacion_alergias": "string breve"
  },
  "medicacion_normalizada": "string profesional sin faltas de ortografía",
  "heredo_normalizado": "string profesional de antecedentes familiares",
  "contexto_normalizado": {
    "ocupacion": "string profesional",
    "digestion": "string profesional",
    "alcohol_tabaco": "string profesional"
  },
  "directrices_nutricionales": ["directriz 1", "directriz 2", "directriz 3"]
}`;
  
  if (apiKey) {
    const candidateModels = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (geminiText) {
            const parsed = JSON.parse(geminiText);
            return {
              texto: parsed.diagnostico || geminiText,
              diagnostico: parsed.diagnostico || geminiText,
              alertas: parsed.alertas || null,
              medicacion_normalizada: parsed.medicacion_normalizada || medicacionRaw,
              heredo_normalizado: parsed.heredo_normalizado || heredoRaw,
              contexto_normalizado: parsed.contexto_normalizado || null,
              directrices_nutricionales: parsed.directrices_nutricionales || [],
              origen: "gemini_direct",
              model,
              generadoEn: new Date().toISOString(),
              highlights,
            };
          }
        }
      } catch {
        // Probar siguiente modelo o fallback
      }
    }
  }

  // Fallback analítico médico
  return {
    texto: highlights.sintesisTexto,
    diagnostico: highlights.sintesisTexto,
    alertas: {
      patologias_normalizadas: highlights.patologias.tags,
      exclusiones_alimentarias: highlights.alergias.tags,
      observacion_alergias: "Exclusión de alérgenos reportados",
    },
    medicacion_normalizada: highlights.medicacion.raw || "Sin medicación reportada",
    heredo_normalizado: highlights.heredo.raw || "Sin antecedentes reportados",
    contexto_normalizado: {
      ocupacion: highlights.habitos.ocupacion || "No especificada",
      digestion: highlights.digestivo.isNormal ? "Función digestiva conservada" : highlights.digestivo.raw,
      alcohol_tabaco: highlights.habitos.alcoholTabaco || "No reportado",
    },
    directrices_nutricionales: [],
    origen: "analitico",
    generadoEn: new Date().toISOString(),
    highlights,
  };
}

/**
 * Real AI Macro Prescription Auditor using Google Gemini via Supabase Edge Function or Direct API
 */
export async function auditMacroPrescriptionWithAi({
  cliente = {},
  anamnesis = {},
  metrica = {},
  r24h = {},
  habitos = {},
  calcMatematico = {},
  preferencias = "",
  aversiones = "",
}) {
  const geminiKey = getGeminiApiKey();

  // 1. Intentar llamar a la Edge Function de Supabase (Backend seguro)
  try {
    const edgeRes = await invokeEdgeFunction("clinical-ai", {
      action: "audit-macros",
      cliente,
      anamnesis,
      metrica,
      r24h,
      habitos,
      calcMatematico,
      preferencias,
      aversiones,
      geminiKey,
    });

    if (edgeRes?.prescription) {
      return {
        ...edgeRes.prescription,
        origen: edgeRes.origen || "edge_function",
        model: edgeRes.model || "gemini-3.5-flash-lite",
        generadoEn: edgeRes.generadoEn || new Date().toISOString(),
      };
    }
  } catch (edgeErr) {
    if (edgeErr?.message?.includes("rechazada") || edgeErr?.message?.includes("API Key")) {
      throw edgeErr;
    }
  }

  // 2. Intentar llamada directa a Google Gemini si hay API key en el cliente
  if (geminiKey) {
    const promptAudit = `Eres un médico y nutriólogo clínico deportivo de élite en FLUX.
Tu tarea es AUDITAR CON RIGOR CLÍNICO Y PRECISIÓN LA PRESCRIPCIÓN ENERGÉTICA Y DE MACRONUTRIENTES para un paciente real.

═══════════════════════════════════════════════════════════
1. EXPEDIENTE MÉDICO CLÍNICO (Atemporal / Antecedentes)
═══════════════════════════════════════════════════════════
- Paciente: ${cliente.nombre || "Paciente"} (${cliente.genero === "F" || metrica.sexo === "F" ? "Femenino" : "Masculino"}, ${cliente.edad || metrica.edad || "25"} años)
- Patologías y diagnósticos: ${anamnesis.patologias || "Ninguna reportada"}
- Alergias e intolerancias alimentarias: ${anamnesis.alergias_intolerancias || "Ninguna"}
- Medicación y suplementación: ${anamnesis.medicacion_suplementos || "Ninguna"}
- Antecedentes familiares y lesiones: ${anamnesis.antecedentes_familiares || "Ninguno"} / ${anamnesis.cirugias_lesiones || "Ninguna"}

═══════════════════════════════════════════════════════════
2. PASO 1: CHECK-IN Y SENSACIONES ACTUALES DEL PACIENTE
═══════════════════════════════════════════════════════════
- Nivel de energía diaria: ${habitos.checkin_energia || 3}/5
- Control de saciedad / apetito: ${habitos.checkin_saciedad || 3}/5 (1 = mucha hambre/antojos incontrolables, 5 = plenamente saciado)
- Calidad de digestión: ${habitos.checkin_digestion || 3}/5 (1 = malestares frecuentes, inflamación o reflujo, 5 = óptima)
- Calidad y horas de sueño: ${habitos.horas_sueno || 7} horas
- Nivel de estrés: ${habitos.nivel_estres || 3}/5
- Consumo de agua diario estimado: ${habitos.consumo_agua || "No especificado"}
- ACTIVIDAD FÍSICA PREVIA / ACTUAL: ${habitos.dias_ejercicio_actuales || habitos.actividad_previa || "0"} días por semana (Punto de partida del paciente).

═══════════════════════════════════════════════════════════
3. PASO 2: PREFERENCIAS ALIMENTARIAS PARA ESTA ETAPA
═══════════════════════════════════════════════════════════
- Alimentos e ingredientes favoritos: ${preferencias || "No especificados"}
- Alimentos o comidas que prefiere evitar (aversiones personales): ${aversiones || "No especificados"}

═══════════════════════════════════════════════════════════
4. PASO 3: RECORDATORIO DE 24 HORAS (R24H) - LO QUE COME HOY
═══════════════════════════════════════════════════════════
- Desayuno: ${r24h.desayuno || "No reportado"}
- Colación matutina: ${r24h.colacion_m || "No reportada"}
- Comida principal: ${r24h.comida || "No reportada"}
- Colación vespertina: ${r24h.colacion_v || "No reportada"}
- Cena: ${r24h.cena || "No reportada"}
- Bebidas habituales y picoteos: ${r24h.picoteos || "No reportados"}

═══════════════════════════════════════════════════════════
5. PASO 4: ENFOQUE Y PLANIFICACIÓN PARA ESTE NUEVO CICLO
═══════════════════════════════════════════════════════════
- Objetivo fijado para este ciclo: ${calcMatematico.goalTitle || "Déficit / Recomposición"} (${calcMatematico.goalPct || 0}%)
- ACTIVIDAD FÍSICA PROGRAMADA EN ESTE CICLO: ${habitos.faf_proyectado_etapa || "Moderado (3 a 5 días/semana)"} (Factor FAF ${calcMatematico.faf || 1.55}).
  *NOTA CLÍNICA VITAL:* El paciente parte de su actividad previa (${habitos.dias_ejercicio_actuales || "0"} días), pero el plan acordado es cumplir con ${habitos.faf_proyectado_etapa || "3 a 5 días"}. Evalúa si el déficit debe ser conservador o escalonado para no abrumar al paciente en esta transición.

═══════════════════════════════════════════════════════════
6. PASO 5: PROTOCOLO ANTROPOMÉTRICO Y COMPOSICIÓN CORPORAL
═══════════════════════════════════════════════════════════
- Protocolo utilizado: ${metrica.metodo_label || metrica.metodo_evaluacion || "Plicometría / Antropometría"}
- Peso: ${metrica.peso} kg | Estatura: ${metrica.estatura} cm | IMC: ${metrica.imc || "Normal"}
- % Grasa Corporal: ${metrica.grasa_pct ? `${metrica.grasa_pct}% (${metrica.masa_grasa_kg || "N/A"} kg de grasa)` : "No medido"}
- Masa Libre de Grasa (MLG): ${metrica.masa_libre_grasa ? `${metrica.masa_libre_grasa} kg` : "No medida"}
- Masa Muscular esquelética: ${metrica.masa_muscular_kg ? `${metrica.masa_muscular_kg} kg` : "No medida"}
${metrica.pliegues_str ? `- Pliegues cutáneos (mm): ${metrica.pliegues_str}` : ""}
${metrica.circunferencias_str ? `- Circunferencias (cm): ${metrica.circunferencias_str}` : ""}
${metrica.inbody_bmr ? `- BMR InBody BIA directo: ${metrica.inbody_bmr} kcal` : ""}

═══════════════════════════════════════════════════════════
7. CÁLCULO MATEMÁTICO BASE DE FLUX (FÓRMULA ${calcMatematico.formulaLabel || "Katch-McArdle"})
═══════════════════════════════════════════════════════════
- Tasa Metabólica Basal (TMB): ${calcMatematico.tmb} kcal/día
- Gasto Energético Total de MANTENIMIENTO (GET con FAF ${calcMatematico.faf || 1.55}): ${calcMatematico.get} kcal/día
- META DE ETAPA PROPUESTA POR LA FÓRMULA: ${calcMatematico.targetKcal} kcal/día (${calcMatematico.goalPct}% respecto al mantenimiento)
- Distribución matemática base: Proteína ${calcMatematico.proteinG}g (${calcMatematico.protGKg} g/kg), Grasas ${calcMatematico.fatsG}g (${calcMatematico.fatGKg} g/kg), Carbohidratos ${calcMatematico.carbsG}g (${calcMatematico.carbGKg || "N/A"} g/kg).

═══════════════════════════════════════════════════════════
INSTRUCCIONES CLÍNICAS CRÍTICAS PARA TU AUDITORÍA:
═══════════════════════════════════════════════════════════
1. CONTRASTA DIRECTAMENTE CONTRA LA META DE ETAPA (${calcMatematico.targetKcal} kcal), NO CONTRA EL MANTENIMIENTO (${calcMatematico.get} kcal):
   - Recuerda: el nutriólogo NO le va a recetar ${calcMatematico.get} kcal; la meta calculada para este ciclo ya contempla el objetivo y es de ${calcMatematico.targetKcal} kcal.
   - En tu explicación, debes comparar explícitamente tu sugerencia calórica contra esos ${calcMatematico.targetKcal} kcal (ejemplo: "La fórmula propone ${calcMatematico.targetKcal} kcal (${calcMatematico.goalPct}% respecto a su GET de ${calcMatematico.get}), pero sugiero ajustar a [X] kcal (un recorte de [Y] kcal adicionales respecto a la fórmula) debido a...").
2. EVALÚA LA TRANSICIÓN DE ACTIVIDAD (PASO 1 VS PASO 4):
   - El paciente viene de ${habitos.dias_ejercicio_actuales || "0"} días de actividad previa, pero el plan proyectado es ${habitos.faf_proyectado_etapa || "3 a 5 días"}.
   - Analiza si el gasto de ${calcMatematico.get} kcal se cumplirá de inmediato o si es prudente modular las calorías considerando que la adaptación al ejercicio toma tiempo.
3. ADAPTA LOS MACROS A SU METABOLISMO Y PATOLOGÍAS:
   - Si tiene sobrepeso/obesidad, dosifica la proteína preferentemente sobre la masa magra (${metrica.masa_libre_grasa || "peso"}) para no sobreestimar la carga proteica, o entre 1.6 y 2.2 g/kg según el caso.
   - Si hay hipertensión o dislipidemia, limita sodios y grasas saturadas de embutidos o alimentos procesados reportados en su R24H.
   - Si hay intolerancias (ej. lácteos), ajusta el menú eliminando o sustituyendo esos alimentos.
4. COHERENCIA MATEMÁTICA ESTRICTA:
   - La suma de tus macros debe coincidir exactamente con las calorías que recomiendes:
     (targetKcal = proteinG * 4 + carbsG * 4 + fatsG * 9).
   - protGKg debe ser exactamente: Math.round((proteinG / ${metrica.peso || 70}) * 100) / 100.
   - fatGKg debe ser exactamente: Math.round((fatsG / ${metrica.peso || 70}) * 100) / 100.
   - carbGKg debe ser exactamente: Math.round((carbsG / ${metrica.peso || 70}) * 100) / 100.

Debes responder ÚNICAMENTE con un JSON válido con la siguiente estructura exacta:
{
  "targetKcal": number,
  "proteinG": number,
  "protGKg": number,
  "carbsG": number,
  "carbGKg": number,
  "fatsG": number,
  "fatGKg": number,
  "badgeMotivo": "string breve (máx 30 caracteres, ej: Déficit Escalonado o Ajuste Metabólico)",
  "analisisClinico": "string con el criterio clínico razonado de especialista (2 a 3 oraciones, contrastando claramente contra la meta matemática de ${calcMatematico.targetKcal} kcal)",
  "ajustesSugeridos": ["ajuste clínico 1", "ajuste clínico 2", "ajuste clínico 3"],
  "estrategiaMenu": "string con sugerencias directas y prácticas de menú integrando sus favoritos y reemplazando los malos hábitos de su R24H"
}`;

    for (const model of ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptAudit }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            const parsed = JSON.parse(text);
            return {
              ...parsed,
              origen: "gemini_direct",
              model,
              generadoEn: new Date().toISOString(),
            };
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          const msg = errData?.error?.message || `HTTP ${res.status}`;
          if (res.status === 401 || res.status === 403) {
            throw new Error(`La API Key de Gemini fue rechazada (${msg}). Verifica que sea una clave válida de Google AI Studio.`);
          }
        }
      } catch (err) {
        if (err.message?.includes("rechazada")) throw err;
      }
    }
  }

  throw new Error(
    "No se pudo conectar con Google Gemini. Asegúrate de configurar una API Key válida (GEMINI_API_KEY) en Supabase Secrets o en el archivo .env."
  );
}

/**
 * ═════════════════════════════════════════════════════════════════════
 * NUEVAS HERRAMIENTAS DE OPTIMIZACIÓN CLÍNICA DE COMIDAS CON GEMINI
 * ═════════════════════════════════════════════════════════════════════
 */

/**
 * Optimiza y calcula automáticamente los macros de una comida a partir de su texto e ingredientes,
 * y realiza una auditoría clínica contra las aversiones, alergias y expediente del paciente.
 */
export async function optimizeMealWithAi({ textoComida, targetKcal = 0, clinicalRec = null, cliente = {} }) {
  if (!textoComida || !textoComida.trim()) {
    throw new Error("Escribe los ingredientes o descripción del platillo para optimizar con IA.");
  }

  const anamnesis = clinicalRec?.anamnesis || {};
  const apiKey = getGeminiApiKey();

  // 1. Intentar llamar a Edge Function de Supabase
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const edgeRes = await invokeEdgeFunction("clinical-ai", {
      action: "optimize-meal",
      textoComida: textoComida.trim(),
      targetKcal,
      anamnesis,
      cliente,
      geminiKey: apiKey,
    });
    clearTimeout(timeoutId);
    if (edgeRes?.calorias || edgeRes?.proteina) {
      return edgeRes;
    }
  } catch {}

  // 2. Fallback directo a Google Gemini API
  if (apiKey) {
    const prompt = `Eres un nutriólogo clínico y bromatólogo experto de FLUX.
Analiza la siguiente comida/receta diseñada para un paciente y calcula con máxima precisión sus calorías y macronutrientes basados en tablas de composición de alimentos (USDA/SMAE).
Adicionalmente, coteja los ingredientes contra el expediente del paciente para detectar si hay algún conflicto con alergias o aversiones personales.

EXPEDIENTE DEL PACIENTE:
- Nombre: ${cliente.nombre || "Paciente"} (${cliente.genero === "F" ? "Mujer" : "Hombre"})
- Alergias e intolerancias: ${anamnesis.alergias_intolerancias || "Ninguna"}
- Aversiones alimentarias (no le gusta comer): ${anamnesis.aversiones_alimentos || "Ninguna"}
- Preferencias / favoritos: ${anamnesis.preferencias_alimentos || "Ninguna"}
- Patologías: ${anamnesis.patologias || "Ninguna"}

COMIDA A ANALIZAR:
"${textoComida.trim()}"
${targetKcal > 0 ? `(Meta de referencia para esta toma: ~${targetKcal} kcal)` : ""}

INSTRUCCIONES:
1. Calcula calorías totales, gramos de proteína, carbohidratos y grasas con coherencia química (Kcal = P*4 + C*4 + G*9).
2. Si detectas algún ingrediente que coincida o sea derivado de las aversiones o alergias del paciente, genera una advertencia clínica amigable en "alertaClinica". Si todo está bien, devuelve null.
3. Extrae un nombre normalizado corto (máx 5 palabras) y una lista de 4-6 palabras clave de ingredientes para búsqueda en catálogo visual.

Debes responder ÚNICAMENTE con un JSON con esta estructura:
{
  "calorias": number,
  "proteina": number,
  "carbohidratos": number,
  "grasas": number,
  "nombreNormalizado": "string corto",
  "palabrasClave": ["ingrediente1", "ingrediente2", "ingrediente3"],
  "alertaClinica": "string con aviso si choca con aversión/alergia, o null si es seguro",
  "resumenNutricional": "string breve de 1 oración sobre la calidad de la toma"
}`;

    for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            return JSON.parse(text);
          }
        }
      } catch {}
    }
  }

  throw new Error("No se pudo conectar con el motor de IA. Revisa tu conexión a internet o API Key.");
}

/**
 * Genera una opción de comida alternativa iso-macronutriente (con los mismos macros y calorías),
 * respetando gustos del paciente y evitando sus aversiones.
 */
export async function generateAlternativeMealWithAi({ mainMealText, targetMacros = {}, clinicalRec = null, cliente = {} }) {
  if (!mainMealText || !mainMealText.trim()) {
    throw new Error("Se requiere la opción principal para generar una alternativa equivalente.");
  }

  const anamnesis = clinicalRec?.anamnesis || {};
  const apiKey = getGeminiApiKey();
  const kcal = Number(targetMacros.calorias) || 0;
  const p = Number(targetMacros.proteina) || 0;
  const c = Number(targetMacros.carbohidratos) || 0;
  const f = Number(targetMacros.grasas) || 0;

  if (apiKey) {
    const prompt = `Eres un chef y nutriólogo deportivo de élite de FLUX.
Genera una OPCIÓN ALTERNATIVA EQUIVALENTE (ISO-MACRONUTRIENTE) a la opción principal que te proporcionamos.
La alternativa debe ser atractiva, con ingredientes comunes y fáciles de preparar, y debe IGUALAR con precisión los mismos macros de la opción principal.

OPCIÓN PRINCIPAL:
"${mainMealText.trim()}"
${kcal > 0 ? `METAS ISO-MACROS A IGUALAR: ${kcal} kcal | ${p}g Proteína | ${c}g Carbos | ${f}g Grasas` : ""}

PREFERENCIAS DEL PACIENTE:
- Alimentos favoritos: ${anamnesis.preferencias_alimentos || "Variado"}
- Aversiones (NO usar): ${anamnesis.aversiones_alimentos || "Ninguna"}
- Alergias (NO usar): ${anamnesis.alergias_intolerancias || "Ninguna"}

INSTRUCCIONES:
1. Redacta la opción alternativa con porciones exactas en gramos, tazas o piezas.
2. Si la opción principal fue salada, la alternativa puede ser otra opción salada distinta o dulce si encaja con la toma.
3. No uses ningún ingrediente que esté en las aversiones o alergias del paciente.

Debes responder ÚNICAMENTE con un JSON con esta estructura:
{
  "texto": "string con la preparación, ingredientes y porciones exactas de la opción alternativa",
  "calorias": number,
  "proteina": number,
  "carbohidratos": number,
  "grasas": number,
  "nombreNormalizado": "string breve del platillo alternativo"
}`;

    for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
              },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            return JSON.parse(text);
          }
        }
      } catch {}
    }
  }

  throw new Error("No se pudo conectar con el motor de IA para generar la alternativa.");
}

/**
 * Diseña un platillo a partir de ingredientes disponibles / despensa para cuadrar con los macros de la toma.
 */
export async function generateMealFromPantryWithAi({ ingredientesDisponibles, targetMacros = {}, clinicalRec = null, cliente = {} }) {
  if (!ingredientesDisponibles || !ingredientesDisponibles.trim()) {
    throw new Error("Indica los ingredientes disponibles para sugerir el platillo.");
  }

  const anamnesis = clinicalRec?.anamnesis || {};
  const apiKey = getGeminiApiKey();
  const kcal = Number(targetMacros.calorias) || 500;
  const p = Number(targetMacros.proteina) || 35;
  const c = Number(targetMacros.carbohidratos) || 50;
  const f = Number(targetMacros.grasas) || 15;

  if (apiKey) {
    const prompt = `Eres un chef y nutriólogo clínico deportivo de FLUX.
El nutriólogo o paciente cuenta con estos ingredientes en su despensa o refri:
"${ingredientesDisponibles.trim()}"

Tu tarea es crear un platillo delicioso, balanceado y práctico utilizando prioritariamente esos ingredientes (puedes agregar básicos como sal, pimienta, limón o aceite con moderación) para alcanzar esta meta nutricional:
- Calorías meta: ~${kcal} kcal
- Proteína: ~${p}g
- Carbohidratos: ~${c}g
- Grasas: ~${f}g

Evita estrictamente: ${anamnesis.alergias_intolerancias || ""} ${anamnesis.aversiones_alimentos || ""}.

Debes responder ÚNICAMENTE con un JSON:
{
  "texto": "string con el nombre del platillo, ingredientes con porciones exactas (g, tazas, piezas) y breve modo de preparación",
  "nombreNormalizado": "string breve del platillo",
  "calorias": number,
  "proteina": number,
  "carbohidratos": number,
  "grasas": number
}`;

    for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
              },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            return JSON.parse(text);
          }
        }
      } catch {}
    }
  }

  throw new Error("No se pudo conectar con el motor de IA para generar la receta por despensa.");
}
