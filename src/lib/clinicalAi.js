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

  // 1. Intentar llamar a la Edge Function de Supabase (Backend seguro y centralizado)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const edgeRes = await invokeEdgeFunction("clinical-ai", { anamnesis, cliente });
    clearTimeout(timeoutId);

    if (edgeRes?.texto && edgeRes.texto.length > 30) {
      return {
        texto: edgeRes.texto,
        origen: edgeRes.origen || "edge_function",
        model: edgeRes.model || "gemini-2.0-flash",
        generadoEn: edgeRes.generadoEn || new Date().toISOString(),
        highlights,
      };
    }
  } catch {
    // Si la función de Supabase aún no está desplegada en el proyecto remoto o hay error de red, continuar
  }

  const prompt = `Eres una IA médica y de nutrición clínica de FLUX.
Analiza la siguiente información de expediente atemporal y redacta un DIAGNÓSTICO CLÍNICO-NUTRICIONAL EJECUTIVO (exactamente 1 párrafo de 3 a 4 oraciones) para el especialista.

NO concatenes ni enumeres los datos tal cual. Proporciona un criterio clínico inteligente de especialista:
1. Evalúa el impacto metabólico de sus patologías (ej. si dice 'Dabetes tipo 1', corrígelo a Diabetes Mellitus Tipo 1, explicando consideraciones clínicas relevantes).
2. Considera sus alergias e intolerancias alimentarias crónicas (${highlights.alergias.raw || "Ninguna"}) como exclusiones de seguridad médica obligatorias. Si los síntomas GI son 'Normal' o 'Saludable', reconoce que su función gastrointestinal es óptima (¡NUNCA digas que se debe excluir la digestión normal!).
3. Considera su medicación crónica actual (${highlights.medicacion.raw || "Ninguna"}) y antecedentes heredofamiliares (${highlights.heredo.raw || "Ninguno"}) para vigilancia preventiva.
4. Integra su contexto ocupacional (${highlights.habitos.ocupacion || "No especificada"}) y cirugías/lesiones (${highlights.lesiones.raw || "Ninguna"}) como base para el diseño del plan.

DATOS DEL PACIENTE:
- Sexo: ${cliente?.genero === "F" || cliente?.sexo === "F" ? "Femenino" : "Masculino"}
- Diagnósticos y Patologías Crónicas: ${highlights.patologias.raw || "Ninguno"}
- Alergias e Intolerancias Alimentarias: ${highlights.alergias.raw || "Ninguna"}
- Antecedentes Heredofamiliares: ${highlights.heredo.raw || "Ninguno"}
- Medicación y Suplementos Actuales: ${highlights.medicacion.raw || "Ninguno"}
- Cirugías y Lesiones Previas: ${highlights.lesiones.raw || "Ninguno"}
- Digestión / Síntomas GI: ${highlights.digestivo.isNormal ? "Normal / Saludable" : highlights.digestivo.raw || "Normal"}
- Ocupación / Actividad diaria: ${highlights.habitos.ocupacion || "No especificada"}
- Toxicomanías (Alcohol/Tabaco): ${highlights.habitos.alcoholTabaco || "No reportado"}

Responde ÚNICAMENTE con el párrafo de diagnóstico clínico, fluido, redactado con lenguaje médico profesional y directo. Sin listas ni viñetas.`;

  const apiKey = getGeminiApiKey();
  
  if (apiKey) {
    const candidateModels = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

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
                temperature: 0.3,
                maxOutputTokens: 350,
              },
            }),
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (geminiText && geminiText.length > 30) {
            return {
              texto: geminiText,
              origen: "gemini",
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
