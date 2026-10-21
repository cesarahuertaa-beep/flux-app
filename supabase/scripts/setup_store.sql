-- Crear tabla de productos para el e-commerce
CREATE TABLE IF NOT EXISTS public.productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  subtitulo TEXT,
  precio NUMERIC NOT NULL,
  rating NUMERIC DEFAULT 5.0,
  num_reviews INTEGER DEFAULT 0,
  categoria TEXT NOT NULL CHECK (categoria IN ('suplemento', 'ropa')),
  variantes JSONB DEFAULT '[]'::jsonb,
  imagen_url TEXT,
  badge TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública
CREATE POLICY "Lectura pública de productos" 
ON public.productos FOR SELECT 
USING (activo = true);

-- Políticas de escritura solo para administradores (asumiendo que admin/superadmin pueden editar)
CREATE POLICY "Admins pueden crear productos" 
ON public.productos FOR INSERT 
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
);

CREATE POLICY "Admins pueden actualizar productos" 
ON public.productos FOR UPDATE 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
);

CREATE POLICY "Admins pueden eliminar productos" 
ON public.productos FOR DELETE 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
);

-- Y también necesitamos asegurarnos de que la tabla de perfiles tenga permisos de insert para los nuevos usuarios,
-- pero eso ya debería estar configurado.
