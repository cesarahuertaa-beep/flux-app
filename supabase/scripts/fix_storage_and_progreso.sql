-- ==============================================================================
-- Script: fix_storage_and_progreso.sql
-- Soluciona:
-- 1. Permisos RLS de Storage en bucket 'comidas' y 'comprobantes'
-- 2. Índice único para evitar 'statement timeout (57014)' en registro de series
-- ==============================================================================

-- 1. STORAGE POLICIES (Comidas, Comprobantes, Logos, Ejercicios)
DO $$
BEGIN
  -- Eliminar políticas previas conflictivas si existen
  DROP POLICY IF EXISTS "Permitir subidas comidas y comprobantes" ON storage.objects;
  DROP POLICY IF EXISTS "Permitir editar comidas y comprobantes" ON storage.objects;
  DROP POLICY IF EXISTS "Permitir borrar comidas y comprobantes" ON storage.objects;
  DROP POLICY IF EXISTS "Public Access Comidas" ON storage.objects;

  -- Crear política amplia para subida de fotos
  CREATE POLICY "Permitir subidas comidas y comprobantes" ON storage.objects 
    FOR INSERT TO public 
    WITH CHECK (bucket_id IN ('comidas', 'comprobantes', 'logos', 'ejercicios', 'progress-photos'));

  CREATE POLICY "Permitir editar comidas y comprobantes" ON storage.objects 
    FOR UPDATE TO public 
    USING (bucket_id IN ('comidas', 'comprobantes', 'logos', 'ejercicios', 'progress-photos'));

  CREATE POLICY "Permitir borrar comidas y comprobantes" ON storage.objects 
    FOR DELETE TO public 
    USING (bucket_id IN ('comidas', 'comprobantes', 'logos', 'ejercicios', 'progress-photos'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error configurando storage policies: %', SQLERRM;
END $$;

-- 2. TABLA PROGRESO: Columna e Índice Único
DO $$
BEGIN
  -- Asegurar que la columna variante_id existe
  ALTER TABLE public.progreso ADD COLUMN IF NOT EXISTS variante_id TEXT DEFAULT 'original';

  -- Crear índice único compuesto para PostgREST upsert (on_conflict)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_progreso_upsert_full
    ON public.progreso (ejercicio_id, cliente_id, semana, serie, tipo, COALESCE(variante_id, 'original'));

  CREATE UNIQUE INDEX IF NOT EXISTS idx_progreso_upsert_5col
    ON public.progreso (ejercicio_id, cliente_id, semana, serie, tipo);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error configurando indices de progreso: %', SQLERRM;
END $$;
