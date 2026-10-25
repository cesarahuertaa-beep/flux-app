-- ==============================================================================
-- FLUX: Corrección Definitiva de Storage y Permisos de Progreso / Mi Plan
-- Ejecuta este script en el Editor SQL de tu panel de Supabase.
-- ==============================================================================

-- 1. Asegurar que los buckets sean públicos
UPDATE storage.buckets SET public = true WHERE id IN ('comidas', 'progress-photos', 'logos', 'comprobantes', 'ejercicios');

-- 2. Políticas de SELECT (Lectura Pública) en Storage
DROP POLICY IF EXISTS "Permitir lectura publica de imagenes FLUX" ON storage.objects;
CREATE POLICY "Permitir lectura publica de imagenes FLUX"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('comidas', 'progress-photos', 'logos', 'comprobantes', 'ejercicios'));

-- 3. Políticas de INSERT en Storage para usuarios autenticados
DROP POLICY IF EXISTS "Permitir subida a usuarios autenticados FLUX" ON storage.objects;
CREATE POLICY "Permitir subida a usuarios autenticados FLUX"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('comidas', 'progress-photos', 'logos', 'comprobantes', 'ejercicios'));

-- 4. Políticas de UPDATE en Storage (para soportar x-upsert / sobrescrituras)
DROP POLICY IF EXISTS "Permitir actualizacion a usuarios autenticados FLUX" ON storage.objects;
CREATE POLICY "Permitir actualizacion a usuarios autenticados FLUX"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('comidas', 'progress-photos', 'logos', 'comprobantes', 'ejercicios'))
WITH CHECK (bucket_id IN ('comidas', 'progress-photos', 'logos', 'comprobantes', 'ejercicios'));

-- 5. Políticas de DELETE en Storage
DROP POLICY IF EXISTS "Permitir borrado a usuarios autenticados FLUX" ON storage.objects;
CREATE POLICY "Permitir borrado a usuarios autenticados FLUX"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('comidas', 'progress-photos', 'logos', 'comprobantes', 'ejercicios'));

-- 6. Políticas de RLS en metricas_progreso para Atletas Independientes / Pacientes
ALTER TABLE public.metricas_progreso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver su propio progreso" ON public.metricas_progreso;
CREATE POLICY "Usuarios pueden ver su propio progreso" ON public.metricas_progreso
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = cliente_id AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'administrativo')
  )
);

DROP POLICY IF EXISTS "Usuarios pueden insertar su propio progreso" ON public.metricas_progreso;
CREATE POLICY "Usuarios pueden insertar su propio progreso" ON public.metricas_progreso
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = cliente_id AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'administrativo')
  )
);

DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio progreso" ON public.metricas_progreso;
CREATE POLICY "Usuarios pueden actualizar su propio progreso" ON public.metricas_progreso
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = cliente_id AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'administrativo')
  )
);

DROP POLICY IF EXISTS "Usuarios pueden eliminar su propio progreso" ON public.metricas_progreso;
CREATE POLICY "Usuarios pueden eliminar su propio progreso" ON public.metricas_progreso
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = cliente_id AND (c.auth_id = auth.uid() OR c.nutriologo_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'administrativo')
  )
);

-- 7. Índices de rendimiento para borrados y consultas masivas instantáneas
CREATE INDEX IF NOT EXISTS idx_comidas_dia_id ON public.comidas(dia_id);
CREATE INDEX IF NOT EXISTS idx_ejercicios_rutina_id ON public.ejercicios(rutina_id);
CREATE INDEX IF NOT EXISTS idx_nutricion_dias_nutricion_id ON public.nutricion_dias(nutricion_id);
CREATE INDEX IF NOT EXISTS idx_progreso_ejercicio_id ON public.progreso(ejercicio_id);
CREATE INDEX IF NOT EXISTS idx_progreso_cliente_id ON public.progreso(cliente_id);
CREATE INDEX IF NOT EXISTS idx_metricas_progreso_cliente_id ON public.metricas_progreso(cliente_id);
