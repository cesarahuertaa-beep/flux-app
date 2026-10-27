-- 1. Resetea a TODOS los Atletas Independientes a Estándar por defecto
UPDATE public.clientes 
SET plan_tipo = 'estandar' 
WHERE nutriologo_id IS NULL;

-- 2. Escanea el historial de pagos y asciende a Premium SOLO a los que de verdad
-- tengan un recibo "Aprobado" y que aún esté dentro de su vigencia (incluyendo días de gracia)
UPDATE public.clientes c
SET plan_tipo = 'premium'
FROM (
  SELECT cliente_id, MAX(fecha_corte_mes) as max_fecha
  FROM public.recibos_pago_civil
  WHERE estado = 'aprobado'
  GROUP BY cliente_id
) r
WHERE c.id = r.cliente_id
  AND c.nutriologo_id IS NULL
  AND (r.max_fecha::date + interval '2 days') >= current_date;
