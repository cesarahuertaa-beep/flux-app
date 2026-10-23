-- ============================================================================
-- Premium de equipo: Staff (premium por defecto) + Administrativos patrocinados
-- Ejecutar completo en el SQL Editor de Supabase (es idempotente).
-- ============================================================================

-- 1. Columnas nuevas ---------------------------------------------------------
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS premium_origen text;   -- null | 'pago' | 'staff' | 'patrocinado'

ALTER TABLE public.recibos_pago
  ADD COLUMN IF NOT EXISTS monto_admin_premium numeric(10,2) NOT NULL DEFAULT 0;

-- 2. Tabla de patrocinios ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.premium_patrocinado (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patrocinador_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  miembro_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cliente_id        uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  gratis            boolean NOT NULL DEFAULT false,  -- true cuando patrocina un nutriólogo estudiante
  activo_desde      timestamptz NOT NULL DEFAULT now(),
  desactivado_en    timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS premium_patrocinado_activo_uq
  ON public.premium_patrocinado (miembro_profile_id) WHERE desactivado_en IS NULL;

ALTER TABLE public.premium_patrocinado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "premium_patrocinado_select" ON public.premium_patrocinado;
CREATE POLICY "premium_patrocinado_select" ON public.premium_patrocinado
  FOR SELECT USING (
    patrocinador_id = auth.uid()
    OR miembro_profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin','staff'))
  );
-- Sin políticas de INSERT/UPDATE: sólo se escribe vía las funciones SECURITY DEFINER de abajo.

-- 3. Activar premium patrocinado (nutriólogo -> su administrativo) ------------
CREATE OR REPLACE FUNCTION public.activar_premium_equipo(p_miembro uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_patro  public.profiles%ROWTYPE;
  v_miem   public.profiles%ROWTYPE;
  v_cli    public.clientes%ROWTYPE;
BEGIN
  SELECT * INTO v_patro FROM public.profiles WHERE id = auth.uid();
  IF v_patro.id IS NULL OR v_patro.role NOT IN ('nutriologo','nutriologo_estudiante') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_miem FROM public.profiles WHERE id = p_miembro;
  IF v_miem.id IS NULL OR v_miem.role <> 'administrativo' OR v_miem.nutriologo_id IS DISTINCT FROM v_patro.id THEN
    RAISE EXCEPTION 'El administrativo no pertenece a tu equipo';
  END IF;

  IF EXISTS (SELECT 1 FROM public.premium_patrocinado WHERE miembro_profile_id = p_miembro AND desactivado_en IS NULL) THEN
    RETURN; -- ya activo
  END IF;

  -- Cuenta de atleta independiente (por auth_id o email); se crea si no existe
  SELECT * INTO v_cli FROM public.clientes
   WHERE nutriologo_id IS NULL AND (auth_id = p_miembro OR lower(email) = lower(v_miem.email))
   ORDER BY created_at ASC LIMIT 1;

  IF v_cli.id IS NULL THEN
    INSERT INTO public.clientes (nombre, email, auth_id, activo, nutriologo_id, plan_tipo, premium_origen)
    VALUES (v_miem.nombre, v_miem.email, p_miembro, true, NULL, 'premium', 'patrocinado')
    RETURNING * INTO v_cli;
  ELSE
    UPDATE public.clientes
       SET plan_tipo = 'premium', premium_origen = 'patrocinado', activo = true, deactivated_at = NULL,
           auth_id = COALESCE(auth_id, p_miembro)
     WHERE id = v_cli.id;
  END IF;

  INSERT INTO public.premium_patrocinado (patrocinador_id, miembro_profile_id, cliente_id, gratis)
  VALUES (v_patro.id, p_miembro, v_cli.id, v_patro.role = 'nutriologo_estudiante');
END; $$;

-- 4. Desactivar premium patrocinado -------------------------------------------
CREATE OR REPLACE FUNCTION public.desactivar_premium_equipo(p_miembro uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.premium_patrocinado%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.premium_patrocinado
   WHERE miembro_profile_id = p_miembro AND desactivado_en IS NULL;
  IF v_row.id IS NULL THEN RETURN; END IF;
  IF v_row.patrocinador_id <> auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.premium_patrocinado SET desactivado_en = now() WHERE id = v_row.id;
  -- Baja inmediata a estándar sólo si su premium venía del patrocinio
  UPDATE public.clientes SET plan_tipo = 'estandar', premium_origen = NULL
   WHERE id = v_row.cliente_id AND premium_origen = 'patrocinado';
END; $$;

-- 5. Verificación de premium de la cuenta de atleta (la invoca el propio atleta) --
--    Reglas: staff activo = premium; patrocinado = patrocinio vigente y patrocinador sin mora.
CREATE OR REPLACE FUNCTION public.verificar_premium_cliente(p_cliente uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.clientes%ROWTYPE;
  v_ok boolean := false;
  v_pat public.premium_patrocinado%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.clientes WHERE id = p_cliente;
  IF c.id IS NULL OR c.auth_id IS DISTINCT FROM auth.uid() THEN RETURN NULL; END IF;

  IF c.premium_origen = 'staff' THEN
    v_ok := EXISTS (SELECT 1 FROM public.profiles WHERE id = c.auth_id AND role = 'staff' AND activo IS NOT FALSE);
  ELSIF c.premium_origen = 'patrocinado' THEN
    SELECT * INTO v_pat FROM public.premium_patrocinado
     WHERE miembro_profile_id = c.auth_id AND desactivado_en IS NULL;
    IF v_pat.id IS NOT NULL THEN
      v_ok := EXISTS (
        SELECT 1 FROM public.profiles s
         WHERE s.id = v_pat.patrocinador_id AND s.activo IS NOT FALSE AND s.bloqueado IS NOT TRUE
      ) AND EXISTS (
        SELECT 1 FROM public.profiles m
         WHERE m.id = c.auth_id AND m.role = 'administrativo'
           AND m.nutriologo_id = v_pat.patrocinador_id AND m.activo IS NOT FALSE
      );
    END IF;
  ELSE
    RETURN c.plan_tipo; -- origen 'pago' / null: lo maneja el flujo de recibos
  END IF;

  IF v_ok THEN
    UPDATE public.clientes SET plan_tipo = 'premium', activo = true, deactivated_at = NULL WHERE id = c.id;
    RETURN 'premium';
  ELSE
    UPDATE public.clientes SET plan_tipo = 'estandar', premium_origen = NULL WHERE id = c.id;
    UPDATE public.premium_patrocinado SET desactivado_en = now()
     WHERE miembro_profile_id = c.auth_id AND desactivado_en IS NULL AND c.premium_origen = 'patrocinado';
    RETURN 'estandar';
  END IF;
END; $$;

-- 6. Staff = premium por defecto (trigger sobre profiles) ----------------------
CREATE OR REPLACE FUNCTION public.sync_staff_premium()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cli public.clientes%ROWTYPE;
BEGIN
  IF NEW.role = 'staff' THEN
    SELECT * INTO v_cli FROM public.clientes
     WHERE nutriologo_id IS NULL AND (auth_id = NEW.id OR (NEW.email IS NOT NULL AND lower(email) = lower(NEW.email)))
     ORDER BY created_at ASC LIMIT 1;
    IF v_cli.id IS NULL THEN
      INSERT INTO public.clientes (nombre, email, auth_id, activo, nutriologo_id, plan_tipo, premium_origen)
      VALUES (NEW.nombre, NEW.email, NEW.id, true, NULL, 'premium', 'staff');
    ELSE
      UPDATE public.clientes
         SET plan_tipo = 'premium', premium_origen = 'staff', activo = true, deactivated_at = NULL,
             auth_id = COALESCE(auth_id, NEW.id)
       WHERE id = v_cli.id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.role = 'staff' AND NEW.role <> 'staff' THEN
    UPDATE public.clientes SET plan_tipo = 'estandar', premium_origen = NULL
     WHERE auth_id = NEW.id AND premium_origen = 'staff';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_staff_premium ON public.profiles;
CREATE TRIGGER trg_sync_staff_premium
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_premium();

-- 7. Backfill: staff que ya existen ---------------------------------------------
UPDATE public.profiles SET role = role WHERE role = 'staff';  -- dispara el trigger

GRANT EXECUTE ON FUNCTION public.activar_premium_equipo(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.desactivar_premium_equipo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_premium_cliente(uuid) TO authenticated;
