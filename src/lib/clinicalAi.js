// Clinical AI Engine for FLUX
// Synthesizes clinical intake questionnaires, extracts key highlights, food preferences/aversions,
// and produces actionable insights for nutritionists and coaches.

/**
 * Splits comma-, semicolon-, slash-, or newline-separated strings into clean, deduplicated tags.
 */
export function parseTags(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const cleaned = rawText
    .replace(/^(ningun[ao]s?|no|n\/a|nada|ninguno\.)/i, "")
    .trim();
  if (!cleaned) return [];
  
  return cleaned
    .split(/[,;\n/•\+\-]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^(ningun[ao]s?|no|n\/a|nada)$/i.test(s));
}

/**
 * Extracts and classifies all critical points of an anamnesis record for quick nutritionist review.
 */
export function extractClinicalHighlights(anamnesis = {}, cliente = {}) {
  const ana = anamnesis || {};
  
  // 1. Patologías y Condiciones Médicas
  const patologiasRaw = ana.patologias || "";
  const patologias = parseTags(patologiasRaw);
  const tienePatologias = patologias.length > 0 || (patologiasRaw.trim().length > 2 && !/^(no|ningun|nada|n\/a)/i.test(patologiasRaw.trim()));

  // 2. Alergias e Intolerancias (Alta prioridad)
  const alergiasRaw = ana.alergias_intolerancias || "";
  const alergias = parseTags(alergiasRaw);
  const tieneAlergias = alergias.length > 0 || (alergiasRaw.trim().length > 2 && !/^(no|ningun|nada|n\/a)/i.test(alergiasRaw.trim()));

  // 3. Lesiones y Cirugías
  const lesionesRaw = ana.cirugias_lesiones || "";
  const lesiones = parseTags(lesionesRaw);
  const tieneLesiones = lesiones.length > 0 || (lesionesRaw.trim().length > 2 && !/^(no|ningun|nada|n\/a)/i.test(lesionesRaw.trim()));

  // 4. Medicación y Suplementos
  const medicacionRaw = ana.medicacion_suplementos || "";
  const medicacion = parseTags(medicacionRaw);
  const tieneMedicacion = medicacion.length > 0 || (medicacionRaw.trim().length > 2 && !/^(no|ningun|nada|n\/a)/i.test(medicacionRaw.trim()));

  // 5. Síntomas Digestivos / GI
  const digestivoRaw = ana.sintomas_gi || "";
  const sintomasGI = parseTags(digestivoRaw);
  const tieneSintomasGI = sintomasGI.length > 0 || (digestivoRaw.trim().length > 2 && !/^(no|ningun|nada|normal)/i.test(digestivoRaw.trim()));

  // 6. Alimentos que Rechaza (Aversiones) — ¡CRÍTICO!
  const aversionesRaw = ana.aversiones_alimentos || "";
  const aversiones = parseTags(aversionesRaw);
  const tieneAversiones = aversiones.length > 0 || (aversionesRaw.trim().length > 2 && !/^(no|ningun|nada)/i.test(aversionesRaw.trim()));

  // 7. Alimentos Favoritos (Preferencias)
  const preferenciasRaw = ana.preferencias_alimentos || "";
  const preferencias = parseTags(preferenciasRaw);
  const tienePreferencias = preferencias.length > 0 || (preferenciasRaw.trim().length > 2 && !/^(no|ningun|nada)/i.test(preferenciasRaw.trim()));

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

  // 10. Generación de Diagnóstico Clínico Estructurado (Motor Analítico Local)
  const nombre = (cliente?.nombre || "").trim().split(" ")[0] || "El paciente";
  const sexoStr = cliente?.genero === "F" || cliente?.sexo === "F" ? "Paciente femenina" : "Paciente masculino";
  
  let sintesisParts = [];

  // Párrafo 1: Evaluación metabólica y diagnósticos
  if (tienePatologias) {
    const isDiabetes = /diabet/i.test(patologiasRaw);
    const isTiroides = /hipotiroid|tiroid/i.test(patologiasRaw);
    const isHipertension = /hipertens|presi[oó]n/i.test(patologiasRaw);
    const isInsulina = /insulina|resistencia/i.test(patologiasRaw);

    let patoImpacto = `diagnóstico de ${patologiasRaw}`;
    if (isDiabetes) patoImpacto += ", requiriendo un control riguroso de carbohidratos, índice glucémico y distribución estable de las comidas";
    else if (isInsulina) patoImpacto += ", demandando una pauta baja en azúcares refinados y alta en fibra soluble";
    else if (isTiroides) patoImpacto += ", sugiriendo atención al metabolismo basal y micronutrientes tiroideos";
    else if (isHipertension) patoImpacto += ", aconsejando moderación de sodio y equilibrio electrolítico";

    sintesisParts.push(`${sexoStr} con perfil clínico marcado por ${patoImpacto}.`);
  } else {
    sintesisParts.push(`${sexoStr} sin patologías crónicas reportadas, con objetivo central de ${objetivo ? objetivo.toLowerCase() : "optimización de la composición corporal"}.`);
  }

  // Párrafo 2: Exclusiones obligatorias (Alergias y Aversiones)
  let exclusiones = [];
  if (tieneAlergias) exclusiones.push(`alergia confirmada a ${alergiasRaw}`);
  if (tieneAversiones) exclusiones.push(`aversión a ${aversionesRaw}`);
  if (tieneSintomasGI) exclusiones.push(`sintomatología GI (${digestivoRaw})`);

  if (exclusiones.length > 0) {
    sintesisParts.push(`Desde la perspectiva de prescripción, es indispensable excluir de forma absoluta ${exclusiones.join(" y ")} para evitar hipersensibilidad y deserción.`);
  }

  // Párrafo 3: Alimentos favoritos y estilo de vida
  let planEstrategia = [];
  if (tienePreferencias) {
    planEstrategia.push(`aprovechar ${preferenciasRaw} como fuente principal en los tiempos de comida`);
  }
  if (sueno || estresNivel >= 4 || agua) {
    let habs = [];
    if (sueno) habs.push(`${sueno} de descanso`);
    if (estresNivel >= 4) habs.push("alto nivel de estrés");
    else if (estresNivel <= 2) habs.push("bajo nivel de estrés");
    if (agua) habs.push(`hidratación de ${agua}`);
    planEstrategia.push(`acompañado de una base con ${habs.join(" y ")}`);
  }

  if (planEstrategia.length > 0) {
    sintesisParts.push(`Se aconseja ${planEstrategia.join(", ")}, consolidando un plan sostenible.`);
  }

  const sintesisTexto = sintesisParts.join(" ");

  return {
    nombre,
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
 * Generates an intelligent clinical diagnosis using Google Gemini or falls back to analytical synthesis.
 */
export async function generateClinicalAiSynopsis(anamnesis, cliente) {
  const highlights = extractClinicalHighlights(anamnesis, cliente);

  const prompt = `Eres una IA clínica especializada en nutrición deportiva y clínica de FLUX.
Genera un DIAGNÓSTICO Y ANÁLISIS CLÍNICO-NUTRICIONAL EJECUTIVO (exactamente 1 párrafo de 3 a 4 oraciones) para el especialista basado en el expediente.

NO te limites a concatenar o repetir datos en lista. Proporciona un criterio clínico inteligente de especialista:
1. Evalúa el impacto metabólico/clínico de sus diagnósticos o alertas (ej. Diabetes tipo 1 exige conteo de carbohidratos, índice glucémico y sincronización insulínica; hipotiroidismo, resistencia a la insulina o hipertensión su manejo respectivo).
2. Trata alergias y aversiones (alimentos que rechaza) como exclusiones obligatorias de seguridad y apego.
3. Explica cómo capitalizar sus alimentos favoritos estratégicamente en sus tomas para asegurar adherencia.
4. Evalúa su descanso (${highlights.habitos.sueno || "normal"}), estrés (${highlights.habitos.estresNivel}/5), agua (${highlights.habitos.agua || "normal"}) y picoteos, concluyendo con una recomendación táctica clara para la pauta.

DATOS DEL PACIENTE:
- Sexo: ${cliente?.genero === "F" || cliente?.sexo === "F" ? "Femenino" : "Masculino"}
- Objetivo: ${highlights.objetivo || "Mejorar salud y composición corporal"}
- Patologías/Diagnósticos: ${highlights.patologias.raw || "Sin patologías reportadas"}
- Alergias/Intolerancias: ${highlights.alergias.raw || "Ninguna"}
- Molestias GI: ${highlights.digestivo.raw || "Normal"}
- Lesiones o cirugías: ${highlights.lesiones.raw || "Ninguna"}
- Medicación/Suplementos: ${highlights.medicacion.raw || "Ninguna"}
- Alimentos que evita o rechaza (AVERSIONES): ${highlights.aversiones.raw || "Ninguno"}
- Alimentos predilectos (FAVORITOS): ${highlights.preferencias.raw || "Ninguno"}
- Horas de sueño: ${highlights.habitos.sueno || "No especificadas"}
- Nivel de estrés (1-5): ${highlights.habitos.estresNivel}/5
- Consumo de agua: ${highlights.habitos.agua || "No especificado"}
- Picoteos/Bebidas entre horas: ${highlights.r24h.picoteos || "No reportado"}

Responde ÚNICAMENTE con el párrafo de diagnóstico clínico, fluido, redactado con lenguaje médico profesional y directo. Sin listas ni viñetas.`;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  
  if (apiKey) {
    const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

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
          if (geminiText) {
            return {
              texto: geminiText,
              origen: "gemini",
              generadoEn: new Date().toISOString(),
              highlights,
            };
          }
        }
      } catch {
        // Continuar al siguiente modelo o fallback
      }
    }
  }

  // Fallback garantizado: Motor Analítico Clínico
  return {
    texto: highlights.sintesisTexto,
    origen: "analitico",
    generadoEn: new Date().toISOString(),
    highlights,
  };
}
