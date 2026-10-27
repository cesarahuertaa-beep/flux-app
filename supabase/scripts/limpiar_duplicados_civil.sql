-- 1. Primero, asignamos el nombre "Juan" al registro que SÍ está Activo actualmente, 
-- para que no pierdas el acceso de tu cuenta activa ni tengas que volver a configurarla.
UPDATE public.clientes 
SET nombre = 'Juan' 
WHERE email = 'cesarhuertaaguilar@gmail.com' 
AND activo = true;

-- 2. Segundo, eliminamos todas las cuentas duplicadas de ese correo 
-- que se crearon por error y quedaron inactivas.
DELETE FROM public.clientes 
WHERE email = 'cesarhuertaaguilar@gmail.com' 
AND activo = false;
