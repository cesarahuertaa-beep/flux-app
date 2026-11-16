// Supabase Edge Function: stripe-checkout (Modo Dinámico por API)
// Genera sesiones de Stripe Checkout (Mensual, Anual con 2 meses gratis, o Upgrade Prorrateado)
// y sesiones del Portal de Clientes leyendo las tarifas vigentes desde `configuracion_plataforma`.

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

function resolveCurrentRates(rawTarifasConfig: any) {
  const defaults = {
    nutri_tier1: 499,
    nutri_tier2: 699,
    nutri_tier3: 949,
    tier1_max: 20,
    tier2_max: 40,
    estudiante_max: 15,
    nutri_estudiante: 239,
    civil_premium: 75,
    anual_activo: true,
    meses_anual: 10,
  };

  let entry: any = {};
  if (rawTarifasConfig) {
    const parsed =
      typeof rawTarifasConfig === "string" ? JSON.parse(rawTarifasConfig) : rawTarifasConfig;

    if (Array.isArray(parsed) && parsed.length > 0) {
      const todayStr = new Date().toISOString().substring(0, 10);
      const applicable = parsed.filter((h: any) => (h?.effective_from || "2020-01-01") <= todayStr);
      entry = applicable.length > 0 ? applicable[applicable.length - 1] : parsed[0];
    } else if (parsed && typeof parsed === "object") {
      entry = parsed.current || parsed;
    }
  }

  const isLegacyPerPatient =
    !entry?.modelo_bloques &&
    Number(entry?.nutri_tier1 ?? entry?.tier1 ?? 0) <= 100 &&
    Number(entry?.nutri_tier2 ?? entry?.tier2 ?? 0) <= 100 &&
    Number(entry?.nutri_tier3 ?? entry?.tier3 ?? 0) <= 100 &&
    (entry?.nutri_tier1 !== undefined || entry?.tier1 !== undefined);

  const mesesAnual = Math.min(
    12,
    Math.max(1, Number(entry?.meses_anual ?? defaults.meses_anual) || defaults.meses_anual)
  );

  return {
    nutri_tier1: isLegacyPerPatient
      ? defaults.nutri_tier1
      : Number(entry?.nutri_tier1 ?? entry?.tier1 ?? defaults.nutri_tier1),
    nutri_tier2: isLegacyPerPatient
      ? defaults.nutri_tier2
      : Number(entry?.nutri_tier2 ?? entry?.tier2 ?? defaults.nutri_tier2),
    nutri_tier3: isLegacyPerPatient
      ? defaults.nutri_tier3
      : Number(entry?.nutri_tier3 ?? entry?.tier3 ?? defaults.nutri_tier3),
    tier1_max: Math.max(1, Number(entry?.tier1_max ?? defaults.tier1_max)),
    tier2_max: Math.max(2, Number(entry?.tier2_max ?? defaults.tier2_max)),
    estudiante_max: Math.max(1, Number(entry?.estudiante_max ?? defaults.estudiante_max)),
    nutri_estudiante: Number(
      entry?.nutri_estudiante ?? entry?.estudiante_flat ?? defaults.nutri_estudiante
    ),
    civil_premium: Number(entry?.civil_premium ?? defaults.civil_premium),
    anual_activo: entry?.anual_activo !== undefined ? Boolean(entry.anual_activo) : true,
    meses_anual: mesesAnual,
  };
}

function getTierMonthlyPrice(tier: number, rates: ReturnType<typeof resolveCurrentRates>) {
  if (tier === 0) return rates.nutri_estudiante;
  if (tier === 2) return rates.nutri_tier2;
  if (tier === 3) return rates.nutri_tier3;
  return rates.nutri_tier1;
}

