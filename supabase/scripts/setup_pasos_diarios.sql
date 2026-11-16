-- Pasos diarios (NEAT) sincronizados desde la app móvil de FLUX (contador de pasos nativo).
-- Ejecutar en el SQL Editor de Supabase.
CREATE TABLE IF NOT EXISTS public.pasos_diarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  pasos INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cliente_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_pasos_diarios_cliente_fecha ON public.pasos_diarios(cliente_id, fecha DESC);

ALTER TABLE public.pasos_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pasos_diarios_cliente_own" ON public.pasos_diarios;
CREATE POLICY "pasos_diarios_cliente_own" ON public.pasos_diarios
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = pasos_diarios.cliente_id
      AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR is_admin()
  OR get_my_role() IN ('superadmin', 'staff', 'administrativo')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = pasos_diarios.cliente_id
      AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR is_admin()
  OR get_my_role() IN ('superadmin', 'staff', 'administrativo')
);

NOTIFY pgrst, 'reload schema';
