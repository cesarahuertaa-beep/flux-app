import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://flux-sport.com",
  "https://www.flux-sport.com",
  "https://flux-app-xi.vercel.app",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:5173",
  "http://localhost:3000",
];

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

function parseTags(rawText: string | null | undefined): string[] {
  if (!rawText || typeof rawText !== "string") return [];
  const cleaned = rawText.replace(/^(ningun[ao]s?|no|n\/a|nada|ninguno\.)/i, "").trim();
  if (!cleaned) return [];
  const rawParts = cleaned.split(/[,;\n/•\+\-]+|\s+(?:y|e|\&)\s+/i);
  const seen = new Set<string>();
  const result: string[] = [];
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

function joinSpanishList(items: string[]): string {
  if (!items || items.length === 0) return "";
  if (items.length === 1) return items[0];
  const last = items[items.length - 1];
  const initial = items.slice(0, -1).join(", ");
  const conj = /^[iíIÍ]|^h[iíIÍ]/.test(last.trim()) ? " e " : " y ";
  return `${initial}${conj}${last}`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "clinical-synopsis";
    const geminiKey =
      body.geminiKey ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("VITE_GEMINI_API_KEY") ||
      "";

    // =========================================================================
    // ACCIÓN 1: AUDITORÍA DE PRESCRIPCIÓN DE MACROS CON GOOGLE GEMINI (REAL)
    // =========================================================================
    if (action === "audit-macros") {
      if (!geminiKey || geminiKey.trim().length < 20) {
        return new Response(
          JSON.stringify({
            error: "NO_GEMINI_KEY",
            message:
              "No se ha configurado la API Key de Google Gemini. Configura GEMINI_API_KEY en Supabase Secrets o en las variables de entorno.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cliente = body.cliente || {};
      const anamnesis = body.anamnesis || {};
      const metrica = body.metrica || {};
      const r24h = body.r24h || {};
      const habitos = body.habitos || {};
      const calcMat = body.calcMatematico || {};

      const promptAudit = `Eres un médico y nutriólogo clínico deportivo de élite en FLUX.
Tu tarea es AUDITAR Y RECOMENDAR LA PRESCRIPCIÓN ENERGÉTICA Y DE MACRONUTRIENTES para un paciente real.

DATOS DEL PACIENTE:
- Sexo: ${cliente.genero || metrica.sexo || "No especificado"}
- Edad: ${cliente.edad || metrica.edad || "No especificada"} años
- Peso actual: ${metrica.peso || "0"} kg
- Estatura: ${metrica.estatura || "0"} cm
- Porcentaje de grasa: ${metrica.grasa_pct ? `${metrica.grasa_pct}%` : "No medido"}
- Masa libre de grasa: ${metrica.masa_libre_grasa ? `${metrica.masa_libre_grasa} kg` : "No medida"}
- Patologías y antecedentes médicos: ${anamnesis.patologias || "Ninguna"}
- Medicación y suplementos: ${anamnesis.medicacion_suplementos || "Ninguna"}
- Alergias e intolerancias: ${anamnesis.alergias_intolerancias || "Ninguna"}

CHECK-IN Y HÁBITOS DE VIDA:
- Nivel de estrés: ${habitos.nivel_estres || 3}/5
- Control de saciedad: ${habitos.checkin_saciedad || 3}/5 (1 = mucha hambre/antojos, 5 = muy saciado)
- Nivel de energía: ${habitos.checkin_energia || 3}/5
- Digestión: ${habitos.checkin_digestion || 3}/5 (1 = malestares frecuentes, 5 = óptima)
- Horas de sueño diarias: ${habitos.horas_sueno || 7} horas
- Consumo de agua estimado: ${habitos.consumo_agua || "No especificado"}

RECORDATORIO DE 24 HORAS (R24H) REPORTADO POR EL PACIENTE:
- Desayuno: ${r24h.desayuno || "No reportado"}
- Colación matutina: ${r24h.colacion_m || "No reportada"}
- Comida principal: ${r24h.comida || "No reportada"}
- Colación vespertina: ${r24h.colacion_v || "No reportada"}
- Cena: ${r24h.cena || "No reportada"}
- Picoteos / Bebidas extras: ${r24h.picoteos || "No reportados"}

PREFERENCIAS DEL PACIENTE:
- Alimentos favoritos: ${body.preferencias || "No especificados"}
- Alimentos que evita o rechaza: ${body.aversiones || "No especificados"}

CÁLCULO MATEMÁTICO BASE (FÓRMULA ${calcMat.formulaLabel || "Estándar"}):
- Tasa Metabólica Basal (TMB): ${calcMat.tmb || 0} kcal
- Gasto Energético Total (GET con FAF): ${calcMat.get || 0} kcal
- Objetivo fijado: ${calcMat.goalTitle || "Mantenimiento"} (${calcMat.goalPct || 0}%)
- Calorías objetivo según fórmula: ${calcMat.targetKcal || 0} kcal
- Macros según fórmula: Proteína ${calcMat.proteinG || 0}g (${calcMat.protGKg || 2.0} g/kg), Grasas ${calcMat.fatsG || 0}g (${calcMat.fatGKg || 0.9} g/kg), Carbohidratos ${calcMat.carbsG || 0}g.

INSTRUCCIONES CLÍNICAS PARA TU RESPUESTA:
1. Evalúa si el cálculo puramente matemático es realista para el estilo de vida, R24H y antecedentes del paciente.
2. Si el R24H muestra un consumo calórico muy diferente o picoteos frecuentes, ajusta las calorías a un déficit/superávit de transición que garantice apego sin choque calórico brusco.
3. Ajusta los gramos de proteína (g/kg) y grasas (g/kg) según el perfil metabólico (ej. si hay sobrepeso/obesidad dosifica sobre peso magro o 1.8-2.0 g/kg; si hay malestar digestivo reduce grasas; si hay resistencia a insulina controla carbohidratos netos).
4. Redacta un análisis clínico honesto y razonado, indicando variables encontradas y la justificación del ajuste.
5. Brinda una estrategia práctica de menú para coordinar las comidas según los horarios y hábitos del R24H.

Debes responder ÚNICAMENTE con un JSON válido con la siguiente estructura exacta:
{
  "targetKcal": number,
  "proteinG": number,
  "protGKg": number,
  "carbsG": number,
  "carbGKg": number,
  "fatsG": number,
  "fatGKg": number,
  "badgeMotivo": "string breve (máx 30 caracteres, ej: Déficit Progresivo o Ajuste Metabólico)",
  "analisisClinico": "string con el criterio clínico razonado de especialista (2 a 3 oraciones)",
  "ajustesSugeridos": ["ajuste 1", "ajuste 2"],
  "estrategiaMenu": "string con sugerencias directas y prácticas de menú basadas en lo que come"
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
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (textResponse) {
              const parsed = JSON.parse(textResponse);
              return new Response(
                JSON.stringify({
                  success: true,
                  origen: "gemini",
                  model,
                  generadoEn: new Date().toISOString(),
                  prescription: parsed,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            const errBody = await res.json().catch(() => ({}));
            const msg = errBody?.error?.message || `Error HTTP ${res.status}`;
            if (res.status === 401 || res.status === 403) {
              return new Response(
                JSON.stringify({
                  error: "GEMINI_AUTH_ERROR",
                  message: `La API Key de Gemini fue rechazada por Google (${msg}). Verifica que sea una clave válida de Google AI Studio.`,
                }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } catch (e: any) {
          // Continuar al siguiente modelo
        }
      }

      return new Response(
        JSON.stringify({
          error: "GEMINI_UNAVAILABLE",
          message: "No se pudo obtener respuesta de Google Gemini en este momento. Inténtalo nuevamente.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // ACCIÓN 2: SÍNTESIS DE EXPEDIENTE CLÍNICO
    // =========================================================================
    const anamnesis = body.anamnesis || {};
    const cliente = body.cliente || {};

    const patologiasRaw = (anamnesis.patologias || "").trim();
    const patologias = parseTags(patologiasRaw);
    const tienePatologias =
      patologias.length > 0 || (patologiasRaw.length > 2 && !/^(no|ningun|nada|n\/a)/i.test(patologiasRaw));

    const alergiasRaw = (anamnesis.alergias_intolerancias || "").trim();
    const alergias = parseTags(alergiasRaw);

    const aversionesRaw = (anamnesis.aversiones_alimentos || "").trim();
    const aversiones = parseTags(aversionesRaw);

    const preferenciasRaw = (anamnesis.preferencias_alimentos || "").trim();
    const preferencias = parseTags(preferenciasRaw);

    const digestivoRaw = (anamnesis.sintomas_gi || "").trim();
    const isNormalGI =
      !digestivoRaw || /^(norm[a-z]*|bien|sin|ning[uú]n[ao]s?|nada|ok|n\/a)$/i.test(digestivoRaw);

    const sueno = (anamnesis.horas_sueno || "").trim();
    const estresNivel = parseInt(anamnesis.nivel_estres || "3", 10);
    const agua = (anamnesis.consumo_agua_estimado || "").trim();
    const objetivo = (
      anamnesis.objetivo_principal ||
      anamnesis.objetivo_expectativas ||
      cliente?.objetivo ||
      ""
    ).trim();

    const exclusionesMap = new Map<string, string>();
    [...alergias, ...aversiones].forEach((item) => {
      const k = item.toLowerCase();
      if (!exclusionesMap.has(k)) exclusionesMap.set(k, item.toLowerCase());
    });
    const itemsExcluir = Array.from(exclusionesMap.values());
    const exclusionesStr = itemsExcluir.length > 0 ? itemsExcluir.join(", ") : "Ninguna";

    if (geminiKey && geminiKey.trim().length >= 20) {
      const prompt = `Eres una IA médica y de nutrición clínica de FLUX.
Analiza la siguiente información de expediente y redacta un DIAGNÓSTICO CLÍNICO-NUTRICIONAL EJECUTIVO (exactamente 1 párrafo fluido de 3 a 4 oraciones) para el especialista.

Criterios clínicos de especialista:
1. Evalúa el impacto metabólico de sus patologías (ej. si dice 'Dabetes tipo 1', corrígelo a Diabetes Mellitus Tipo 1, explicando consideraciones clínicas relevantes).
2. Considera sus alergias y aversiones (${exclusionesStr}) como exclusiones obligatorias consolidadas sin repetir alimentos. Si la digestión o síntomas GI es 'Normal', reconoce que su función gastrointestinal es óptima (¡NUNCA digas que se debe excluir la digestión normal!).
3. Explica cómo capitalizar sus alimentos favoritos (${preferenciasRaw || "ninguno"}) estratégicamente (ej. cortes magros de carne roja para hierro y proteína de alto valor biológico).
4. Integra su estilo de vida (${sueno || "8h"} de sueño, estrés nivel ${estresNivel}/5, agua ${agua || "2L"}) como base favorable para la formulación del plan.

DATOS DEL PACIENTE:
- Sexo: ${cliente?.genero === "F" || cliente?.sexo === "F" ? "Femenino" : "Masculino"}
- Objetivo: ${objetivo || "Mejorar salud y composición corporal"}
- Diagnósticos: ${patologiasRaw || "Ninguno"}
- Alergias: ${alergiasRaw || "Ninguna"}
- Digestión / Síntomas GI: ${isNormalGI ? "Normal / Saludable" : digestivoRaw || "Normal"}
- Alimentos que evita o rechaza: ${aversionesRaw || "Ninguno"}
- Alimentos favoritos: ${preferenciasRaw || "Ninguno"}
- Sueño: ${sueno || "No especificado"}
- Estrés: ${estresNivel}/5
- Agua: ${agua || "No especificado"}

Responde ÚNICAMENTE con el párrafo de diagnóstico clínico, fluido, redactado con lenguaje médico profesional y directo. Sin listas ni viñetas.`;

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
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.25, maxOutputTokens: 350 },
              }),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text && text.length > 30) {
              return new Response(
                JSON.stringify({
                  texto: text,
                  origen: "gemini",
                  model,
                  generadoEn: new Date().toISOString(),
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } catch {
          // Probar siguiente modelo
        }
      }
    }

    // Fallback analítico transparente para expediente
    const sexoStr =
      cliente?.genero === "F" || cliente?.sexo === "F" ? "Paciente femenina" : "Paciente masculino";
    const sintesisParts: string[] = [];

    if (tienePatologias) {
      sintesisParts.push(
        `${sexoStr} con perfil clínico condicionado por ${patologiasRaw}, orientado hacia la meta de ${
          objetivo ? objetivo.toLowerCase() : "optimización de la salud"
        }.`
      );
    } else {
      sintesisParts.push(
        `${sexoStr} sin patologías crónicas reportadas, con función metabólica favorable orientada a ${
          objetivo ? objetivo.toLowerCase() : "la mejora de la composición corporal"
        }.`
      );
    }

    if (itemsExcluir.length > 0) {
      sintesisParts.push(
        `Se establece la exclusión estricta de ${joinSpanishList(
          itemsExcluir
        )} para garantizar la seguridad clínica frente a alergias y asegurar apego total al plan.`
      );
    }

    return new Response(
      JSON.stringify({
        texto: sintesisParts.join(" "),
        origen: "analitico_base",
        generadoEn: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Error procesando solicitud con IA" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
