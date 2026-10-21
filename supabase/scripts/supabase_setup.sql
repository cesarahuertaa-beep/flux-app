-- ==============================================================
-- FLUX HEALTH SYSTEM: MIGRACIÓN FASE COMERCIAL (LANDING & TIENDA)
-- ==============================================================
-- Instrucciones: Copia y pega todo este código en el SQL Editor de tu panel de Supabase y ejecútalo.

-- 1. CREACIÓN DE TABLA: PRODUCTOS (Para la Tienda Oficial)
CREATE TABLE IF NOT EXISTS public.productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    subtitulo TEXT,
    precio NUMERIC NOT NULL DEFAULT 0.00,
    rating NUMERIC DEFAULT 5.0,
    num_reviews INTEGER DEFAULT 0,
    categoria TEXT NOT NULL, -- ej. 'suplemento', 'ropa', 'equipo'
    variantes JSONB DEFAULT '[]'::jsonb, -- ej. ["S", "M", "L"] o ["Vainilla", "Chocolate"]
    imagen_url TEXT,
    badge TEXT, -- ej. 'Bestseller', 'Nuevo'
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Seguridad) para productos
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden VER los productos activos
CREATE POLICY "Productos visibles para todos" ON public.productos
    FOR SELECT USING (activo = true);

-- Política: Solo administradores (y superadmin) pueden editar productos
CREATE POLICY "Admins pueden editar productos" ON public.productos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
        )
    );

-- 2. AMPLIAR TABLA: PROFILES (Para el Directorio Médico y Mapa)
-- Añadimos las columnas necesarias para el directorio público interactivo.
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS especialidad TEXT,
    ADD COLUMN IF NOT EXISTS ubicacion_texto TEXT,
    ADD COLUMN IF NOT EXISTS pin_top TEXT, -- Posición Y en el mapa (ej. "28%")
    ADD COLUMN IF NOT EXISTS pin_left TEXT, -- Posición X en el mapa (ej. "38%")
    ADD COLUMN IF NOT EXISTS verificado BOOLEAN DEFAULT false;

-- ==============================================================
-- 3. DATOS DE EJEMPLO (Opcional - Quítalos si no los quieres)
-- Insertar algunos productos de ejemplo para que la tienda no se vea vacía.
INSERT INTO public.productos (nombre, subtitulo, precio, rating, num_reviews, categoria, variantes, badge)
VALUES 
('Proteína Whey Flux', 'Aislada + Concentrada', 899, 4.9, 218, 'suplemento', '["Chocolate", "Vainilla", "Fresa"]'::jsonb, 'Más vendido'),
('Creatina Monohidratada', 'Fuerza y recuperación', 449, 4.8, 143, 'suplemento', '["Sin sabor"]'::jsonb, 'Nuevo'),
('Playera Compression Pro', 'Tejido técnico anti-sudor', 699, 4.9, 132, 'ropa', '["S","M","L","XL"]'::jsonb, null),
('Leggings Performance', 'Compresión graduada', 799, 4.8, 164, 'ropa', '["XS","S","M","L","XL"]'::jsonb, null)
ON CONFLICT DO NOTHING;

-- Notifica "Success" si todo sale bien.
