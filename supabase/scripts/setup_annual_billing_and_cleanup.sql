-- ============================================================================
-- Migración: Planes Anuales (2 meses gratis), Idempotencia Stripe y Limpieza
-- de "Administrativo Premium Patrocinado" para nutriólogos.
-- IMPORTANTE: Los colaboradores corporativos (role = 'staff') conservan su
-- cuenta Premium patrocinada por completo.
-- Script idempotente — seguro para ejecutar en el SQL Editor de Supabase.
-- ============================================================================

-- 1. Columnas explícitas de plan/periodo e idempotencia Stripe en recibos_pago
ALTER TABLE public.recibos_pago
  ADD COLUMN IF NOT EXISTS periodo TEXT NOT NULL DEFAULT 'mensual',
  ADD COLUMN IF NOT EXISTS tier INTEGER,
  ADD COLUMN IF NOT EXISTS clientes_activos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS stripe_event_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recibos_pago_periodo_check'
  ) THEN
    ALTER TABLE public.recibos_pago
      ADD CONSTRAINT recibos_pago_periodo_check CHECK (periodo IN ('mensual', 'anual'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recibos_pago_stripe_event_uq
  ON public.recibos_pago (stripe_event_id) WHERE stripe_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recibos_pago_stripe_invoice_uq
  ON public.recibos_pago (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- 2. Columnas explícitas de periodo e idempotencia Stripe en recibos_pago_civil
ALTER TABLE public.recibos_pago_civil
  ADD COLUMN IF NOT EXISTS periodo TEXT NOT NULL DEFAULT 'mensual',
  ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS stripe_event_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recibos_pago_civil_periodo_check'
  ) THEN
    ALTER TABLE public.recibos_pago_civil
      ADD CONSTRAINT recibos_pago_civil_periodo_check CHECK (periodo IN ('mensual', 'anual'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recibos_pago_civil_stripe_event_uq
  ON public.recibos_pago_civil (stripe_event_id) WHERE stripe_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recibos_pago_civil_stripe_invoice_uq
  ON public.recibos_pago_civil (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- 3. Identificadores de Stripe en profiles y clientes (para Portal y Upgrades)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- 4. Retirar patrocinio "Administrativo Premium" de nutriólogos (manteniendo 'staff')
UPDATE public.premium_patrocinado
SET desactivado_en = NOW()
WHERE desactivado_en IS NULL;

-- Quienes tenían premium únicamente por patrocinio de nutriólogo vuelven a estándar
-- (a menos que tengan un recibo civil aprobado vigente, en cuyo caso recalcular_premium lo mantendría).
UPDATE public.clientes c
SET plan_tipo = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.recibos_pago_civil r
    WHERE r.cliente_id = c.id
      AND r.estado = 'aprobado'
      AND (r.fecha_corte_mes::date + INTERVAL '2 days') >= CURRENT_DATE
  ) THEN 'premium'
  ELSE 'estandar'
END,
premium_origen = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.recibos_pago_civil r
    WHERE r.cliente_id = c.id
      AND r.estado = 'aprobado'
      AND (r.fecha_corte_mes::date + INTERVAL '2 days') >= CURRENT_DATE
  ) THEN 'propio'
  ELSE NULL
END
WHERE c.nutriologo_id IS NULL
  AND c.premium_origen = 'patrocinado';

-- Deshabilitar nueva activación de patrocinios desde nutriólogos hacia administrativos
CREATE OR REPLACE FUNCTION public.activar_premium_equipo(p_miembro uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'El beneficio de administrativo patrocinado fue descontinuado. El colaborador puede contratar su propia suscripción Atleta Pro o ser agregado como paciente.';
END; $$;

-- Conservar verificación de Premium exclusivo para Staff corporativo activo
CREATE OR REPLACE FUNCTION public.verificar_premium_cliente(p_cliente uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.clientes%ROWTYPE;
  v_ok boolean := false;
BEGIN
  SELECT * INTO c FROM public.clientes WHERE id = p_cliente;
  IF c.id IS NULL OR c.auth_id IS DISTINCT FROM auth.uid() THEN RETURN NULL; END IF;

  IF c.premium_origen = 'staff' THEN
    v_ok := EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = c.auth_id AND role = 'staff' AND activo IS NOT FALSE
    );
  ELSIF c.premium_origen = 'patrocinado' THEN
    -- Cualquier patrocinio heredado de nutriólogo pasa a estándar si no tiene recibo propio
    v_ok := false;
  ELSE
    RETURN c.plan_tipo;
  END IF;

  IF v_ok THEN
    UPDATE public.clientes
    SET plan_tipo = 'premium', activo = true, deactivated_at = NULL
    WHERE id = c.id;
    RETURN 'premium';
  ELSE
    UPDATE public.clientes
    SET plan_tipo = 'estandar', premium_origen = NULL
    WHERE id = c.id;
    RETURN 'estandar';
  END IF;
END; $$;

NOTIFY pgrst, 'reload schema';
