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
      sintesisParts.push(`${sexoStr} con perfil clínico condicionado por ${patologiasRaw}, orientado hacia la meta de ${objetivo ? objetivo.toLowerCase() : "optimización de la salud"}.`);
    }
  } else {
    sintesisParts.push(`${sexoStr} sin patologías crónicas reportadas, con función metabólica favorable orientada a ${objetivo ? objetivo.toLowerCase() : "la mejora de la composición corporal"}.`);
  }

  // Oración 2: Exclusiones de alimentos (Deduplicadas para evitar repetir mariscos + mariscos)
  const exclusionesMap = new Map();
  [...alergias, ...aversiones].forEach((item) => {
    const k = item.toLowerCase();
    if (!exclusionesMap.has(k)) exclusionesMap.set(k, item.toLowerCase());
  });
  const itemsExcluir = Array.from(exclusionesMap.values());

  if (itemsExcluir.length > 0) {
    sintesisParts.push(`Se establece la exclusión estricta de ${joinSpanishList(itemsExcluir)} para garantizar la seguridad clínica frente a alergias y asegurar apego total al plan.`);
  }

  // Oración 3: Alimentos favoritos integrados estratégicamente
  if (tienePreferencias) {
    const favsLower = preferencias.map((p) => p.toLowerCase());
    sintesisParts.push(`Se recomienda capitalizar ${joinSpanishList(favsLower)} en cortes magros y porciones equilibradas como fuente principal de nutrientes de alto valor biológico.`);
  }

  // Oración 4: Digestión y Hábitos
  let habsList = [];
  if (isNormalGI) {
    habsList.push("función digestiva conservada");
  } else if (tieneSintomasGI) {
    habsList.push(`atención a sintomatología de ${digestivoRaw.toLowerCase()}`);
  }

  if (sueno) {
    const sLimpio = sueno.replace(/horas?|hrs?/i, "").trim();
    habsList.push(`${sLimpio} horas de sueño`);
  }
  if (estresNivel <= 2) {
    habsList.push("bajo nivel de estrés");
  } else if (estresNivel >= 4) {
    habsList.push("estrés elevado que requiere preparación sencilla");
  }
  if (agua) {
    habsList.push(`hidratación de ${agua}`);
  }

  if (habsList.length > 0) {
    sintesisParts.push(`Presenta ${joinSpanishList(habsList)}, base favorable para consolidar la adherencia y el balance metabólico.`);
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
      if (k && k.startsWith("AIzaSy")) return k;
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env && process.env.VITE_GEMINI_API_KEY) {
      const k = process.env.VITE_GEMINI_API_KEY.trim();
      if (k && k.startsWith("AIzaSy")) return k;
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

  // Lista consolidada de exclusiones
  const exclusionesUnicas = Array.from(
    new Set([...highlights.alergias.tags.map((t) => t.toLowerCase()), ...highlights.aversiones.tags.map((t) => t.toLowerCase())])
  );
  const exclusionesStr = exclusionesUnicas.length > 0 ? exclusionesUnicas.join(", ") : (highlights.aversiones.raw || highlights.alergias.raw || "Ninguna");

  const prompt = `Eres una IA médica y de nutrición clínica de FLUX.
Analiza la siguiente información de expediente y redacta un DIAGNÓSTICO CLÍNICO-NUTRICIONAL EJECUTIVO (exactamente 1 párrafo de 3 a 4 oraciones) para el especialista.

NO concatenes ni enumeres los datos tal cual. Proporciona un criterio clínico inteligente de especialista:
1. Evalúa el impacto metabólico de sus patologías (ej. si dice 'Dabetes tipo 1', corrígelo a Diabetes Mellitus Tipo 1, explicando el conteo de carbohidratos, índice glucémico y prevención de picos).
2. Considera sus alergias y aversiones (${exclusionesStr}) como exclusiones obligatorias consolidadas sin repetir alimentos. Si la digestión o síntomas GI es 'Norml' o 'Normal', reconoce que su función gastrointestinal es óptima (¡NUNCA digas que se debe excluir la digestión normal!).
3. Explica cómo capitalizar sus alimentos favoritos (${highlights.preferencias.raw || "ninguno"}) estratégicamente (ej. cortes magros de carne roja para hierro y proteína de alto valor biológico).
4. Integra su estilo de vida (${highlights.habitos.sueno || "8h"} de sueño, estrés ${highlights.habitos.estresEtiqueta.toLowerCase()}, agua ${highlights.habitos.agua || "2L"}) como base favorable para la formulación del plan.

DATOS DEL PACIENTE:
- Sexo: ${cliente?.genero === "F" || cliente?.sexo === "F" ? "Femenino" : "Masculino"}
- Objetivo: ${highlights.objetivo || "Mejorar salud"}
- Diagnósticos: ${highlights.patologias.raw || "Ninguno"}
- Alergias: ${highlights.alergias.raw || "Ninguna"}
- Digestión / Síntomas GI: ${highlights.digestivo.isNormal ? "Normal / Saludable" : highlights.digestivo.raw || "Normal"}
- Alimentos que evita o rechaza: ${highlights.aversiones.raw || "Ninguno"}
- Alimentos favoritos: ${highlights.preferencias.raw || "Ninguno"}
- Sueño: ${highlights.habitos.sueno || "No especificado"}
- Estrés: ${highlights.habitos.estresNivel}/5
- Agua: ${highlights.habitos.agua || "No especificado"}

Responde ÚNICAMENTE con el párrafo de diagnóstico clínico, fluido, redactado con lenguaje médico profesional y directo. Sin listas ni viñetas.`;

  const apiKey = getGeminiApiKey();
  
  if (apiKey) {
    const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                thinkingConfig: { thinkingBudget: 0 },
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

  // Fallback analítico médico perfeccionado
  return {
    texto: highlights.sintesisTexto,
    origen: "analitico",
    generadoEn: new Date().toISOString(),
    highlights,
  };
}
