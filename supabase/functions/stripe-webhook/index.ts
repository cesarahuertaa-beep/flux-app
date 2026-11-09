// Supabase Edge Function: stripe-webhook
// Automatiza la domiciliación mensual recurrente (Estilo Netflix) para Nutriólogos y Atletas Independientes.
// Escucha eventos `checkout.session.completed` e `invoice.paid` de Stripe y registra automáticamente
// un recibo "aprobado" por +30 días naturales en `recibos_pago` o `recibos_pago_civil`.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function addDaysISO(baseDateStr: string | null, days: number): string {
  const now = new Date();
  let base = now;
  if (baseDateStr) {
    const parsed = new Date(`${baseDateStr}T23:59:59`);
    if (!isNaN(parsed.getTime()) && parsed > now) {
      base = parsed;
    }
  }
  const target = new Date(base);
  target.setDate(target.getDate() + days);
  return target.toISOString().split("T")[0];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const eventType = payload?.type || "";

    if (eventType !== "checkout.session.completed" && eventType !== "invoice.paid") {
      return new Response(JSON.stringify({ received: true, ignored: eventType }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const obj = payload?.data?.object || {};
    const referenceId =
      obj.client_reference_id ||
      obj?.subscription_details?.metadata?.client_reference_id ||
      obj?.metadata?.client_reference_id ||
      null;
    const customerEmail = (
      obj.customer_email ||
      obj?.customer_details?.email ||
      ""
    ).trim().toLowerCase();

    const amountPaidMxn = Number(obj.amount_total ?? obj.amount_paid ?? 0) / 100;
    const receiptUrl =
      obj.hosted_invoice_url ||
      obj.invoice_pdf ||
      `stripe://${obj.id || Date.now()}`;

    // 1. Intentar localizar primero en `profiles` (Nutriólogo Pro o Estudiante)
    let profile: any = null;
    if (referenceId) {
      const { data } = await supabase
        .from("profiles")
        .select("id, role, email")
        .eq("id", referenceId)
        .maybeSingle();
      if (data) profile = data;
    }
    if (!profile && customerEmail) {
      const { data } = await supabase
        .from("profiles")
        .select("id, role, email")
        .ilike("email", customerEmail)
        .in("role", ["nutriologo", "nutriologo_estudiante"])
        .maybeSingle();
      if (data) profile = data;
    }

    if (profile && (profile.role === "nutriologo" || profile.role === "nutriologo_estudiante")) {
      const isUpgrade = obj?.metadata?.is_upgrade === "true";
      const { data: lastReceipt } = await supabase
        .from("recibos_pago")
        .select("fecha_corte_mes, monto_pagado")
        .eq("nutriologo_id", profile.id)
        .eq("estado", "aprobado")
        .order("fecha_corte_mes", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextCutoff =
        isUpgrade && lastReceipt?.fecha_corte_mes
          ? lastReceipt.fecha_corte_mes
          : addDaysISO(lastReceipt?.fecha_corte_mes || null, 30);

      const totalPaidForCycle =
        isUpgrade && lastReceipt?.monto_pagado
          ? Number(lastReceipt.monto_pagado) + amountPaidMxn
          : amountPaidMxn > 0
          ? amountPaidMxn
          : 499;

      const { count: clientCount } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("nutriologo_id", profile.id);

      await supabase.from("recibos_pago").insert({
        nutriologo_id: profile.id,
        fecha_corte_mes: nextCutoff,
        clientes_activos: clientCount || 0,
        monto_pagado: totalPaidForCycle,
        comprobante_url: receiptUrl,
        estado: "aprobado",
      });

      await supabase
        .from("profiles")
        .update({ bloqueado: false })
        .eq("id", profile.id);

      return new Response(
        JSON.stringify({ ok: true, target: "nutriologo", id: profile.id, nextCutoff }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Si no es nutriólogo, localizar en `clientes` (Atleta Independiente Civil)
    let cliente: any = null;
    if (referenceId) {
      const { data } = await supabase
        .from("clientes")
        .select("id, email, plan_tipo")
        .eq("id", referenceId)
        .maybeSingle();
      if (data) cliente = data;
    }
    if (!cliente && customerEmail) {
      const { data } = await supabase
        .from("clientes")
        .select("id, email, plan_tipo")
        .ilike("email", customerEmail)
        .maybeSingle();
      if (data) cliente = data;
    }

    if (cliente) {
      const { data: lastCivilReceipt } = await supabase
        .from("recibos_pago_civil")
        .select("fecha_corte_mes")
        .eq("cliente_id", cliente.id)
        .eq("estado", "aprobado")
        .order("fecha_corte_mes", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextCutoff = addDaysISO(lastCivilReceipt?.fecha_corte_mes || null, 30);

      await supabase.from("recibos_pago_civil").insert({
        cliente_id: cliente.id,
        fecha_corte_mes: nextCutoff,
        monto_pagado: amountPaidMxn > 0 ? amountPaidMxn : 75,
        comprobante_url: receiptUrl,
        estado: "aprobado",
      });

      await supabase
        .from("clientes")
        .update({
          plan_tipo: "premium",
          premium_origen: "propio",
          bloqueado: false,
        })
        .eq("id", cliente.id);

      return new Response(
        JSON.stringify({ ok: true, target: "civil", id: cliente.id, nextCutoff }),
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
