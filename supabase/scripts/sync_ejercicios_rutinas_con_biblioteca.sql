-- ==============================================================================
-- SINCRONIZACIÓN Y HOMOLOGACIÓN DE GRUPOS MUSCULARES EN RUTINAS
-- Propósito:
--   Sincroniza todas las rutinas existentes (tabla 'ejercicios') con la clasificación
--   maestra de 'biblioteca_ejercicios', vinculando tanto por biblioteca_id
--   como por nombre del ejercicio (para historiales y plantillas antiguas).
-- ==============================================================================

-- 1. Sincronizar ejercicios por coincidencia de nombre exacto o biblioteca_id
UPDATE public.ejercicios e
SET
  grupo_muscular = b.grupo_muscular,
  biblioteca_id = COALESCE(e.biblioteca_id, b.id),
  gif_url = CASE 
    WHEN e.gif_url IS NULL OR e.gif_url = '' THEN b.gif_url 
    ELSE e.gif_url 
  END
FROM public.biblioteca_ejercicios b
WHERE (e.biblioteca_id = b.id OR LOWER(TRIM(e.nombre)) = LOWER(TRIM(b.nombre)))
  AND (e.grupo_muscular <> b.grupo_muscular OR e.biblioteca_id IS NULL);

-- 2. Sincronizar también dentro del arreglo JSONB 'alternativas'
UPDATE public.ejercicios e
SET alternativas = (
  SELECT jsonb_agg(
    CASE
      WHEN b.id IS NOT NULL THEN
        elem || jsonb_build_object(
          'grupo_muscular', b.grupo_muscular,
          'biblioteca_id', b.id
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(e.alternativas) AS elem
  LEFT JOIN public.biblioteca_ejercicios b
    ON (elem->>'biblioteca_id') = b.id::text
    OR LOWER(TRIM(elem->>'nombre')) = LOWER(TRIM(b.nombre))
)
WHERE jsonb_typeof(e.alternativas) = 'array'
  AND jsonb_array_length(e.alternativas) > 0;
