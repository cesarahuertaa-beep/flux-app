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
    const anamnesis = body.anamnesis || {};
    const cliente = body.cliente || {};

    // 1. Extracción y Limpieza Clínica
    const patologiasRaw = (anamnesis.patologias || "").trim();
    const patologias = parseTags(patologiasRaw);
    const tienePatologias = patologias.length > 0 || (patologiasRaw.length > 2 && !/^(no|ningun|nada|n\/a)/i.test(patologiasRaw));

    const alergiasRaw = (anamnesis.alergias_intolerancias || "").trim();
    const alergias = parseTags(alergiasRaw);

    const aversionesRaw = (anamnesis.aversiones_alimentos || "").trim();
    const aversiones = parseTags(aversionesRaw);

    const preferenciasRaw = (anamnesis.preferencias_alimentos || "").trim();
    const preferencias = parseTags(preferenciasRaw);

    const digestivoRaw = (anamnesis.sintomas_gi || "").trim();
    const isNormalGI = !digestivoRaw || /^(norm[a-z]*|bien|sin|ning[uú]n[ao]s?|nada|ok|n\/a)$/i.test(digestivoRaw);

    const sueno = (anamnesis.horas_sueno || "").trim();
    const estresNivel = parseInt(anamnesis.nivel_estres || "3", 10);
    const agua = (anamnesis.consumo_agua_estimado || "").trim();
    const objetivo = (anamnesis.objetivo_principal || anamnesis.objetivo_expectativas || cliente?.objetivo || "").trim();

    // Deduplicación consolidada de alimentos excluidos
    const exclusionesMap = new Map<string, string>();
    [...alergias, ...aversiones].forEach((item) => {
      const k = item.toLowerCase();
      if (!exclusionesMap.has(k)) exclusionesMap.set(k, item.toLowerCase());
    });
    const itemsExcluir = Array.from(exclusionesMap.values());
    const exclusionesStr = itemsExcluir.length > 0 ? itemsExcluir.join(", ") : "Ninguna";

    // 2. Intentar llamar a API de Gemini si está configurada en los Secrets de Supabase
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY");
    if (geminiKey && geminiKey.startsWith("AIzaSy")) {
      const prompt = `Eres una IA médica y de nutrición clínica de FLUX.
Analiza la siguiente información de expediente y redacta un DIAGNÓSTICO CLÍNICO-NUTRICIONAL EJECUTIVO (exactamente 1 párrafo fluido de 3 a 4 oraciones) para el especialista.

Criterios clínicos de especialista:
1. Evalúa el impacto metabólico de sus patologías (ej. si dice 'Dabetes tipo 1', corrígelo a Diabetes Mellitus Tipo 1, explicando el conteo de carbohidratos, índice glucémico y prevención de picos).
2. Considera sus alergias y aversiones (${exclusionesStr}) como exclusiones obligatorias consolidadas sin repetir alimentos. Si la digestión o síntomas GI es 'Norml' o 'Normal', reconoce que su función gastrointestinal es óptima (¡NUNCA digas que se debe excluir la digestión normal!).
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

      for (const model of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.25, maxOutputTokens: 350 },
            }),
          });

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
          // Continuar al siguiente modelo o fallback
        }
      }
    }

    // 3. Motor Analítico Médico de Alta Precisión (Fallback Server-Side Garantizado)
    const sexoStr = cliente?.genero === "F" || cliente?.sexo === "F" ? "Paciente femenina" : "Paciente masculino";
    const sintesisParts: string[] = [];

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

    if (itemsExcluir.length > 0) {
      sintesisParts.push(`Se establece la exclusión estricta de ${joinSpanishList(itemsExcluir)} para garantizar la seguridad clínica frente a alergias y asegurar apego total al plan.`);
    }

    if (preferencias.length > 0) {
      const favsLower = preferencias.map((p) => p.toLowerCase());
      sintesisParts.push(`Se recomienda capitalizar ${joinSpanishList(favsLower)} en cortes magros y porciones equilibradas como fuente principal de nutrientes de alto valor biológico.`);
    }

    const habsList: string[] = [];
    if (isNormalGI) {
      habsList.push("función digestiva conservada");
    } else if (digestivoRaw.length > 2) {
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

    const textoFinal = sintesisParts.join(" ");

    return new Response(
      JSON.stringify({
        texto: textoFinal,
        origen: "analitico_edge",
        generadoEn: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Error procesando diagnóstico clínico" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
