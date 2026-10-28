-- ==============================================================
-- FLUX HEALTH SYSTEM: VINCULACIÓN DE EVALUACIONES AL CICLO / PLAN
-- ==============================================================
-- Agrega columna ciclo_id a metricas_progreso para asociar cada
-- evaluación a un ciclo/plan de entrenamiento o nutrición específico.

ALTER TABLE public.metricas_progreso 
    ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES public.ciclos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_metricas_progreso_ciclo_id 
    ON public.metricas_progreso(ciclo_id);