function inferTierFromPaidAmount(
  paidBase: number,
  period: "mensual" | "anual",
  isStudent: boolean,
  rates: ReturnType<typeof resolveCurrentRates>
) {
  const mult = period === "anual" ? rates.meses_anual : 1;
  const t1 = rates.nutri_tier1 * mult;
  const t2 = rates.nutri_tier2 * mult;
  const t3 = rates.nutri_tier3 * mult;
  if (isStudent && paidBase < t1 * 0.9) return 0;
  if (paidBase < t2 * 0.9) return 1;
  if (paidBase < t3 * 0.9) return 2;
  return 3;
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
    const returnUrl = body?.returnUrl || "https://flux-sport.com";
    const requestedTier = body?.tier !== undefined && body?.tier !== null ? Number(body.tier) : null;
    const requestedPeriod = body?.billingPeriod === "annual" ? "annual" : "monthly";

    // 1. Acción: Abrir Portal de Clientes de Stripe
    if (action === "portal") {
      let customerId = "";
      if (userId) {
        const table = userType === "civil" ? "clientes" : "profiles";
        const { data: row } = await supabase
          .from(table)
          .select("stripe_customer_id, email")
          .eq("id", userId)
          .maybeSingle();
        if (row?.stripe_customer_id) customerId = row.stripe_customer_id;
      }

      if (!customerId && email) {
        const custRes = await fetch(
          `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
          { headers: { Authorization: `Bearer ${stripeSecretKey}` } }
        );
        const custJson = await custRes.json();
        customerId = custJson?.data?.[0]?.id || "";
      }

      if (!customerId) {
        return new Response(
          JSON.stringify({
            error: "Aún no tienes una tarjeta domiciliada registrada con tu cuenta.",
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

    // 2. Acción: Crear sesión de Checkout Dinámica (Mensual, Anual o Upgrade Prorrateado)
    const { data: cfgRow } = await supabase
      .from("configuracion_plataforma")
      .select("tarifas_config")
      .eq("id", 1)
      .maybeSingle();

    const rates = resolveCurrentRates(cfgRow?.tarifas_config);
    const isAnnual = requestedPeriod === "annual" && rates.anual_activo !== false;
    const effectivePeriod: "annual" | "monthly" = isAnnual ? "annual" : "monthly";

    let planTitle = isAnnual ? "Membresía Anual FLUX (12 meses)" : "Membresía Mensual FLUX";
    let amountMxn = rates.nutri_tier1;
    let targetTierAmountMxn = rates.nutri_tier1;
    let targetRecurringTitle = planTitle;
    let isOneTimeUpgrade = false;
    let resolvedTier = 1;
    let customerEmail = email;
    let stripeCustomerId = "";

    if (userType === "civil") {
      const monthlyCivil = rates.civil_premium;
      const annualCivil = Math.round(monthlyCivil * rates.meses_anual);
      amountMxn = isAnnual ? annualCivil : monthlyCivil;
      targetTierAmountMxn = amountMxn;
      planTitle = isAnnual
        ? "FLUX Pro — Atleta Independiente (Anual · 12 meses)"
        : "FLUX Pro — Atleta Independiente (Mensual)";
      targetRecurringTitle = planTitle;
      resolvedTier = 0;

      if (userId) {
        const { data: cl } = await supabase
          .from("clientes")
          .select("email, stripe_customer_id")
          .eq("id", userId)
          .maybeSingle();
        if (cl?.email && !customerEmail) customerEmail = cl.email;
        if (cl?.stripe_customer_id) stripeCustomerId = cl.stripe_customer_id;
      }
    } else {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role, email, stripe_customer_id")
        .eq("id", userId)
        .maybeSingle();

      if (prof?.email && !customerEmail) customerEmail = prof.email;
      if (prof?.stripe_customer_id) stripeCustomerId = prof.stripe_customer_id;
      const isStudent = prof?.role === "nutriologo_estudiante";

      const { data: clientRows } = await supabase
        .from("clientes")
        .select("id, activo, objetivo")
        .eq("nutriologo_id", userId);

      const clientCount = (clientRows || []).filter(
        (c: any) => c.activo !== false && c.objetivo !== "Mi entrenamiento personal"
      ).length;

      // Resolver nivel mínimo permitido por cartera de pacientes activos
      let minTier = 1;
      const canUseStudentPlan = isStudent && clientCount <= rates.estudiante_max;
      if (!canUseStudentPlan) {
        if (clientCount <= rates.tier1_max) minTier = 1;
        else if (clientCount <= rates.tier2_max) minTier = 2;
        else minTier = 3;
      }

      if (canUseStudentPlan && (requestedTier === null || requestedTier <= 1)) {
        resolvedTier = requestedTier === 1 && !canUseStudentPlan ? 1 : 0;
      } else {
        const desiredTier = requestedTier !== null && requestedTier >= 1 ? Math.min(3, requestedTier) : minTier;
        resolvedTier = Math.max(minTier, desiredTier);
      }

      const monthlyPrice = getTierMonthlyPrice(resolvedTier, rates);
      const cyclePrice = isAnnual ? Math.round(monthlyPrice * rates.meses_anual) : monthlyPrice;
      amountMxn = cyclePrice;
      targetTierAmountMxn = cyclePrice;

      if (resolvedTier === 0) {
        planTitle = isAnnual
          ? `FLUX Plan Estudiante Anual (1 a ${rates.estudiante_max} pac. · 12 meses)`
          : `FLUX Plan Estudiante (1 a ${rates.estudiante_max} pac. · Mensual)`;
      } else if (resolvedTier === 1) {
        planTitle = isAnnual
          ? `FLUX Nivel 1 Anual (1 a ${rates.tier1_max} pac. · 12 meses)`
          : `FLUX Nivel 1 (1 a ${rates.tier1_max} pac. · Mensual)`;
      } else if (resolvedTier === 2) {
        planTitle = isAnnual
          ? `FLUX Nivel 2 Anual (${rates.tier1_max + 1} a ${rates.tier2_max} pac. · 12 meses)`
          : `FLUX Nivel 2 (${rates.tier1_max + 1} a ${rates.tier2_max} pac. · Mensual)`;
      } else {
        planTitle = isAnnual
          ? `FLUX Nivel 3 Anual (${rates.tier2_max + 1}+ pac. Ilimitado · 12 meses)`
          : `FLUX Nivel 3 (${rates.tier2_max + 1}+ pac. Ilimitado · Mensual)`;
      }
      targetRecurringTitle = planTitle;

      // Verificar si solicita Upgrade en ciclo vigente (Anual prorrateado o Mensual diferencia)
      if (body?.isUpgrade) {
        const { data: approvedList } = await supabase
          .from("recibos_pago")
          .select("*")
          .eq("nutriologo_id", userId)
          .eq("estado", "aprobado")
          .order("fecha_corte_mes", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(10);

        const lastRec = approvedList?.[0] || null;
        if (lastRec?.fecha_corte_mes) {
          const cutStr = String(lastRec.fecha_corte_mes).split("T")[0];
          const expDate = new Date(`${cutStr}T23:59:59`);
          const now = new Date();
          if (!isNaN(expDate.getTime()) && now <= expDate) {
            let currentPeriodo: "mensual" | "anual" =
              lastRec.periodo === "anual" || lastRec.periodo === "mensual" ? lastRec.periodo : "mensual";
            if (!lastRec.periodo && lastRec.created_at) {
              const spanDays = (expDate.getTime() - new Date(lastRec.created_at).getTime()) / 86400000;
              if (spanDays > 180) currentPeriodo = "anual";
            }

            const sameCycle = (approvedList || []).filter(
              (r: any) => String(r.fecha_corte_mes).split("T")[0] === cutStr
            );
            const paidBase = sameCycle.reduce(
              (acc: number, r: any) =>
                acc + Math.max(0, Number(r.monto ?? r.monto_pagado ?? 0) - Number(r.monto_admin_premium || 0)),
              0
            );

            // Tomar el tier más alto cubierto en el ciclo vigente
            let currentPaidTier = 0;
            const explicitTiers = sameCycle
              .map((r: any) => (r.tier !== null && r.tier !== undefined ? Number(r.tier) : null))
              .filter((t: number | null) => t !== null) as number[];
            if (explicitTiers.length > 0) {
              currentPaidTier = Math.max(...explicitTiers);
            } else {
              currentPaidTier = inferTierFromPaidAmount(paidBase, currentPeriodo, isStudent, rates);
            }

            if (currentPeriodo === "anual" && isAnnual) {
              const oldAnnualPrice = Math.round(getTierMonthlyPrice(currentPaidTier, rates) * rates.meses_anual);
              if (cyclePrice > oldAnnualPrice) {
                const exp0 = new Date(expDate);
                exp0.setHours(0, 0, 0, 0);
                const now0 = new Date(now);
                now0.setHours(0, 0, 0, 0);
                const remainingDays = Math.max(
                  1,
                  Math.min(365, Math.round((exp0.getTime() - now0.getTime()) / 86400000))
                );
                amountMxn = Math.max(10, Math.round((cyclePrice - oldAnnualPrice) * (remainingDays / 365)));
                planTitle = `Upgrade Prorrateado Plan Anual (${remainingDays} días restantes hasta ${cutStr})`;
                isOneTimeUpgrade = true;
              }
            } else if (currentPeriodo === "mensual" && !isAnnual && cyclePrice > paidBase) {
              amountMxn = Math.max(10, Math.round(cyclePrice - paidBase));
              planTitle = `Upgrade de Nivel FLUX (Diferencia del ciclo vigente)`;
              isOneTimeUpgrade = true;
            }
          }
        }
      }
    }

    const unitAmountCents = Math.max(1000, Math.round(amountMxn * 100)); // mín $10 MXN
    const sep = returnUrl.includes("?") ? "&" : "?";
    const params: Record<string, string | number | boolean | undefined | null> = {
      mode: isOneTimeUpgrade ? "payment" : "subscription",
      success_url: `${returnUrl}${sep}pago=exitoso`,
      cancel_url: returnUrl,
      client_reference_id: userId,
      "line_items[0][price_data][currency]": "mxn",
      "line_items[0][price_data][unit_amount]": unitAmountCents,
      "line_items[0][price_data][product_data][name]": planTitle,
      "line_items[0][quantity]": 1,
      "metadata[client_reference_id]": userId,
      "metadata[user_type]": userType,
      "metadata[billing_period]": effectivePeriod,
      "metadata[tier]": String(resolvedTier),
      "metadata[is_upgrade]": isOneTimeUpgrade ? "true" : "false",
      "metadata[target_tier_amount_mxn]": String(targetTierAmountMxn),
      "metadata[target_plan_title]": targetRecurringTitle,
    };

    if (stripeCustomerId) {
      params.customer = stripeCustomerId;
    } else if (customerEmail) {
      params.customer_email = customerEmail;
    }

    if (!isOneTimeUpgrade) {
      params["line_items[0][price_data][recurring][interval]"] = isAnnual ? "year" : "month";
      params["subscription_data[metadata][client_reference_id]"] = userId;
      params["subscription_data[metadata][user_type]"] = userType;
      params["subscription_data[metadata][billing_period]"] = effectivePeriod;
      params["subscription_data[metadata][tier]"] = String(resolvedTier);
    } else if (!stripeCustomerId) {
      params["customer_creation"] = "always";
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
