-- ==============================================================
-- FLUX HEALTH SYSTEM: Rutinas Híbridas por Serie y Cierre de Sesión
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================

-- 1. Desglose opcional por serie y variables profesionales en ejercicios
--    (series_detalle vacío [] = usa reps_sugeridas / peso_sugerido uniforme)
ALTER TABLE public.ejercicios
  ADD COLUMN IF NOT EXISTS series_detalle JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS descanso_seg INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rir_objetivo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nota_tecnica TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bloque_grupo TEXT DEFAULT NULL;

-- 2. Estado de sesión finalizada por rutina y semana (bloqueo seguro contra ediciones accidentales)
CREATE TABLE IF NOT EXISTS public.rutina_sesiones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  rutina_id UUID NOT NULL REFERENCES public.rutinas(id) ON DELETE CASCADE,
  semana INTEGER NOT NULL DEFAULT 1,
  finalizada BOOLEAN NOT NULL DEFAULT true,
  finalizada_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(cliente_id, rutina_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_rutina_sesiones_cliente
  ON public.rutina_sesiones(cliente_id);

CREATE INDEX IF NOT EXISTS idx_rutina_sesiones_rutina_sem
  ON public.rutina_sesiones(rutina_id, semana);

ALTER TABLE public.rutina_sesiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rutina_sesiones_cliente_own" ON public.rutina_sesiones;
CREATE POLICY "rutina_sesiones_cliente_own" ON public.rutina_sesiones
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = rutina_sesiones.cliente_id
      AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR is_admin()
  OR get_my_role() IN ('superadmin', 'staff', 'administrativo')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = rutina_sesiones.cliente_id
      AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR is_admin()
  OR get_my_role() IN ('superadmin', 'staff', 'administrativo')
);

NOTIFY pgrst, 'reload schema';
