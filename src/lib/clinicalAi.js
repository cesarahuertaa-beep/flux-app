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

  // 10. Generación de Síntesis Clínica Estructurada (Inteligencia Inmediata)
  const nombre = (cliente?.nombre || "").trim().split(" ")[0] || "El paciente";
  const sexoStr = cliente?.genero === "F" || cliente?.sexo === "F" ? "Paciente femenina" : "Paciente masculino";
  
  let sintesisParts = [];

  // Oración 1: Perfil y Objetivo
  let p1 = `${sexoStr}`;
  if (objetivo) {
    p1 += ` con meta de ${objetivo.toLowerCase()}`;
  }
  sintesisParts.push(p1 + ".");

  // Oración 2: Alertas Médicas
  let alertasArray = [];
  if (tienePatologias) alertasArray.push(`diagnóstico de ${patologiasRaw}`);
  if (tieneAlergias) alertasArray.push(`alergia/intolerancia a ${alergiasRaw}`);
  if (tieneLesiones) alertasArray.push(`lesión o antecedente de ${lesionesRaw}`);
  if (tieneSintomasGI) alertasArray.push(`molestias GI (${digestivoRaw})`);

  if (alertasArray.length > 0) {
    sintesisParts.push(`Alertas clínicas: ${alertasArray.join(", ")}.`);
  } else {
    sintesisParts.push("Sin patologías ni alergias severas reportadas.");
  }

  // Oración 3: Alimentos (Qué evitar y qué incluir)
  if (tieneAversiones && tienePreferencias) {
    sintesisParts.push(`Alimentación: rechaza expresamente ${aversionesRaw}; priorizar como base sus favoritos (${preferenciasRaw}).`);
  } else if (tieneAversiones) {
    sintesisParts.push(`Alimentación: no tolera ni consume ${aversionesRaw} (evitar en el menú).`);
  } else if (tienePreferencias) {
    sintesisParts.push(`Alimentación: tiene preferencia por ${preferenciasRaw}.`);
  }

  // Oración 4: Estilo de vida y R24H
  let habitosArray = [];
  if (sueno) habitosArray.push(`${sueno} de sueño`);
  if (estresNivel >= 4) habitosArray.push("nivel de estrés alto");
  if (agua) habitosArray.push(`consumo de agua de ${agua}`);
  if (picoteos && !/^(no|ningun|nada)/i.test(picoteos)) {
    habitosArray.push(`picoteo/bebidas: ${picoteos}`);
  }
  if (habitosArray.length > 0) {
    sintesisParts.push(`Estilo de vida: ${habitosArray.join(", ")}.`);
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
 * Generates an intelligent clinical synopsis using Google Gemini or falls back to structured synthesis.
 */
export async function generateClinicalAiSynopsis(anamnesis, cliente) {
  const highlights = extractClinicalHighlights(anamnesis, cliente);

  // Prompt clínico estructurado para el nutriólogo
  const prompt = `Eres un asistente de nutrición clínica avanzada de la plataforma FLUX.
Analiza la historia inicial del siguiente paciente y redacta una síntesis clínica ejecutiva de máximo 3 a 4 oraciones directamente útil para el nutriólogo que diseñará su menú.

DATOS DEL PACIENTE:
- Nombre: ${cliente?.nombre || "Paciente"}
- Sexo: ${cliente?.genero === "F" || cliente?.sexo === "F" ? "Femenino" : "Masculino"}
- Objetivo principal: ${highlights.objetivo || "Mejora de composición corporal"}
- Patologías o diagnósticos: ${highlights.patologias.raw || "Ninguna"}
- Medicación y suplementos: ${highlights.medicacion.raw || "Ninguna"}
- Alergias o intolerancias: ${highlights.alergias.raw || "Ninguna"}
- Síntomas gastrointestinales: ${highlights.digestivo.raw || "Normal"}
- Cirugías o lesiones: ${highlights.lesiones.raw || "Ninguna"}
- Alimentos que rechaza o no le gustan (AVERSIONES): ${highlights.aversiones.raw || "Ninguno"}
- Alimentos predilectos (FAVORITOS): ${highlights.preferencias.raw || "Ninguno"}
- Ocupación / actividad: ${highlights.habitos.ocupacion || "No especificada"}
- Horas de sueño: ${highlights.habitos.sueno || "No especificadas"}
- Estrés (1-5): ${highlights.habitos.estresNivel}/5
- Consumo de agua: ${highlights.habitos.agua || "No especificado"}
- Recordatorio 24h:
  * Desayuno: ${highlights.r24h.desayuno || "No especificado"}
  * Colación matutina: ${highlights.r24h.colacion_m || "No"}
  * Comida: ${highlights.r24h.comida || "No especificado"}
  * Colación vespertina: ${highlights.r24h.colacion_v || "No"}
  * Cena: ${highlights.r24h.cena || "No especificado"}
  * Picoteos/bebidas: ${highlights.r24h.picoteos || "No reportado"}

REGLAS DE RESPUESTA:
1. Resalta enfáticamente lo que NUNCA debe incluirse en la dieta (aversiones y alergias).
2. Menciona qué alimentos favoritos incorporar para asegurar adherencia.
3. Menciona cualquier alerta médica (patología, lesión física o síntoma GI).
4. Resume brevemente su R24H/estilo de vida y una sugerencia táctica de ajuste.
5. Sé directo, profesional, médico y conciso (un solo párrafo continuo). No uses viñetas ni asteriscos innecesarios.`;

  // Intentar llamada a Gemini si está configurada la clave en el entorno
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout max

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
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
      // Fallback transparente al motor estructurado
    }
  }

  // Fallback garantizado: Síntesis Estructurada de Alto Rendimiento
  return {
    texto: highlights.sintesisTexto,
    origen: "estructurado",
    generadoEn: new Date().toISOString(),
    highlights,
  };
}
