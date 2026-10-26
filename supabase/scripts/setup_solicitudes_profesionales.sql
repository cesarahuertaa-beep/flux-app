-- ==============================================================
-- FLUX HEALTH SYSTEM: HABILITAR SOLICITUDES DE REGISTRO PROFESIONAL
-- ==============================================================
-- Copia y pega este script en el SQL Editor de tu panel de Supabase y ejecútalo.
-- Permite que los nuevos nutriólogos y estudiantes puedan enviar su solicitud
-- de registro directamente desde la pantalla de Login sin errores de RLS.

CREATE TABLE IF NOT EXISTS public.solicitudes_profesionales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'nutriologo' | 'nutriologo_estudiante'
    cedula TEXT,
    nombre_marca TEXT,
    mapa_url TEXT,
    documentacion_url TEXT,
    estado TEXT DEFAULT 'pendiente', -- 'pendiente' | 'aprobada' | 'rechazada'
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.solicitudes_profesionales ENABLE ROW LEVEL SECURITY;

-- 1. Permitir que usuarios anónimos (público general sin login) puedan insertar su solicitud
DROP POLICY IF EXISTS "Cualquiera puede enviar solicitud profesional" ON public.solicitudes_profesionales;
CREATE POLICY "Cualquiera puede enviar solicitud profesional" ON public.solicitudes_profesionales
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- 2. Permitir que superadmin y staff puedan leer todas las solicitudes
DROP POLICY IF EXISTS "Admins pueden ver solicitudes profesionales" ON public.solicitudes_profesionales;
CREATE POLICY "Admins pueden ver solicitudes profesionales" ON public.solicitudes_profesionales
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'admin' OR profiles.role = 'superadmin' OR profiles.role = 'staff')
        )
    );

-- 3. Permitir que superadmin y staff puedan actualizar estado (aprobar/rechazar)
DROP POLICY IF EXISTS "Admins pueden actualizar solicitudes profesionales" ON public.solicitudes_profesionales;
CREATE POLICY "Admins pueden actualizar solicitudes profesionales" ON public.solicitudes_profesionales
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'admin' OR profiles.role = 'superadmin' OR profiles.role = 'staff')
        )
    );

-- 4. Permitir que superadmin y staff puedan eliminar solicitudes
DROP POLICY IF EXISTS "Admins pueden eliminar solicitudes profesionales" ON public.solicitudes_profesionales;
CREATE POLICY "Admins pueden eliminar solicitudes profesionales" ON public.solicitudes_profesionales
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'admin' OR profiles.role = 'superadmin' OR profiles.role = 'staff')
        )
    );
