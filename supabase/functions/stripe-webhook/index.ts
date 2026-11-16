// Supabase Edge Function: stripe-webhook
// Automatiza la domiciliación mensual (30d) y anual (365d) para Nutriólogos y Atletas Independientes.
// Incluye verificación criptográfica oficial `stripe-signature`, idempotencia por evento/factura
// y actualización de nivel en upgrades prorrateados.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyStripeSignature(
  rawBytes: Uint8Array,
  sigHeader: string,
  rawSecret: string
): Promise<{ ok: boolean; reason?: string; detail?: Record<string, any> }> {
  const secret = (rawSecret || "").trim().replace(/^["']|["']$/g, "");
  if (!secret) return { ok: false, reason: "empty_secret" };
  if (!sigHeader) return { ok: false, reason: "missing_signature_header" };

  const parts = sigHeader.split(",").map((s) => s.trim());
  let timestamp = "";
  const v1Sigs: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx);
    const v = part.slice(eqIdx + 1);
    if (k === "t") timestamp = v;
    else if (k === "v1") v1Sigs.push(v);
  }

  if (!timestamp || v1Sigs.length === 0) {
    return { ok: false, reason: "malformed_signature_header" };
  }
  const tsNum = Number(timestamp);
  if (isNaN(tsNum)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const tsDiffSec = Math.abs(nowSec - tsNum);
  if (tsDiffSec > 600) {
    return { ok: false, reason: "timestamp_out_of_range", detail: { tsDiffSec } };
  }

  const enc = new TextEncoder();
  const prefix = enc.encode(`${timestamp}.`);
  const payloadToSign = new Uint8Array(prefix.length + rawBytes.length);
  payloadToSign.set(prefix, 0);
  payloadToSign.set(rawBytes, prefix.length);

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signedBuf = await crypto.subtle.sign("HMAC", key, payloadToSign);
  const expectedHex = Array.from(new Uint8Array(signedBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const matched = v1Sigs.some((sig) => timingSafeEqual(sig, expectedHex));
  if (!matched) {
    return {
      ok: false,
      reason: "hmac_mismatch",
      detail: {
        secretStartsWhsec: secret.startsWith("whsec_"),
        secretLen: secret.length,
        hadWhitespace: rawSecret !== secret,
        tsDiffSec,
      },
    };
  }
  return { ok: true };
}

function addDaysISO(baseDateStr: string | null, days: number): string {
  const now = new Date();
  let base = now;
  if (baseDateStr) {
    const clean = baseDateStr.includes("T") ? baseDateStr.split("T")[0] : baseDateStr;
    const parsed = new Date(`${clean}T23:59:59`);
    if (!isNaN(parsed.getTime()) && parsed > now) {
      base = parsed;
    }
  }
  const target = new Date(base);
  target.setDate(target.getDate() + days);
  return target.toISOString().split("T")[0];
}

function toFormUrlEncoded(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.append(k, String(v));
  }
  return sp.toString();
}

async function fetchStripeSubscription(subId: string, stripeKey: string) {
  if (!subId || !stripeKey) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateStripeSubscriptionPrice(
  subId: string,
  stripeKey: string,
  {
    amountMxn,
    title,
    isAnnual,
    tier,
  }: { amountMxn: number; title: string; isAnnual: boolean; tier: number | null }
) {
  if (!subId || !stripeKey || !amountMxn) return;
  try {
    const sub = await fetchStripeSubscription(subId, stripeKey);
    const firstItem = sub?.items?.data?.[0];
    if (!sub || sub.status === "canceled" || !firstItem?.id) return;

    const productId =
      typeof firstItem.price?.product === "string"
        ? firstItem.price.product
        : firstItem.price?.product?.id;

    const params: Record<string, string | number | undefined> = {
      proration_behavior: "none",
      "items[0][id]": firstItem.id,
      "items[0][price_data][currency]": "mxn",
      "items[0][price_data][unit_amount]": Math.max(1000, Math.round(amountMxn * 100)),
      "items[0][price_data][recurring][interval]": isAnnual ? "year" : "month",
    };
    if (productId) {
      params["items[0][price_data][product]"] = productId;
    } else {
      params["items[0][price_data][product_data][name]"] = title;
    }
    if (tier !== null && !isNaN(tier)) {
      params["metadata[tier]"] = String(tier);
    }

    await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toFormUrlEncoded(params),
    });
  } catch (e) {
    console.warn("No se pudo actualizar suscripción futura en Stripe:", e);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBytes = new Uint8Array(await req.arrayBuffer());
    const rawBody = new TextDecoder().decode(rawBytes);
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!webhookSecret.trim()) {
      return new Response(
        JSON.stringify({ error: "Falta configurar STRIPE_WEBHOOK_SECRET en Supabase Secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sigHeader = req.headers.get("stripe-signature") || "";
    const sigCheck = await verifyStripeSignature(rawBytes, sigHeader, webhookSecret);
    if (!sigCheck.ok) {
      return new Response(
        JSON.stringify({
          error: "Firma stripe-signature inválida.",
          reason: sigCheck.reason,
          detail: sigCheck.detail || null,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = JSON.parse(rawBody);
    const eventId = payload?.id || "";
    const eventType = payload?.type || "";
    const obj = payload?.data?.object || {};

    // Eventos de alerta o cancelación de suscripción
    if (eventType === "invoice.payment_failed" || eventType === "customer.subscription.deleted") {
      const custEmail = (obj.customer_email || "").trim().toLowerCase();
      const custId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id || "";
      const refId =
        obj?.subscription_details?.metadata?.client_reference_id ||
        obj?.parent?.subscription_details?.metadata?.client_reference_id ||
        obj?.metadata?.client_reference_id ||
        null;

      let notifProfileId: string | null = null;
      if (refId) {
        const { data: prof } = await supabase.from("profiles").select("id").eq("id", refId).maybeSingle();
        if (prof?.id) notifProfileId = prof.id;
        else {
          const { data: cli } = await supabase.from("clientes").select("auth_id").eq("id", refId).maybeSingle();
          if (cli?.auth_id) notifProfileId = cli.auth_id;
        }
      }
      if (!notifProfileId && custId) {
        const { data: prof } = await supabase.from("profiles").select("id").eq("stripe_customer_id", custId).maybeSingle();
        if (prof?.id) notifProfileId = prof.id;
        else {
          const { data: cli } = await supabase.from("clientes").select("auth_id").eq("stripe_customer_id", custId).maybeSingle();
          if (cli?.auth_id) notifProfileId = cli.auth_id;
        }
      }
      if (!notifProfileId && custEmail) {
        const { data: prof } = await supabase.from("profiles").select("id").ilike("email", custEmail).maybeSingle();
        if (prof?.id) notifProfileId = prof.id;
      }

      if (eventType === "customer.subscription.deleted") {
        if (custId) {
          await supabase.from("profiles").update({ stripe_subscription_id: null }).eq("stripe_customer_id", custId);
          await supabase.from("clientes").update({ stripe_subscription_id: null }).eq("stripe_customer_id", custId);
        }
      }

      if (notifProfileId) {
        await supabase.from("notificaciones").insert({
          profile_id: notifProfileId,
          titulo:
            eventType === "invoice.payment_failed"
              ? "Cargo automático rechazado"
              : "Suscripción domiciliada cancelada",
          mensaje:
            eventType === "invoice.payment_failed"
              ? "No pudimos procesar la renovación automática de tu tarjeta. Actualiza tu método de pago en Mi Membresía antes de que terminen los días de gracia."
              : "Tu suscripción automática fue cancelada. Puedes volver a activarla o pagar por SPEI en Mi Membresía cuando lo necesites.",
          tipo: "alerta",
          link_url: "membresia",
        });
      }

      return new Response(JSON.stringify({ received: true, handled: eventType }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType !== "checkout.session.completed" && eventType !== "invoice.paid") {
      return new Response(JSON.stringify({ received: true, ignored: eventType }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Si es checkout.session de suscripción sin pagar aún (ej. método asíncrono pendiente)
    if (eventType === "checkout.session.completed" && obj.payment_status && obj.payment_status !== "paid") {
      return new Response(JSON.stringify({ received: true, skipped: "payment_not_paid_yet" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicación única: Checkout de suscripción y su primer invoice.paid comparten `invoiceId`
    const invoiceKey =
      eventType === "invoice.paid"
        ? String(obj.id || "")
        : String(obj.invoice || obj.payment_intent || obj.id || "");

    const subscriptionId =
      typeof obj.subscription === "string"
        ? obj.subscription
        : obj?.parent?.subscription_details?.subscription || null;
    const customerId =
      typeof obj.customer === "string" ? obj.customer : obj?.customer?.id || null;

    let mergedMeta: Record<string, any> = {
      ...(obj?.subscription_details?.metadata || {}),
      ...(obj?.parent?.subscription_details?.metadata || {}),
      ...(obj?.metadata || {}),
    };

    let stripeInterval: string | null =
      obj?.lines?.data?.[0]?.price?.recurring?.interval ||
      obj?.lines?.data?.[0]?.plan?.interval ||
      null;

    // En renovaciones automáticas (`invoice.paid`), recuperar metadata directa de la suscripción si falta
    if (
      subscriptionId &&
      stripeSecretKey &&
      (!mergedMeta.billing_period || !mergedMeta.client_reference_id)
    ) {
      const subObj = await fetchStripeSubscription(subscriptionId, stripeSecretKey);
      if (subObj) {
        mergedMeta = { ...(subObj.metadata || {}), ...mergedMeta };
        const subInt = subObj?.items?.data?.[0]?.price?.recurring?.interval;
        if (subInt) stripeInterval = subInt;
      }
    }

    const referenceId = obj.client_reference_id || mergedMeta.client_reference_id || null;
    const customerEmail = (
      obj.customer_email ||
      obj?.customer_details?.email ||
      ""
    ).trim().toLowerCase();

    const amountPaidMxn = Number(obj.amount_total ?? obj.amount_paid ?? 0) / 100;
    const isAnnual =
      mergedMeta.billing_period === "annual" ||
      mergedMeta.billing_period === "anual" ||
      stripeInterval === "year";
    const periodoDb = isAnnual ? "anual" : "mensual";
    const periodDays = isAnnual ? 365 : 30;
    const parsedTier =
      mergedMeta.tier !== undefined && mergedMeta.tier !== null && mergedMeta.tier !== ""
        ? Number(mergedMeta.tier)
        : null;

    const receiptUrl =
      obj.hosted_invoice_url ||
      obj.invoice_pdf ||
      `stripe://${invoiceKey || obj.id || Date.now()}`;

    const userTypeMeta = mergedMeta.user_type || "";

    // 1. Intentar localizar en `profiles` (Nutriólogo Pro o Estudiante), salvo que metadata indique civil explícitamente
    let profile: any = null;
    if (userTypeMeta !== "civil") {
      if (referenceId) {
        const { data } = await supabase
          .from("profiles")
          .select("id, role, email, stripe_customer_id, stripe_subscription_id")
          .eq("id", referenceId)
          .maybeSingle();
        if (data && (data.role === "nutriologo" || data.role === "nutriologo_estudiante")) {
          profile = data;
        }
      }
      if (!profile && customerId) {
        const { data } = await supabase
          .from("profiles")
          .select("id, role, email, stripe_customer_id, stripe_subscription_id")
          .eq("stripe_customer_id", customerId)
          .in("role", ["nutriologo", "nutriologo_estudiante"])
          .maybeSingle();
        if (data) profile = data;
      }
      if (!profile && customerEmail) {
        const { data } = await supabase
          .from("profiles")
          .select("id, role, email, stripe_customer_id, stripe_subscription_id")
          .ilike("email", customerEmail)
          .in("role", ["nutriologo", "nutriologo_estudiante"])
          .limit(1);
        if (data?.[0]) profile = data[0];
      }
    }

    if (profile) {
      // Verificar idempotencia antes de insertar
      if (invoiceKey) {
        const { data: existingInv } = await supabase
          .from("recibos_pago")
          .select("id")
          .eq("stripe_invoice_id", invoiceKey)
          .maybeSingle();
        if (existingInv) {
          return new Response(JSON.stringify({ ok: true, deduped: true, target: "nutriologo" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const isUpgrade = mergedMeta.is_upgrade === "true";
      const { data: lastReceipt } = await supabase
        .from("recibos_pago")
        .select("fecha_corte_mes, monto, monto_pagado, periodo")
        .eq("nutriologo_id", profile.id)
        .eq("estado", "aprobado")
        .order("fecha_corte_mes", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextCutoff =
        isUpgrade && lastReceipt?.fecha_corte_mes
          ? String(lastReceipt.fecha_corte_mes).split("T")[0]
          : addDaysISO(lastReceipt?.fecha_corte_mes || null, periodDays);

      const finalAmount = amountPaidMxn > 0 ? amountPaidMxn : isAnnual ? 4990 : 499;

      const { data: clientRows } = await supabase
        .from("clientes")
        .select("id, activo, objetivo")
        .eq("nutriologo_id", profile.id);
      const activeClientCount = (clientRows || []).filter(
        (c: any) => c.activo !== false && c.objetivo !== "Mi entrenamiento personal"
      ).length;

      const insertPayload: Record<string, any> = {
        nutriologo_id: profile.id,
        fecha_corte_mes: nextCutoff,
        clientes_activos: activeClientCount,
        monto: finalAmount,
        monto_pagado: finalAmount,
        monto_admin_premium: 0,
        periodo: periodoDb,
        tier: parsedTier,
        comprobante_url: receiptUrl,
        estado: "aprobado",
        stripe_event_id: eventId || null,
        stripe_invoice_id: invoiceKey || null,
      };

      const { error: insertErr } = await supabase.from("recibos_pago").insert(insertPayload);
      if (insertErr) {
        if (insertErr.code === "23505") {
          return new Response(JSON.stringify({ ok: true, deduped: true, target: "nutriologo" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Error insertando recibo nutriólogo: ${insertErr.message}`);
      }

      const profileUpdates: Record<string, any> = { bloqueado: false };
      if (customerId) profileUpdates.stripe_customer_id = customerId;
      if (subscriptionId && !isUpgrade) profileUpdates.stripe_subscription_id = subscriptionId;
      await supabase.from("profiles").update(profileUpdates).eq("id", profile.id);

      // Si pagó un upgrade único teniendo suscripción activa en Stripe, actualizar tarifa de próxima renovación
      if (
        isUpgrade &&
        profile.stripe_subscription_id &&
        stripeSecretKey &&
        Number(mergedMeta.target_tier_amount_mxn) > 0
      ) {
        await updateStripeSubscriptionPrice(profile.stripe_subscription_id, stripeSecretKey, {
          amountMxn: Number(mergedMeta.target_tier_amount_mxn),
          title: mergedMeta.target_plan_title || "Membresía FLUX",
          isAnnual,
          tier: parsedTier,
        });
      }

      return new Response(
        JSON.stringify({ ok: true, target: "nutriologo", id: profile.id, periodo: periodoDb, nextCutoff }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Localizar en `clientes` (Atleta Independiente Civil: siempre nutriologo_id IS NULL)
    let cliente: any = null;
    if (referenceId) {
      const { data } = await supabase
        .from("clientes")
        .select("id, email, plan_tipo, auth_id, stripe_customer_id")
        .eq("id", referenceId)
        .maybeSingle();
      if (data) cliente = data;
    }
    if (!cliente && customerId) {
      const { data } = await supabase
        .from("clientes")
        .select("id, email, plan_tipo, auth_id, stripe_customer_id")
        .is("nutriologo_id", null)
        .eq("stripe_customer_id", customerId)
        .limit(1);
      if (data?.[0]) cliente = data[0];
    }
    if (!cliente && customerEmail) {
      const { data } = await supabase
        .from("clientes")
        .select("id, email, plan_tipo, auth_id, stripe_customer_id")
        .is("nutriologo_id", null)
        .ilike("email", customerEmail)
        .limit(1);
      if (data?.[0]) cliente = data[0];
    }

    if (cliente) {
      if (invoiceKey) {
        const { data: existingCivilInv } = await supabase
          .from("recibos_pago_civil")
          .select("id")
          .eq("stripe_invoice_id", invoiceKey)
          .maybeSingle();
        if (existingCivilInv) {
          return new Response(JSON.stringify({ ok: true, deduped: true, target: "civil" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: lastCivilReceipt } = await supabase
        .from("recibos_pago_civil")
        .select("fecha_corte_mes")
        .eq("cliente_id", cliente.id)
        .eq("estado", "aprobado")
        .order("fecha_corte_mes", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextCutoff = addDaysISO(lastCivilReceipt?.fecha_corte_mes || null, periodDays);
      const finalCivilAmount = amountPaidMxn > 0 ? amountPaidMxn : isAnnual ? 750 : 75;

      const { error: civilInsertErr } = await supabase.from("recibos_pago_civil").insert({
        cliente_id: cliente.id,
        fecha_corte_mes: nextCutoff,
        monto: finalCivilAmount,
        monto_pagado: finalCivilAmount,
        periodo: periodoDb,
        comprobante_url: receiptUrl,
        estado: "aprobado",
        stripe_event_id: eventId || null,
        stripe_invoice_id: invoiceKey || null,
      });

      if (civilInsertErr) {
        if (civilInsertErr.code === "23505") {
          return new Response(JSON.stringify({ ok: true, deduped: true, target: "civil" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Error insertando recibo civil: ${civilInsertErr.message}`);
      }

      const clientUpdates: Record<string, any> = {
        activo: true,
        deactivated_at: null,
        plan_tipo: "premium",
        premium_origen: "propio",
      };
      if (customerId) clientUpdates.stripe_customer_id = customerId;
      if (subscriptionId) clientUpdates.stripe_subscription_id = subscriptionId;
      await supabase.from("clientes").update(clientUpdates).eq("id", cliente.id);

      return new Response(
        JSON.stringify({ ok: true, target: "civil", id: cliente.id, periodo: periodoDb, nextCutoff }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ received: true, warning: "No matching user found for referenceId/email" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Webhook error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
