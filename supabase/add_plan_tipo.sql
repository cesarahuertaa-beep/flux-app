-- Ejecuta esto en el Editor SQL de tu Supabase
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS plan_tipo text DEFAULT 'estandar';
