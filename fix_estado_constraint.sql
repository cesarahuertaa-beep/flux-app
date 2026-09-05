-- 1. Eliminar la restricción actual
ALTER TABLE public.citas DROP CONSTRAINT IF EXISTS citas_estado_check;

-- 2. Crear la nueva restricción incluyendo 'completada'
ALTER TABLE public.citas ADD CONSTRAINT citas_estado_check 
CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'cancelada', 'completada'));
