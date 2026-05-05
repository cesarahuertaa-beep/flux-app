import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, role, nombre, nombre_marca, color_primario } = await req.json();

    if (!email) throw new Error("Email requerido");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { role, nombre, nombre_marca, color_primario },
      redirectTo: "https://flux-app-xi.vercel.app",
    });

    if (error) throw error;

    // Ya creado en auth.users, ahora forzamos la creación/actualización del perfil.
    // Usamos upsert para que si el trigger lo insertó, solo lo actualice.
    // Si el trigger falló, esto lo insertará y si ESTO falla, veremos el error exacto.
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        role: role || 'nutriologo',
        nombre: nombre || email.split('@')[0],
        nombre_marca: nombre_marca || nombre || email.split('@')[0],
        color_primario: color_primario,
        activo: true
      });

      if (profileError) {
        throw new Error(`Error en tabla profiles: ${profileError.message} (Detalles: ${profileError.details})`);
      }
    }

    return new Response(JSON.stringify(data.user), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});