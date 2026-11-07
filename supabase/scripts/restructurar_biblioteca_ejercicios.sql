-- ==============================================================================
-- REESTRUCTURACIÓN DE TABLA: biblioteca_ejercicios
-- Propósito:
--   Estandarizar la biblioteca de ejercicios a los 3 campos únicos del modelo:
--   1. nombre (TEXT, NOT NULL)
--   2. grupo_muscular (TEXT, NOT NULL) - 19 grupos homologados con modelo anatómico
--   3. gif_url (TEXT) - Enlace/archivo de demostración
--
-- Se elimina definitivamente la columna 'tipo_movimiento' obsoleta
-- que provocaba errores de restricción NOT NULL (error 23502).
-- ==============================================================================

-- 1. Quitar la restricción NOT NULL de tipo_movimiento en caso de existir
ALTER TABLE public.biblioteca_ejercicios 
  ALTER COLUMN tipo_movimiento DROP NOT NULL;

-- 2. Eliminar la columna obsoleta tipo_movimiento
ALTER TABLE public.biblioteca_ejercicios 
  DROP COLUMN IF EXISTS tipo_movimiento;

-- 3. Si la tabla de rutinas 'ejercicios' aún tuviese la columna tipo_movimiento con NOT NULL, quitar la restricción:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ejercicios' 
      AND column_name = 'tipo_movimiento'
  ) THEN
    ALTER TABLE public.ejercicios ALTER COLUMN tipo_movimiento DROP NOT NULL;
  END IF;
END $$;
