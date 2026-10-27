-- Agregar nuevas columnas a la tabla profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
ADD COLUMN IF NOT EXISTS genero text,
ADD COLUMN IF NOT EXISTS pais text DEFAULT 'México',
ADD COLUMN IF NOT EXISTS estado_provincia text;

-- Agregar nuevas columnas a la tabla clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
ADD COLUMN IF NOT EXISTS genero text,
ADD COLUMN IF NOT EXISTS pais text DEFAULT 'México',
ADD COLUMN IF NOT EXISTS estado_provincia text;
