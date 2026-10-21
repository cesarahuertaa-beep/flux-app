-- Tabla de configuracion de la plataforma (una sola fila)
CREATE TABLE IF NOT EXISTS public.configuracion_plataforma (
    id INTEGER PRIMARY KEY DEFAULT 1,
    clabe TEXT,
    banco TEXT,
    beneficiario TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc'', now())
);

-- Solo superadmins pueden leer y editar
ALTER TABLE public.configuracion_plataforma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden leer la config" ON public.configuracion_plataforma
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo superadmin puede editar config" ON public.configuracion_plataforma
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''superadmin'')
    );

-- Insertar fila inicial vacia
INSERT INTO public.configuracion_plataforma (id, clabe, banco, beneficiario)
VALUES (1, '', '', '')
ON CONFLICT (id) DO NOTHING;
