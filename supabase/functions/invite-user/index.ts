import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://flux-sport.com",
  "https://www.flux-sport.com",
  "https://flux-app-xi.vercel.app",
];

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Validar que el llamador es un usuario autenticado con rol adecuado ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autorizado");

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verificar el JWT del llamador
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) throw new Error("Token inválido o expirado");

    // Verificar que el llamador tiene un rol autorizado
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    const allowedRoles = ["superadmin", "admin", "nutriologo"];
    if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
      throw new Error("No tienes permisos para invitar usuarios");
    }

    // ── Procesar la invitación ──
    const { email, role, nombre, nombre_marca, color_primario, telefono, nutriologo_id } = await req.json();

    if (!email) throw new Error("Email requerido");

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { role, nombre, nombre_marca, color_primario },
      redirectTo: "https://flux-sport.com",
    });

    if (error) throw error;

    // Ya creado en auth.users, ahora forzamos la creación/actualización del perfil.
    // Usamos upsert para que si el trigger lo insertó, solo lo actualice.
    // Si el trigger falló, esto lo insertará y si ESTO falla, veremos el error exacto.
    if (data.user) {
      const profileData: Record<string, unknown> = {
        id: data.user.id,
        email: data.user.email,
        role: role || 'nutriologo',
        nombre: nombre || email.split('@')[0],
        nombre_marca: nombre_marca || nombre || email.split('@')[0],
        color_primario: color_primario,
        activo: true,
      };
      // Si viene telefono, incluirlo
      if (telefono) profileData.telefono = telefono;
      // Si viene nutriologo_id (para administrativos), incluirlo
      if (nutriologo_id) profileData.nutriologo_id = nutriologo_id;

      const { error: profileError } = await supabase.from('profiles').upsert(profileData);

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