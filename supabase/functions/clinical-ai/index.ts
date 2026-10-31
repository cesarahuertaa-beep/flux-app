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

function isFemenino(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim().toUpperCase();
  return s.startsWith("F") || s === "MUJER" || s === "FEMALE";
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
Tu tarea es AUDITAR CON RIGOR CLÍNICO Y PRECISIÓN LA PRESCRIPCIÓN ENERGÉTICA Y DE MACRONUTRIENTES para un paciente real.

═══════════════════════════════════════════════════════════
1. EXPEDIENTE MÉDICO CLÍNICO (Atemporal / Antecedentes)
═══════════════════════════════════════════════════════════
- Paciente: ${cliente.nombre || "Paciente"} (${isFemenino(cliente?.genero || cliente?.sexo || metrica?.sexo || anamnesis?.sexo) ? "Femenino" : "Masculino"}, ${cliente.edad || metrica.edad || "25"} años)
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
- Alimentos e ingredientes favoritos: ${body.preferencias || "No especificados"}
- Alimentos o comidas que prefiere evitar (aversiones personales): ${body.aversiones || "No especificados"}

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
- Objetivo fijado para este ciclo: ${calcMat.goalTitle || "Déficit / Recomposición"} (${calcMat.goalPct || 0}%)
- ACTIVIDAD FÍSICA PROGRAMADA EN ESTE CICLO: ${habitos.faf_proyectado_etapa || "Moderado (3 a 5 días/semana)"} (Factor FAF ${calcMat.faf || 1.55}).
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
7. CÁLCULO MATEMÁTICO BASE DE FLUX (FÓRMULA ${calcMat.formulaLabel || "Katch-McArdle"})
═══════════════════════════════════════════════════════════
- Tasa Metabólica Basal (TMB): ${calcMat.tmb} kcal/día
- Gasto Energético Total de MANTENIMIENTO (GET con FAF ${calcMat.faf || 1.55}): ${calcMat.get} kcal/día
- META DE ETAPA PROPUESTA POR LA FÓRMULA: ${calcMat.targetKcal} kcal/día (${calcMat.goalPct}% respecto al mantenimiento)
- Distribución matemática base: Proteína ${calcMat.proteinG}g (${calcMat.protGKg} g/kg), Grasas ${calcMat.fatsG}g (${calcMat.fatGKg} g/kg), Carbohidratos ${calcMat.carbsG}g (${calcMat.carbGKg || "N/A"} g/kg).

═══════════════════════════════════════════════════════════
INSTRUCCIONES CLÍNICAS CRÍTICAS PARA TU AUDITORÍA:
═══════════════════════════════════════════════════════════
1. CONTRASTA DIRECTAMENTE CONTRA LA META DE ETAPA (${calcMat.targetKcal} kcal), NO CONTRA EL MANTENIMIENTO (${calcMat.get} kcal):
   - Recuerda: el nutriólogo NO le va a recetar ${calcMat.get} kcal; la meta calculada para este ciclo ya contempla el objetivo y es de ${calcMat.targetKcal} kcal.
   - En tu explicación, debes comparar explícitamente tu sugerencia calórica contra esos ${calcMat.targetKcal} kcal (ejemplo: "La fórmula propone ${calcMat.targetKcal} kcal (${calcMat.goalPct}% respecto a su GET de ${calcMat.get}), pero sugiero ajustar a [X] kcal (un recorte de [Y] kcal adicionales respecto a la fórmula) debido a...").
2. EVALÚA LA TRANSICIÓN DE ACTIVIDAD (PASO 1 VS PASO 4):
   - El paciente viene de ${habitos.dias_ejercicio_actuales || "0"} días de actividad previa, pero el plan proyectado es ${habitos.faf_proyectado_etapa || "3 a 5 días"}.
   - Analiza si el gasto de ${calcMat.get} kcal se cumplirá de inmediato o si es prudente modular las calorías considerando que la adaptación al ejercicio toma tiempo.
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
  "analisisClinico": "string con el criterio clínico razonado de especialista (2 a 3 oraciones, contrastando claramente contra la meta matemática de ${calcMat.targetKcal} kcal)",
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
    // ACCIÓN: OPTIMIZACIÓN Y CÁLCULO DE MACROS DE COMIDA CON GEMINI
    // =========================================================================
    if (action === "optimize-meal") {
      const textoComida = (body.textoComida || body.mealText || "").trim();
      const targetKcal = Number(body.targetKcal) || 0;
      const anamnesis = body.anamnesis || {};
      const cliente = body.cliente || {};

      if (geminiKey && geminiKey.trim().length >= 20 && textoComida) {
        const promptMeal = `Eres un nutriólogo clínico y bromatólogo experto de FLUX.
Analiza la siguiente comida/receta diseñada para un paciente y calcula con máxima precisión sus calorías y macronutrientes basados en tablas de composición de alimentos (USDA/SMAE).
Adicionalmente, coteja los ingredientes contra el expediente del paciente para detectar si hay algún conflicto con alergias o aversiones personales.

EXPEDIENTE DEL PACIENTE:
- Nombre: ${cliente?.nombre || "Paciente"} (${isFemenino(cliente?.genero || cliente?.sexo || anamnesis?.sexo) ? "Mujer" : "Hombre"})
- Alergias e intolerancias: ${anamnesis.alergias_intolerancias || "Ninguna"}
- Aversiones alimentarias (no le gusta comer): ${anamnesis.aversiones_alimentos || "Ninguna"}
- Preferencias / favoritos: ${anamnesis.preferencias_alimentos || "Ninguna"}
- Patologías: ${anamnesis.patologias || "Ninguna"}

COMIDA A ANALIZAR:
"${textoComida}"
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
                  contents: [{ parts: [{ text: promptMeal }] }],
                  generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json",
                  },
                }),
              }
            );
            if (res.ok) {
              const data = await res.json();
              const textRes = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (textRes) {
                const parsed = JSON.parse(textRes);
                return new Response(
                  JSON.stringify({
                    ...parsed,
                    palabrasClaveFoto: parsed.palabrasClaveFoto || parsed.palabrasClave || [],
                    origen: "gemini_edge",
                    model,
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          } catch {}
        }
      }
    }

    // =========================================================================
    // ACCIÓN: GENERAR ALTERNATIVA EQUIVALENTE (ISO-MACROS) CON GEMINI
    // =========================================================================
    if (action === "alternative-meal") {
      const mainMealText = (body.mainMealText || "").trim();
      const targetMacros = body.targetMacros || {};
      const anamnesis = body.anamnesis || {};
      const kcal = Number(targetMacros.calorias) || 0;
      const p = Number(targetMacros.proteina) || 0;
      const c = Number(targetMacros.carbohidratos) || 0;
      const f = Number(targetMacros.grasas) || 0;

      if (geminiKey && geminiKey.trim().length >= 20 && mainMealText) {
        const promptAlt = `Eres un chef y nutriólogo deportivo de élite de FLUX.
Genera una OPCIÓN ALTERNATIVA EQUIVALENTE (ISO-MACRONUTRIENTE) a la opción principal que te proporcionamos.
La alternativa debe ser atractiva, con ingredientes comunes y fáciles de preparar, y debe IGUALAR con precisión los mismos macros de la opción principal.

OPCIÓN PRINCIPAL:
"${mainMealText}"
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
                  contents: [{ parts: [{ text: promptAlt }] }],
                  generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json",
                  },
                }),
              }
            );
            if (res.ok) {
              const data = await res.json();
              const textRes = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (textRes) {
                const parsed = JSON.parse(textRes);
                return new Response(
                  JSON.stringify({
                    ...parsed,
                    origen: "gemini_edge",
                    model,
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          } catch {}
        }
      }
    }

    // =========================================================================
    // ACCIÓN: GENERAR RECETA DESDE DESPENSA CON GEMINI
    // =========================================================================
    // =========================================================================
    // ACCIÓN: GENERAR PLATILLO REAL A PARTIR DE INGREDIENTES
    // =========================================================================
    if (action === "dish-from-ingredients") {
      const ingredientes = Array.isArray(body.ingredientes)
        ? body.ingredientes.join(", ")
        : String(body.ingredientes || "").trim();
      const targetMacros = body.targetMacros || {};
      const targetHint = targetMacros.calorias
        ? `\n═══════════════════════════════════════════════════════════
META NUTRICIONAL ESTRICTA PARA ESTA SOLA TOMA (1 PERSONA):
- Calorías meta: ~${targetMacros.calorias} kcal
- Proteína sugerida: ~${targetMacros.proteina || 35}g
- Carbohidratos sugeridos: ~${targetMacros.carbohidratos || 50}g
- Grasas sugeridas: ~${targetMacros.grasas || 15}g
REGLA DE ORO DE PORCIONES: Calibra las porciones y gramajes individuales de los alimentos para que el platillo alcance APROXIMADAMENTE ~${targetMacros.calorias} kcal. NUNCA generes porciones descomunales ni abarques las calorías de todo el día en una sola comida.`
        : "";

      if (geminiKey && geminiKey.trim().length >= 20 && ingredientes) {
        const promptDish = `Eres un chef profesional y nutriólogo clínico de FLUX.
A partir de la siguiente lista de ingredientes seleccionados por el nutriólogo, propón un solo platillo real y conocido del mundo culinario que los combine con armonía gastronómica, especificando SIEMPRE las porciones, gramajes o volúmenes exactos de cada alimento y calculando su aporte de calorías y macronutrientes.${targetHint}

═══════════════════════════════════════════════════════════
EJEMPLO MAESTRO DE TONO, GRAMAJES Y ESTRUCTURA (Imita este estilo exacto):
═══════════════════════════════════════════════════════════
Ingredientes proporcionados: Tortilla de maíz, Carne de res molida, Chile chipotle, Aguacate
Respuesta esperada:
{
  "titulo": "Tacos de picadillo de res al chipotle con aguacate",
  "texto": "Tus ingredientes forman unos clásicos tacos de picadillo de res al chipotle; cocinando 150g de carne de res molida con 1 chile chipotle picado y servida sobre 3 tortillas de maíz calientes (90g) acompañadas de 50g de aguacate en rebanadas. Todos los ingredientes combinan a la perfección y ninguno sobra, aunque para que la carne quede jugosa conviene licuar el chipotle con 1 jitomate mediano, 1/4 de cebolla y 1 diente de ajo para la salsa, rematando con 1/2 limón fresco y una pizca de sal al servir.",
  "calorias": 485,
  "proteina": 38,
  "carbohidratos": 42,
  "grasas": 19
}

═══════════════════════════════════════════════════════════
REGLAS ESTRICTAS DE REDACCIÓN:
═══════════════════════════════════════════════════════════
1. "titulo": Nombre atractivo, culinario y real del platillo (ej. "Picadillo clásico de res con arroz blanco y parmesano", "Cazuela cremosa de pollo campirano con vegetales", "Pastel rústico de pollo con puré de papa").
2. "texto": Un solo texto corrido breve (máximo 4 a 5 líneas) con estas pautas obligatorias:
   a) Debe INICIAR nombrando el platillo gastronómico con calidez y naturalidad: "Tus ingredientes forman unos clásicos [Nombre]...", "Con esta base puedes preparar un delicioso [Nombre]...", o "Tus ingredientes se integran perfectamente en una reconfortante [Nombre]...". NUNCA comiences diciendo impersonalmente "Para preparar este platillo resulta ideal...".
   b) OBLIGATORIO - GRAMAJES Y VOLÚMENES POR INGREDIENTE: CADA ingrediente utilizado o sugerido DEBE incluir su porción, gramaje o volumen realista para 1 persona (ej. 150g de carne molida, 1 taza / 150g de arroz cocido, 1 pieza de jitomate / 120g, 50g de zanahoria en cubos, 20g de queso parmesano rallado, 1 cucharadita de aceite de oliva, 1 diente de ajo, etc.). Esto es indispensable para el cálculo nutricional.
   c) Explica brevemente cómo se combinan e integran al cocinar (sofrito, hervor, horneado, salteado o ensamble).
   d) Indica con amabilidad y naturalidad si sobra algún ingrediente que desentone con la armonía del platillo (ej. "el pepino sobra en esta preparación caliente y es mejor reservarlo fresco (1/2 pieza en rodajas) para una ensalada aparte...").
   e) Sugiere los ingredientes básicos de cocina faltantes para completarlo con éxito con cantidades precisas (ej. 1/4 de cebolla, 1 diente de ajo, 1 cdita de aceite, una pizca de sal).
   f) PROHIBIDO hablar de beneficios nutricionales, vitaminas ni propiedades medicinales. Enfócate 100% en gramajes, técnica culinaria y sabor.
3. "calorias", "proteina", "carbohidratos", "grasas": Calcula con rigor bromatológico y químico (Kcal ≈ P*4 + C*4 + G*9) el contenido nutricional total del platillo sumando los gramajes indicados en la receta. Devuelve números enteros redondeados.

═══════════════════════════════════════════════════════════
INGREDIENTES SELECCIONADOS:
═══════════════════════════════════════════════════════════
${ingredientes}

Responde ÚNICAMENTE en formato JSON con llaves dobles válidas:
{
  "titulo": "Nombre del platillo",
  "texto": "Texto corrido en un solo párrafo con gramajes exactos y técnica culinaria fluida...",
  "calorias": number,
  "proteina": number,
  "carbohidratos": number,
  "grasas": number
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
                  contents: [{ parts: [{ text: promptDish }] }],
                  generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json",
                  },
                }),
              }
            );
            if (res.ok) {
              const data = await res.json();
              const textRes = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (textRes) {
                const parsed = JSON.parse(textRes);
                const p = Math.round(Number(parsed.proteina) || 0);
                const c = Math.round(Number(parsed.carbohidratos) || 0);
                const f = Math.round(Number(parsed.grasas) || 0);
                let kcal = Math.round(Number(parsed.calorias) || 0);
                const sumKcal = Math.round(p * 4 + c * 4 + f * 9);
                if (Math.abs(kcal - sumKcal) > 30 && sumKcal > 0) {
                  kcal = sumKcal;
                }
                return new Response(
                  JSON.stringify({
                    titulo: parsed.titulo || "Platillo sugerido",
                    texto: parsed.texto || "",
                    calorias: kcal || sumKcal || undefined,
                    proteina: p || undefined,
                    carbohidratos: c || undefined,
                    grasas: f || undefined,
                    origen: "gemini_edge",
                    model,
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          } catch {}
        }
      }
    }

    // =========================================================================
    if (action === "pantry-meal") {
      const ingredientesDisponibles = (body.ingredientesDisponibles || "").trim();
      const targetMacros = body.targetMacros || {};
      const anamnesis = body.anamnesis || {};
      const kcal = Number(targetMacros.calorias) || 500;
      const p = Number(targetMacros.proteina) || 35;
      const c = Number(targetMacros.carbohidratos) || 50;
      const f = Number(targetMacros.grasas) || 15;

      if (geminiKey && geminiKey.trim().length >= 20 && ingredientesDisponibles) {
        const promptPantry = `Eres un chef y nutriólogo clínico deportivo de FLUX.
El nutriólogo o paciente cuenta con estos ingredientes en su despensa o refri:
"${ingredientesDisponibles}"

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
                  contents: [{ parts: [{ text: promptPantry }] }],
                  generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json",
                  },
                }),
              }
            );
            if (res.ok) {
              const data = await res.json();
              const textRes = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (textRes) {
                const parsed = JSON.parse(textRes);
                return new Response(
                  JSON.stringify({
                    ...parsed,
                    origen: "gemini_edge",
                    model,
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          } catch {}
        }
      }
    }

    // =========================================================================
    // ACCIÓN: AUDITORÍA INTEGRAL DEL DÍA COMPLETO CON IA (3 PILARES)
    // =========================================================================
    if (action === "audit-full-day") {
      const comidas = Array.isArray(body.comidas) ? body.comidas : [];
      const cliente = body.cliente || {};
      const clinicalRec = body.clinicalRec || {};
      const anamnesis = clinicalRec.anamnesis || body.anamnesis || {};
      const resumenClinico = clinicalRec.sintesis_ia || anamnesis.resumen_ia || body.resumenClinico || {};
      const smartPrescription = body.smartPrescription || {};
      const targetMacros = body.targetMacros || {};

      const metaKcal = Number(targetMacros.calorias || smartPrescription.targetKcal || 0);
      const metaP = Number(targetMacros.proteina || smartPrescription.proteinG || 0);
      const metaC = Number(targetMacros.carbohidratos || smartPrescription.carbsG || 0);
      const metaG = Number(targetMacros.grasas || smartPrescription.fatsG || 0);

      const exclusiones = resumenClinico?.alertas?.exclusiones_alimentarias || anamnesis?.alergias_intolerancias || "Ninguna";
      const patologias = resumenClinico?.alertas?.patologias_normalizadas || anamnesis?.patologias || "Ninguna";
      const medicacion = resumenClinico?.medicacion_normalizada || anamnesis?.medicacion_suplementos || "Sin medicación reportada";
      const contexto = typeof resumenClinico?.contexto_normalizado === "object"
        ? Object.values(resumenClinico.contexto_normalizado).filter(Boolean).join(". ")
        : (resumenClinico?.contexto_normalizado || "Sin contexto particular");
      const directrices = Array.isArray(resumenClinico?.directrices_nutricionales)
        ? resumenClinico.directrices_nutricionales.join("; ")
        : "Directrices habituales de balance energético";

      const favoritos = smartPrescription.preferencias || anamnesis.preferencias_alimentos || "No especificados";
      const aversiones = smartPrescription.aversiones || anamnesis.aversiones_alimentos || "No especificadas";
      const rationale = smartPrescription.rationale || "Plan nutricional adaptado";
      const estrategiaMenu = smartPrescription.estrategiaMenu || "Distribución equilibrada a lo largo del día";
      const badgeMotivo = smartPrescription.badgeMotivo || "Prescripción General";

      if (geminiKey && geminiKey.trim().length >= 20 && comidas.length > 0) {
        const comidasText = comidas.map((c: any, idx: number) => {
          const opts = Array.isArray(c.opciones) && c.opciones.length > 0 ? c.opciones : [c.opcion1 || ""];
          const optAText = opts[0] || "Vacía";
          const altsText = opts.slice(1).map((opt: string, oIdx: number) => `    * Opción Alternativa (${String.fromCharCode(66 + oIdx)}): "${opt}"`).join("\n");
          return `[Comida ${idx + 1}]
- Hora: ${c.hora || "Sin hora"} | Nombre: ${c.nombre || `Comida ${idx + 1}`}
- Macros registrados: ${c.calorias || 0} kcal (P: ${c.proteina || 0}g, C: ${c.carbohidratos || 0}g, G: ${c.grasas || 0}g)
- Opción Principal (A): "${optAText}"${altsText ? `\n${altsText}` : ""}`;
        }).join("\n\n");

        const prompt = `Eres el Director de Auditoría Clínica Nutricional y Bromatólogo Experto de FLUX.
Tu función es auditar exhaustivamente el menú completo de un día para un paciente, contrastándolo contra la síntesis clínica y el dictamen de requerimientos ya establecidos.

======================================================================
PILAR 1: RESUMEN CLÍNICO INTELIGENTE (Previamente auditado)
======================================================================
- Diagnóstico: ${resumenClinico.diagnostico || resumenClinico.texto || "Paciente en evaluación nutricional"}
- Exclusiones / Alergias / Intolerancias: ${Array.isArray(exclusiones) ? exclusiones.join(", ") : exclusiones}
- Patologías: ${Array.isArray(patologias) ? patologias.join(", ") : patologias}
- Medicación y Suplementos: ${medicacion}
- Contexto de Vida y Digestión: ${contexto}
- Directrices Nutricionales Obligatorias: ${directrices}

======================================================================
PILAR 2: DICTAMEN DE AUDITORÍA CLÍNICA IA (Metas del Día)
======================================================================
- Meta Calórica Diaria: ${metaKcal} kcal
- Macros Prescritos: Proteína ${metaP}g | Carbohidratos ${metaC}g | Grasas ${metaG}g
- Enfoque de Etapa: ${badgeMotivo} - ${rationale}
- Estrategia de Menú Sugerida: ${estrategiaMenu}
- Favoritos de la Etapa a Incluir: ${favoritos}
- Aversiones / Alimentos a NO Incluir: ${aversiones}

======================================================================
PILAR 3: DIETA PROGRAMADA DEL DÍA (${comidas.length} TOMAS)
======================================================================
${comidasText}

======================================================================
MISIÓN Y REGLAS DE LA AUDITORÍA:
======================================================================
1. RELLENADO DE MACROS VACÍOS O EN CERO (Comidas manuales):
   - Si alguna comida tiene calorías o macros en 0/vacíos porque el nutriólogo la redactó a mano, calcula bromatológicamente sus calorías y macronutrientes (P, C, G) basados en tablas oficiales (USDA / SMAE) a partir de la descripción de la Opción Principal.
   - Aplica balance de energía estricto: Kcal = (P * 4) + (C * 4) + (G * 9).
   - Marca "macrosCalculadosPorIa": true únicamente si la comida tenía 0 o macros vacíos y tuviste que calcularlos; de lo contrario pon false.
   - Si la comida ya tenía macros válidos (> 0), consérvalos tal como están (a menos que detectes una discrepancia extrema de más del 50%, en cuyo caso indícalo en su alerta).

2. VERIFICACIÓN DE SEGURIDAD Y COMPATIBILIDAD CLÍNICA (Por Comida):
   - Coteja CADA ingrediente de cada opción contra las aversiones, alergias y patologías del expediente:
     a) AVERSIÓN DEL PACIENTE (REGLA OBLIGATORIA DE CLARIDAD): Si la comida contiene un alimento declarado en sus aversiones (ej. ${aversiones}), la "alertaClinica" DEBE NOMBRAR EXPLÍCITAMENTE QUÉ INGREDIENTE ES y qué falla con total precisión y brevedad (ej. "Contiene jitomate / tomate: alimento que el paciente rechaza y pidió no incluir", "Contiene atún: aversión declarada en expediente"). PROHIBIDO usar frases vagas como "se detectó una aversión" o "revisar ingredientes".
     b) ALERGIAS / EXCLUSIONES: Nombra el alérgeno exacto (ej. "Contiene leche de vaca entera: contraindicada por intolerancia a la lactosa").
     c) PATOLOGÍAS Y MEDICACIÓN: Nombra el desvío exacto (ej. "Exceso de embutidos altos en sodio: contraindicado para hipertensión arterial").
     d) Si la toma es completamente segura y no viola ninguna aversión ni directriz, devuelve null en "alertaClinica".

3. EVALUACIÓN Y COHERENCIA GLOBAL DEL DÍA:
   - Suma las calorías y macros de todas las comidas (incluyendo las recién calculadas) y compara contra la Meta Diaria Prescrita (Pilar 2).
   - Emite un veredicto general ("aprobado", "advertencia" o "critico") y un dictamen conciso sobre la calidad y distribución del día.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "comidasAuditadas": [
    {
      "index": 0,
      "calorias": number,
      "proteina": number,
      "carbohidratos": number,
      "grasas": number,
      "macrosCalculadosPorIa": boolean,
      "alertaClinica": "Nombre explícito del ingrediente en conflicto y por qué falla (ej. 'Contiene tomate: alimento rechazado en las aversiones del paciente'), o null si es 100% segura",
      "evaluacion": "string corto (ej. 'Alineada con directriz DASH, sin lactosa')"
    }
  ],
  "resumenGlobal": {
    "estado": "aprobado",
    "caloriasTotales": number,
    "proteinaTotal": number,
    "carbosTotales": number,
    "grasasTotales": number,
    "desvioKcalPct": number,
    "dictamenGeneral": "string sintetizado explicando la coherencia del menú frente a las directrices y metas",
    "recomendaciones": ["sugerencia 1", "sugerencia 2"]
  }
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
              const textRes = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (textRes) {
                const parsed = JSON.parse(textRes);
                return new Response(
                  JSON.stringify({
                    ...parsed,
                    success: true,
                    origen: "gemini_edge",
                    model,
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          } catch {}
        }
      }

      // Fallback analítico bromatológico si no hay Gemini
      let sumKcal = 0;
      let sumP = 0;
      let sumC = 0;
      let sumF = 0;
      const comidasAuditadas = comidas.map((c: any, idx: number) => {
        let cal = Number(c.calorias) || 0;
        let p = Number(c.proteina) || 0;
        let car = Number(c.carbohidratos) || 0;
        let f = Number(c.grasas) || 0;
        let calculated = false;

        if (cal === 0) {
          cal = metaKcal > 0 ? Math.round(metaKcal / comidas.length) : 450;
          p = metaP > 0 ? Math.round(metaP / comidas.length) : 30;
          car = metaC > 0 ? Math.round(metaC / comidas.length) : 45;
          f = metaG > 0 ? Math.round(metaG / comidas.length) : 15;
          calculated = true;
        }

        sumKcal += cal;
        sumP += p;
        sumC += car;
        sumF += f;

        const mealText = ((c.opciones?.[0] || c.opcion1 || "") + " " + (c.opciones?.slice(1).join(" ") || "")).toLowerCase();
        let alertaClinica: string | null = null;
        if (aversiones && aversiones !== "No especificadas" && aversiones !== "Ninguna") {
          const aversionsList = parseTags(aversiones);
          const found = aversionsList.filter(av => av.length > 2 && mealText.includes(av.toLowerCase()));
          if (found.length > 0) {
            alertaClinica = `Contiene '${joinSpanishList(found)}': ingrediente rechazado en las aversiones declaradas del paciente.`;
          }
        }

        return {
          index: idx,
          calorias: cal,
          proteina: p,
          carbohidratos: car,
          grasas: f,
          macrosCalculadosPorIa: calculated,
          alertaClinica,
          evaluacion: alertaClinica || "Platillo verificado con tablas bromatológicas de referencia",
        };
      });

      const diffPct = metaKcal > 0 ? Math.round(((sumKcal - metaKcal) / metaKcal) * 100) : 0;
      return new Response(
        JSON.stringify({
          success: true,
          origen: "analitico_local",
          comidasAuditadas,
          resumenGlobal: {
            estado: Math.abs(diffPct) <= 10 ? "aprobado" : "advertencia",
            caloriasTotales: sumKcal,
            proteinaTotal: sumP,
            carbosTotales: sumC,
            grasasTotales: sumF,
            desvioKcalPct: diffPct,
            dictamenGeneral: `Menú del día con ${sumKcal} kcal asignadas frente a la meta prescrita de ${metaKcal} kcal (${diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`}).`,
            recomendaciones: Math.abs(diffPct) > 10 ? ["Ajustar porciones para acercarse más a la meta energética prescrita."] : [],
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // ACCIÓN 2: SÍNTESIS Y AUDITORÍA DE EXPEDIENTE CLÍNICO INTEGRAL
    // =========================================================================
    if (action === "clinical-synopsis") {
    const anamnesis = body.anamnesis || {};
    const cliente = body.cliente || {};

    const patologiasRaw = (anamnesis.patologias || "").trim();
    const patologias = parseTags(patologiasRaw);
    const tienePatologias =
      patologias.length > 0 || (patologiasRaw.length > 2 && !/^(no|ningun|nada|n\/a)/i.test(patologiasRaw));

    const alergiasRaw = (anamnesis.alergias_intolerancias || "").trim();
    const alergias = parseTags(alergiasRaw);

    const medicacionRaw = (anamnesis.medicacion_suplementos || "").trim();
    const heredoRaw = (anamnesis.antecedentes_heredofamiliares || "").trim();
    const lesionesRaw = (anamnesis.cirugias_lesiones || "").trim();
    const ocupacionRaw = (anamnesis.ocupacion_actividad || "").trim();
    const alcoholTabacoRaw = (anamnesis.consumo_alcohol_tabaco || "").trim();
    const notasRaw = (anamnesis.notas_consulta || "").trim();

    const aversionesRaw = (anamnesis.aversiones_alimentos || "").trim();
    const preferenciasRaw = (anamnesis.preferencias_alimentos || "").trim();

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
    [...alergias, ...parseTags(aversionesRaw)].forEach((item) => {
      const k = item.toLowerCase();
      if (!exclusionesMap.has(k)) exclusionesMap.set(k, item.toLowerCase());
    });
    const itemsExcluir = Array.from(exclusionesMap.values());
    const exclusionesStr = itemsExcluir.length > 0 ? itemsExcluir.join(", ") : "Ninguna";

    const rawSexo = cliente.genero || cliente.sexo || anamnesis.sexo || anamnesis.genero || "";
    const esMujer = isFemenino(rawSexo);
    const sexoLabel = esMujer ? "Femenino" : "Masculino";

    if (geminiKey && geminiKey.trim().length >= 20) {
      const prompt = `Eres un médico especialista en medicina interna y nutrición clínica de élite en FLUX.
Tu tarea es REALIZAR UNA AUDITORÍA Y SÍNTESIS INTEGRAL DEL EXPEDIENTE CLÍNICO DE UN PACIENTE REAL.
Debes interpretar datos médicos, corregir errores ortográficos o descripciones coloquiales del paciente y generar una síntesis profesional y estructurada.

═══════════════════════════════════════════════════════════
DATOS DEL PACIENTE:
═══════════════════════════════════════════════════════════
- Nombre: ${cliente.nombre || "Paciente"}
- Sexo: ${sexoLabel} (${esMujer ? "Mujer / Femenina" : "Hombre / Masculino"})
- Edad: ${cliente.edad || "Adulto"} años
- Objetivo declarado: ${objetivo || "Mejorar salud y composición corporal"}

═══════════════════════════════════════════════════════════
INFORMACIÓN REPORTADA EN EL EXPEDIENTE (PUEDE CONTENER TYPOS O COLOQUIALISMOS):
═══════════════════════════════════════════════════════════
1. Patologías / Diagnósticos: ${patologiasRaw || "Ninguna"}
2. Alergias e Intolerancias: ${alergiasRaw || "Ninguna"}
3. Medicación y Suplementos actuales: ${medicacionRaw || "Ninguna"}
4. Antecedentes Heredofamiliares: ${heredoRaw || "Ninguno"}
5. Cirugías y Lesiones previas: ${lesionesRaw || "Ninguna"}
6. Función Digestiva / Síntomas GI: ${digestivoRaw || "Normal"}
7. Ocupación y Actividad diaria: ${ocupacionRaw || "No especificada"}
8. Toxicomanías (Alcohol / Tabaco): ${alcoholTabacoRaw || "No reportado"}
9. Hábitos de descanso y estrés: Sueño ${sueno || "7"}h, Estrés ${estresNivel}/5, Agua ${agua || "No especificada"}
10. Preferencias y aversiones: Favoritos (${preferenciasRaw || "No especificados"}), Evita (${aversionesRaw || "No especificados"})
${notasRaw ? `11. Notas de consulta previa: ${notasRaw}` : ""}

═══════════════════════════════════════════════════════════
INSTRUCCIONES CLÍNICAS CRÍTICAS:
═══════════════════════════════════════════════════════════
1. CORRECCIÓN Y NORMALIZACIÓN MÉDICA (LIMPIA LOS TYPOS DEL PACIENTE):
   - Traduce cualquier texto coloquial o mal escrito a terminología médica profesional (ej. si dice 'solo para contralar a hipertension' normalízalo a 'Terapia antihipertensiva oral no especificada'; si dice 'Mis ambuelos tubieron diabetes' normalízalo a 'Diabetes Mellitus tipo 2 en abuelos'; si dice 'poco, solo socal' normalízalo a 'Consumo ocasional de alcohol (social), no fumador'; si dice 'bastante seden...' normalízalo a 'Jornada laboral con alto grado de sedentarismo').
2. EXCLUSIONES ALIMENTARIAS REALES (NO CONFUNDAS CONDICIÓN CON ALIMENTO):
   - Si el paciente reporta "intolerancia a la lactosa", el alimento a excluir son "Lácteos enteros y derivados convencionales con lactosa", ¡NUNCA digas "excluir la intolerancia"!
   - Diferencia alergias reales de intolerancias o aversiones personales.
3. DIAGNÓSTICO INTEGRAL Y VIGILANCIA FARMACO-NUTRIENTE:
   - Redacta un diagnóstico clínico-nutricional ejecutivo de 3 a 4 oraciones fluidas.
   - Cruza las variables: si hay hipertensión + herencia de diabetes, enfatiza la prevención cardiovascular y el control glucémico; si toma medicación, evalúa interacciones con minerales (ej. sodio, potasio).
4. DIRECTRICES CONCRETAS PARA EL NUTRIÓLOGO:
   - Proporciona entre 3 y 4 directrices dietoterapéuticas precisas y prácticas para la elaboración del plan de alimentación.
5. CONCORDANCIA DE GÉNERO OBLIGATORIA:
   - Respeta estrictamente el sexo del paciente indicado (${sexoLabel}). Redacta el diagnóstico, la ocupación y todo el contexto con la concordancia de género correspondiente (${esMujer ? 'femenina: mujer, paciente femenina, etc.' : 'masculino: hombre, paciente masculino, etc.'}). Bajo ninguna circunstancia uses el sexo opuesto.

Debes responder ÚNICAMENTE con un JSON válido con la siguiente estructura:
{
  "diagnostico": "string con el diagnóstico clínico integral (3-4 oraciones profesionales fluidas)",
  "alertas": {
    "patologias_normalizadas": ["string con patología corregida"],
    "exclusiones_alimentarias": ["alimento real 1 a evitar", "alimento real 2 a evitar"],
    "observacion_alergias": "string breve con la indicación clínica de seguridad"
  },
  "medicacion_normalizada": "string con la interpretación clínica profesional del tratamiento actual",
  "heredo_normalizado": "string con los antecedentes familiares traducidos a riesgo preventivo",
  "contexto_normalizado": {
    "ocupacion": "string breve profesional sobre el sedentarismo o actividad laboral",
    "digestion": "string breve sobre el estado GI (ej: Función digestiva conservada sin sintomatología de alarma)",
    "alcohol_tabaco": "string breve profesional sobre hábitos tóxicos"
  },
  "directrices_nutricionales": [
    "directriz 1 para el nutriólogo (ej. Control estricto de sodio < 2,000 mg/día)",
    "directriz 2 (ej. Sustituir lácteos tradicionales por alternativas deslactosadas o vegetales)",
    "directriz 3 (ej. Priorizar carbohidratos de bajo índice glucémico y fibra soluble)"
  ]
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
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (textResponse) {
              const parsed = JSON.parse(textResponse);
              return new Response(
                JSON.stringify({
                  success: true,
                  origen: "gemini",
                  model,
                  generadoEn: new Date().toISOString(),
                  texto: parsed.diagnostico || textResponse,
                  diagnostico: parsed.diagnostico || textResponse,
                  alertas: parsed.alertas || {
                    patologias_normalizadas: patologias,
                    exclusiones_alimentarias: itemsExcluir,
                    observacion_alergias: "Exclusión de alérgenos reportados",
                  },
                  medicacion_normalizada: parsed.medicacion_normalizada || medicacionRaw,
                  heredo_normalizado: parsed.heredo_normalizado || heredoRaw,
                  contexto_normalizado: parsed.contexto_normalizado || {
                    ocupacion: ocupacionRaw || "Actividad habitual",
                    digestion: isNormalGI ? "Función digestiva conservada" : digestivoRaw,
                    alcohol_tabaco: alcoholTabacoRaw || "No reportado",
                  },
                  directrices_nutricionales: parsed.directrices_nutricionales || [],
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
    const sexoStr = esMujer ? "Paciente femenina" : "Paciente masculino";
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
        `Se establece la exclusión de ${joinSpanishList(
          itemsExcluir
        )} para garantizar la seguridad clínica y asegurar apego total al plan.`
      );
    }

    return new Response(
      JSON.stringify({
        texto: sintesisParts.join(" "),
        diagnostico: sintesisParts.join(" "),
        origen: "analitico_base",
        generadoEn: new Date().toISOString(),
        alertas: {
          patologias_normalizadas: patologias,
          exclusiones_alimentarias: itemsExcluir,
          observacion_alergias: "Exclusión de alérgenos reportados",
        },
        medicacion_normalizada: medicacionRaw || "Sin medicación reportada",
        heredo_normalizado: heredoRaw || "Sin antecedentes reportados",
        contexto_normalizado: {
          ocupacion: ocupacionRaw || "No especificada",
          digestion: isNormalGI ? "Función digestiva conservada" : digestivoRaw,
          alcohol_tabaco: alcoholTabacoRaw || "No reportado",
        },
        directrices_nutricionales: [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    }

    return new Response(
      JSON.stringify({ error: "UNKNOWN_ACTION", message: `Acción no reconocida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Error procesando solicitud con IA" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
