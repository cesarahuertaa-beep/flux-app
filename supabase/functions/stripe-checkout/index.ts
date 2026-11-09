// Supabase Edge Function: stripe-checkout (Opción B — Dinámico por API)
// Genera al vuelo sesiones de Stripe Checkout (Suscripción Mensual Domiciliada o Upgrade de Nivel)
// y sesiones del Portal de Clientes de Stripe leyendo las tarifas vigentes desde `configuracion_plataforma`.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toFormUrlEncoded(params: Record<string, string | number | boolean | undefined | null>): string {
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      searchParams.append(k, String(v));
    }
  }
  return searchParams.toString();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({
          error: "Falta configurar STRIPE_SECRET_KEY en Supabase Secrets.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const action = body?.action || "checkout";
    const userType = body?.userType || "nutriologo"; // "nutriologo" | "civil"
    const userId = body?.userId || "";
    const email = (body?.email || "").trim().toLowerCase();
    const returnUrl = body?.returnUrl || "https://fluxsport.app";

    // 1. Acción: Abrir Portal de Clientes de Stripe (para administrar o cancelar tarjeta domiciliada)
    if (action === "portal") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "No se encontró un correo asociado para buscar tu suscripción." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const custRes = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
        {
          headers: { Authorization: `Bearer ${stripeSecretKey}` },
        }
      );
      const custJson = await custRes.json();
      const customerId = custJson?.data?.[0]?.id;

      if (!customerId) {
        return new Response(
          JSON.stringify({
            error: "Aún no tienes una tarjeta domiciliada registrada con este correo.",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: toFormUrlEncoded({
          customer: customerId,
          return_url: returnUrl,
        }),
      });
      const portalJson = await portalRes.json();

      if (!portalRes.ok || !portalJson?.url) {
        return new Response(
          JSON.stringify({
            error: portalJson?.error?.message || "No se pudo abrir el portal de suscripción.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ url: portalJson.url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Acción: Crear sesión de Checkout Dinámica (Suscripción Mensual o Upgrade de Nivel)
    const { data: cfgRow } = await supabase
      .from("configuracion_plataforma")
      .select("tarifas_config, valor")
      .eq("id", 1)
      .maybeSingle();

    let rates: any = {
      tier1: 499,
      tier2: 699,
      tier3: 949,
      tier1_max: 20,
      tier2_max: 40,
      tier3_max: 60,
      extra_client: 50,
      estudiante_flat: 239,
      estudiante_max: 15,
      civil_premium: 75,
    };

    if (cfgRow?.tarifas_config) {
      const parsed =
        typeof cfgRow.tarifas_config === "string"
          ? JSON.parse(cfgRow.tarifas_config)
          : cfgRow.tarifas_config;
      const base = parsed?.current || parsed || {};
      rates = { ...rates, ...base };
    }

    let planTitle = "Membresía Mensual FLUX";
    let amountMxn = 499;
    let isOneTimeUpgrade = false;
    let customerEmail = email;

    if (userType === "civil") {
      amountMxn = Number(rates.civil_premium ?? 75);
      planTitle = "FLUX Pro — Atleta Independiente (Mensual)";
      if (userId && !customerEmail) {
        const { data: cl } = await supabase
          .from("clientes")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        if (cl?.email) customerEmail = cl.email;
      }
    } else {
      // Nutriólogo o Nutriólogo Estudiante
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role, email")
        .eq("id", userId)
        .maybeSingle();

      if (prof?.email && !customerEmail) customerEmail = prof.email;
      const isStudent = prof?.role === "nutriologo_estudiante";

      const { count: clientCountRaw } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("nutriologo_id", userId);
      const clientCount = Math.max(1, clientCountRaw || 1);

      const t1Max = Number(rates.tier1_max ?? 20);
      const t2Max = Number(rates.tier2_max ?? 40);
      const t3Max = Number(rates.tier3_max ?? 60);
      const estMax = Number(rates.estudiante_max ?? 15);

      if (isStudent && clientCount <= estMax) {
        amountMxn = Number(rates.estudiante_flat ?? 239);
        planTitle = `FLUX Plan Estudiante (1 a ${estMax} pacientes)`;
      } else if (clientCount <= t1Max) {
        amountMxn = Number(rates.tier1 ?? 499);
        planTitle = `FLUX Nivel 1 — Inicial (1 a ${t1Max} pacientes)`;
      } else if (clientCount <= t2Max) {
        amountMxn = Number(rates.tier2 ?? 699);
        planTitle = `FLUX Nivel 2 — Crecimiento (${t1Max + 1} a ${t2Max} pacientes)`;
      } else if (clientCount <= t3Max) {
        amountMxn = Number(rates.tier3 ?? 949);
        planTitle = `FLUX Nivel 3 — Consolidado (${t2Max + 1} a ${t3Max} pacientes)`;
      } else {
        const extras = clientCount - t3Max;
        amountMxn = Number(rates.tier3 ?? 949) + extras * Number(rates.extra_client ?? 50);
        planTitle = `FLUX Nivel Corporativo (${clientCount} pacientes activos)`;
      }

      // Verificar si tiene un ciclo vigente y solo requiere Upgrade de Nivel a mitad de mes
      const { data: lastRec } = await supabase
        .from("recibos_pago")
        .select("monto_pagado, fecha_corte_mes, estado")
        .eq("nutriologo_id", userId)
        .eq("estado", "aprobado")
        .order("fecha_corte_mes", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRec?.fecha_corte_mes) {
        const expDate = new Date(`${lastRec.fecha_corte_mes}T23:59:59`);
        if (new Date() <= expDate && Number(lastRec.monto_pagado) < amountMxn && body?.isUpgrade) {
          amountMxn = Math.max(10, amountMxn - Number(lastRec.monto_pagado));
          planTitle = `Upgrade de Nivel FLUX (Diferencia del ciclo actual)`;
          isOneTimeUpgrade = true;
        }
      }
    }

    const unitAmountCents = Math.round(amountMxn * 100);
    const params: Record<string, string | number | boolean | undefined | null> = {
      mode: isOneTimeUpgrade ? "payment" : "subscription",
      success_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}pago=exitoso`,
      cancel_url: returnUrl,
      client_reference_id: userId,
      customer_email: customerEmail || undefined,
      "line_items[0][price_data][currency]": "mxn",
      "line_items[0][price_data][unit_amount]": unitAmountCents,
      "line_items[0][price_data][product_data][name]": planTitle,
      "line_items[0][quantity]": 1,
      "metadata[client_reference_id]": userId,
      "metadata[user_type]": userType,
      "metadata[is_upgrade]": isOneTimeUpgrade ? "true" : "false",
    };

    if (!isOneTimeUpgrade) {
      params["line_items[0][price_data][recurring][interval]"] = "month";
      params["subscription_data[metadata][client_reference_id]"] = userId;
      params["subscription_data[metadata][user_type]"] = userType;
    }

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toFormUrlEncoded(params),
    });

    const sessionJson = await sessionRes.json();
    if (!sessionRes.ok || !sessionJson?.url) {
      return new Response(
        JSON.stringify({
          error: sessionJson?.error?.message || "No se pudo generar la sesión de pago con Stripe.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ url: sessionJson.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Error interno al conectar con Stripe" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
