-- ==============================================================
-- FLUX HEALTH SYSTEM: CORREGIR UNICIDAD Y BORRADO EN SOLICITUDES PROFESIONALES
-- ==============================================================
-- Ejecuta este script en el SQL Editor de tu panel de Supabase.
-- 1) Elimina la restricción UNIQUE global en email que bloqueaba re-solicitudes o cuentas eliminadas.
-- 2) Limpia solicitudes viejas ya aprobadas o rechazadas para liberar correos de prueba.
-- 3) Crea un índice condicional para que la unicidad SOLO aplique a solicitudes 'pendiente' (evita spam).
-- 4) Otorga políticas RLS para que usuarios y administradores puedan eliminar registros de solicitudes.
-- 5) Actualiza las funciones RPC de eliminación para garantizar cumplimiento con Google Play.

-- 1. Eliminar la restricción UNIQUE global si existe
ALTER TABLE public.solicitudes_profesionales DROP CONSTRAINT IF EXISTS solicitudes_profesionales_email_key;

-- 2. Limpiar registros históricos ya aprobados o rechazados
DELETE FROM public.solicitudes_profesionales WHERE estado IN ('aprobada', 'rechazada');

-- 3. Crear índice único condicional: SOLO impide duplicados cuando la solicitud está 'pendiente'
DROP INDEX IF EXISTS solicitudes_profesionales_email_pendiente_idx;
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_profesionales_email_pendiente_idx 
ON public.solicitudes_profesionales (LOWER(TRIM(email))) 
WHERE estado = 'pendiente';

-- 4. Asegurar política RLS para que los usuarios autenticados puedan borrar sus propias solicitudes al darse de baja
DROP POLICY IF EXISTS "Usuarios pueden eliminar su propia solicitud" ON public.solicitudes_profesionales;
CREATE POLICY "Usuarios pueden eliminar su propia solicitud" ON public.solicitudes_profesionales
    FOR DELETE TO authenticated
    USING (
        LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role = 'admin' OR profiles.role = 'superadmin' OR profiles.role = 'staff')
        )
    );

-- 5. Actualizar la función de eliminación definitiva de nutriólogos
CREATE OR REPLACE FUNCTION public.eliminar_nutriologo_definitivo(p_nutriologo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
BEGIN
    -- Obtener email del perfil antes de borrarlo
    SELECT email INTO v_email FROM public.profiles WHERE id = p_nutriologo_id;
    
    -- Desvincular clientes asignados
    UPDATE public.clientes SET nutriologo_id = NULL WHERE nutriologo_id = p_nutriologo_id;
    
    -- Borrar citas y disponibilidad
    DELETE FROM public.citas WHERE nutriologo_id = p_nutriologo_id;
    DELETE FROM public.disponibilidad WHERE nutriologo_id = p_nutriologo_id;
    
    -- Borrar recibos y patrocinios
    DELETE FROM public.recibos_pago WHERE nutriologo_id = p_nutriologo_id;
    DELETE FROM public.premium_patrocinado WHERE patrocinador_id = p_nutriologo_id;
    
    -- Borrar cualquier solicitud profesional asociada a su correo (Cumplimiento Google Play)
    IF v_email IS NOT NULL AND v_email <> '' THEN
        DELETE FROM public.solicitudes_profesionales WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email));
    END IF;
    
    -- Borrar de profiles
    DELETE FROM public.profiles WHERE id = p_nutriologo_id;
    
    -- Borrar usuario de auth.users
    DELETE FROM auth.users WHERE id = p_nutriologo_id;
END;
$$;

-- 6. Actualizar la función de eliminación definitiva de pacientes
CREATE OR REPLACE FUNCTION public.eliminar_paciente_definitivo(p_cliente_id UUID, p_auth_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
BEGIN
    -- Obtener email del cliente o perfil antes de borrar
    SELECT email INTO v_email FROM public.clientes WHERE id = p_cliente_id;
    IF v_email IS NULL AND p_auth_id IS NOT NULL THEN
        SELECT email INTO v_email FROM public.profiles WHERE id = p_auth_id;
    END IF;

    -- Borrar mediciones, progreso y notas
    DELETE FROM public.metricas_progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.fotos_progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.notas_nutriologo WHERE cliente_id = p_cliente_id;
    DELETE FROM public.citas WHERE cliente_id = p_cliente_id;

    -- Borrar registro en clientes
    DELETE FROM public.clientes WHERE id = p_cliente_id;

    -- Si cuenta con auth_id, borrar profile y auth.users
    IF p_auth_id IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id = p_auth_id;
        DELETE FROM auth.users WHERE id = p_auth_id;
    END IF;

    -- Borrar cualquier solicitud profesional asociada a su correo (Cumplimiento Google Play)
    IF v_email IS NOT NULL AND v_email <> '' THEN
        DELETE FROM public.solicitudes_profesionales WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email));
    END IF;
END;
$$;
