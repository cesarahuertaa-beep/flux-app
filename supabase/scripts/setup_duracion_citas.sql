-- ==============================================================
-- FLUX HEALTH SYSTEM: DURACIÓN PERSONALIZADA DE CITAS / CONSULTAS
-- ==============================================================

-- 1. Agregar columna duracion_cita a profiles (duración habitual del nutriólogo en minutos)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS duracion_cita INTEGER DEFAULT 60;

-- 2. Agregar columna duracion_minutos a disponibilidad (duración por bloque horario)
ALTER TABLE public.disponibilidad 
ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER DEFAULT 60;

-- 3. Agregar columna duracion_minutos a citas (duración específica de la cita)
ALTER TABLE public.citas 
ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER DEFAULT 60;
