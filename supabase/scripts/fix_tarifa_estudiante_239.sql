-- ==============================================================================
-- Script: fix_tarifa_estudiante_239.sql
-- Propósito: Establecer de forma inmediata la tarifa base de Nutriólogo Estudiante
--           en $239.00 MXN en la tabla configuracion_plataforma para que aplique
--           desde hoy mismo sin esperar al próximo corte de mes.
-- ==============================================================================

UPDATE public.configuracion_plataforma
SET tarifas_config = jsonb_build_array(
  jsonb_build_object(
    'nutri_tier1', 50,
    'nutri_tier2', 45,
    'nutri_tier3', 40,
    'nutri_estudiante', 239,
    'civil_premium', 75,
    'admin_premium', 50,
    'comision_pct', 35,
    'effective_from', '2020-01-01',
    'updated_at', timezone('utc', now())
  )
)
WHERE id = 1;
