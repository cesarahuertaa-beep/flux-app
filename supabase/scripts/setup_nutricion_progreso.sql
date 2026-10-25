-- Tabla de progreso semanal y diario de hábitos nutricionales (hidratación y adherencia de comidas)
CREATE TABLE IF NOT EXISTS public.nutricion_progreso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  dia_id UUID NOT NULL REFERENCES public.nutricion_dias(id) ON DELETE CASCADE,
  semana INTEGER NOT NULL DEFAULT 1,
  agua_ml INTEGER NOT NULL DEFAULT 0,
  meta_agua_ml INTEGER NOT NULL DEFAULT 2500,
  comidas_done JSONB NOT NULL DEFAULT '{}'::jsonb,
  comidas_realizadas INTEGER NOT NULL DEFAULT 0,
  total_comidas INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cliente_id, dia_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_nutricion_progreso_cliente ON public.nutricion_progreso(cliente_id);
CREATE INDEX IF NOT EXISTS idx_nutricion_progreso_dia_semana ON public.nutricion_progreso(dia_id, semana);

ALTER TABLE public.nutricion_progreso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_progreso_cliente_own" ON public.nutricion_progreso;
CREATE POLICY "nutri_progreso_cliente_own" ON public.nutricion_progreso
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = nutricion_progreso.cliente_id
      AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR is_admin()
  OR get_my_role() IN ('superadmin', 'staff', 'administrativo')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = nutricion_progreso.cliente_id
      AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR is_admin()
  OR get_my_role() IN ('superadmin', 'staff', 'administrativo')
);

NOTIFY pgrst, 'reload schema';
