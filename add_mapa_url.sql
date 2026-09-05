-- Añadir campo de Google Maps al perfil
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS mapa_url TEXT;
