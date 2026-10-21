-- 1. Añadir las columnas rating y num_reviews a profiles (que no existían)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS num_reviews INTEGER DEFAULT 0;

-- 2. Crear tabla de reseñas ligada a citas
CREATE TABLE IF NOT EXISTS public.citas_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cita_id UUID NOT NULL UNIQUE REFERENCES public.citas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nutriologo_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  puntuacion INTEGER NOT NULL CHECK (puntuacion >= 1 AND puntuacion <= 5),
  comentario TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Políticas de seguridad (RLS) para citas_ratings
ALTER TABLE public.citas_ratings ENABLE ROW LEVEL SECURITY;

-- Los clientes pueden leer y crear sus propias reseñas
CREATE POLICY "Clientes pueden ver sus reseñas" 
ON public.citas_ratings FOR SELECT 
USING (cliente_id = (SELECT id FROM public.clientes WHERE auth_id = auth.uid() LIMIT 1));

CREATE POLICY "Clientes pueden crear sus reseñas" 
ON public.citas_ratings FOR INSERT 
WITH CHECK (cliente_id = (SELECT id FROM public.clientes WHERE auth_id = auth.uid() LIMIT 1));

-- Los nutriólogos pueden ver reseñas hacia ellos
CREATE POLICY "Nutriologos pueden ver reseñas de ellos" 
ON public.citas_ratings FOR SELECT 
USING (nutriologo_id = auth.uid());

-- Lectura pública para el directorio (para que se pueda mostrar el rating general de alguna forma, opcional)
CREATE POLICY "Lectura pública de reseñas" 
ON public.citas_ratings FOR SELECT 
USING (true);

-- 4. Trigger para auto-calcular el promedio del nutriólogo al insertar una reseña
CREATE OR REPLACE FUNCTION update_nutriologo_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    rating = (
      SELECT ROUND(AVG(puntuacion)::numeric, 1) 
      FROM public.citas_ratings 
      WHERE nutriologo_id = NEW.nutriologo_id
    ),
    num_reviews = (
      SELECT COUNT(*) 
      FROM public.citas_ratings 
      WHERE nutriologo_id = NEW.nutriologo_id
    )
  WHERE id = NEW.nutriologo_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_rating ON public.citas_ratings;
CREATE TRIGGER trigger_update_rating
AFTER INSERT OR UPDATE ON public.citas_ratings
FOR EACH ROW
EXECUTE FUNCTION update_nutriologo_rating();
