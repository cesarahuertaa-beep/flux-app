-- ==============================================================================
-- REESTRUCTURACIÓN Y HOMOLOGACIÓN: biblioteca_ejercicios y ejercicios
-- Propósito:
--   1. Eliminar columna obsoleta 'tipo_movimiento' y estandarizar a 3 campos:
--      - nombre (TEXT, NOT NULL)
--      - grupo_muscular (TEXT, NOT NULL) - 19 grupos del modelo anatómico digital
--      - gif_url (TEXT)
--   2. Homologar grupo_muscular a minúsculas canónicas (ej. 'Pecho' -> 'pecho')
--      para no requerir parches adicionales en la app.
--   3. Sincronizar automáticamente cambios de biblioteca_ejercicios hacia las
--      rutinas existentes (tabla 'ejercicios' y su arreglo JSON 'alternativas').
-- ==============================================================================

-- 1. Quitar restricción NOT NULL y eliminar la columna obsoleta tipo_movimiento
ALTER TABLE public.biblioteca_ejercicios 
  ALTER COLUMN tipo_movimiento DROP NOT NULL;

ALTER TABLE public.biblioteca_ejercicios 
  DROP COLUMN IF EXISTS tipo_movimiento;

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

-- 2. Normalizar todos los grupos musculares a minúsculas canónicas (ej. 'Pecho' -> 'pecho')
UPDATE public.biblioteca_ejercicios
SET grupo_muscular = LOWER(TRIM(grupo_muscular))
WHERE grupo_muscular IS NOT NULL AND grupo_muscular <> LOWER(TRIM(grupo_muscular));

UPDATE public.ejercicios
SET grupo_muscular = LOWER(TRIM(grupo_muscular))
WHERE grupo_muscular IS NOT NULL AND grupo_muscular <> LOWER(TRIM(grupo_muscular));

-- 3. Sincronizar ejercicios de rutinas actuales con los datos maestros de biblioteca_ejercicios
UPDATE public.ejercicios e
SET
  nombre = b.nombre,
  grupo_muscular = b.grupo_muscular,
  gif_url = COALESCE(b.gif_url, e.gif_url)
FROM public.biblioteca_ejercicios b
WHERE e.biblioteca_id = b.id;

-- 4. Trigger automático: al editar un ejercicio en biblioteca_ejercicios,
--    propagar nombre, grupo_muscular y gif_url a todas las rutinas que lo usen
CREATE OR REPLACE FUNCTION public.fn_sync_biblioteca_ejercicio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Actualizar ejercicios principales vinculados por biblioteca_id
  UPDATE public.ejercicios
  SET
    nombre = NEW.nombre,
    grupo_muscular = LOWER(TRIM(NEW.grupo_muscular)),
    gif_url = COALESCE(NEW.gif_url, '')
  WHERE biblioteca_id = NEW.id;

  -- Actualizar también dentro del arreglo JSONB 'alternativas' cuando contenga este biblioteca_id
  UPDATE public.ejercicios
  SET alternativas = (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'biblioteca_id') = NEW.id::text THEN
          elem || jsonb_build_object(
            'nombre', NEW.nombre,
            'grupo_muscular', LOWER(TRIM(NEW.grupo_muscular)),
            'gif_url', COALESCE(NEW.gif_url, '')
          )
        ELSE elem
      END
    )
    FROM jsonb_array_elements(alternativas) AS elem
  )
  WHERE jsonb_typeof(alternativas) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(alternativas) AS elem
      WHERE (elem->>'biblioteca_id') = NEW.id::text
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_biblioteca_ejercicio ON public.biblioteca_ejercicios;
CREATE TRIGGER trg_sync_biblioteca_ejercicio
AFTER UPDATE OF nombre, grupo_muscular, gif_url ON public.biblioteca_ejercicios
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_biblioteca_ejercicio();
