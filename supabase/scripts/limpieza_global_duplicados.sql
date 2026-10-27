-- Este script limpia TODA la base de datos de Atletas Independientes duplicados.
-- Agrupa por correo electrónico y conserva ÚNICAMENTE una sola cuenta por persona:
-- Da prioridad a la cuenta que esté Activa. Si hay varias o ninguna activa, conserva la más antigua (la original).

DELETE FROM public.clientes
WHERE nutriologo_id IS NULL
AND id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY activo DESC, created_at ASC) as rn
    FROM public.clientes
    WHERE nutriologo_id IS NULL
  ) t WHERE t.rn = 1
);
