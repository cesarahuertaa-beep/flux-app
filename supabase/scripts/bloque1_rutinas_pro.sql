-- ==============================================================
-- FLUX HEALTH SYSTEM: Bloque 1 - Planeador Profesional de Rutinas
-- Columnas opcionales en public.ejercicios para descanso, RIR,
-- notas técnicas y superseries/biseries, más series_detalle JSONB.
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================

ALTER TABLE public.ejercicios
  ADD COLUMN IF NOT EXISTS series_detalle JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS descanso_seg INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rir_objetivo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nota_tecnica TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bloque_grupo TEXT DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
