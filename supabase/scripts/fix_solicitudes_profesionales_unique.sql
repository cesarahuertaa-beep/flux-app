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

-- 5. Actualizar la función de eliminación definitiva de pacientes
CREATE OR REPLACE FUNCTION public.eliminar_paciente_definitivo(p_cliente_id UUID, p_auth_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
    v_auth_id UUID;
    v_has_other_clientes BOOLEAN := FALSE;
    v_has_pro_role BOOLEAN := FALSE;
BEGIN
    SELECT email, auth_id INTO v_email, v_auth_id FROM public.clientes WHERE id = p_cliente_id;
    
    IF p_auth_id IS NOT NULL THEN
        v_auth_id := p_auth_id;
    END IF;

    IF (v_email IS NULL OR v_email = '') AND v_auth_id IS NOT NULL THEN
        SELECT email INTO v_email FROM public.profiles WHERE id = v_auth_id;
    END IF;

    IF v_auth_id IS NULL AND v_email IS NOT NULL AND v_email <> '' THEN
        SELECT id INTO v_auth_id FROM public.profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email)) LIMIT 1;
    END IF;

    DELETE FROM public.citas WHERE cliente_id = p_cliente_id;
    DELETE FROM public.metricas_progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.nutricion_progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.citas_ratings WHERE cliente_id = p_cliente_id;
    DELETE FROM public.recibos_pago_civil WHERE cliente_id = p_cliente_id;
    DELETE FROM public.ciclos WHERE cliente_id = p_cliente_id;
    DELETE FROM public.rutinas WHERE cliente_id = p_cliente_id;
    DELETE FROM public.nutricion WHERE cliente_id = p_cliente_id;

    DELETE FROM public.clientes WHERE id = p_cliente_id;

    IF v_auth_id IS NOT NULL OR (v_email IS NOT NULL AND v_email <> '') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.clientes c
            WHERE c.id <> p_cliente_id
              AND COALESCE(c.objetivo, '') <> 'Mi entrenamiento personal'
              AND (
                (v_auth_id IS NOT NULL AND c.auth_id = v_auth_id)
                OR (v_email IS NOT NULL AND v_email <> '' AND LOWER(TRIM(c.email)) = LOWER(TRIM(v_email)))
              )
        ) INTO v_has_other_clientes;

        SELECT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.role IN ('superadmin', 'staff', 'nutriologo', 'nutriologo_estudiante', 'administrativo')
              AND (
                (v_auth_id IS NOT NULL AND p.id = v_auth_id)
                OR (v_email IS NOT NULL AND v_email <> '' AND LOWER(TRIM(p.email)) = LOWER(TRIM(v_email)))
              )
        ) INTO v_has_pro_role;
    END IF;

    IF NOT v_has_other_clientes AND NOT v_has_pro_role THEN
        IF v_auth_id IS NOT NULL THEN
            DELETE FROM public.notificaciones WHERE profile_id = v_auth_id;
            DELETE FROM public.profiles WHERE id = v_auth_id;
            DELETE FROM auth.users WHERE id = v_auth_id;
        END IF;

        IF v_email IS NOT NULL AND v_email <> '' THEN
            DELETE FROM public.profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email)) AND role = 'cliente';
            DELETE FROM public.solicitudes_profesionales WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email));
            DELETE FROM public.solicitudes_entrenamiento WHERE LOWER(TRIM(to_email)) = LOWER(TRIM(v_email));
        END IF;
    END IF;
END;
$$;

-- 6. Actualizar la función de eliminación definitiva de nutriólogos
CREATE OR REPLACE FUNCTION public.eliminar_nutriologo_definitivo(p_nutriologo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
    r_cliente RECORD;
BEGIN
    SELECT email INTO v_email FROM public.profiles WHERE id = p_nutriologo_id;
    
    FOR r_cliente IN
        SELECT id FROM public.clientes
        WHERE auth_id = p_nutriologo_id
           OR (v_email IS NOT NULL AND v_email <> '' AND LOWER(TRIM(email)) = LOWER(TRIM(v_email)) AND (nutriologo_id = p_nutriologo_id OR nutriologo_id IS NULL OR objetivo = 'Mi entrenamiento personal'))
    LOOP
        UPDATE public.clientes SET auth_id = NULL, email = NULL WHERE id = r_cliente.id;
        PERFORM public.eliminar_paciente_definitivo(r_cliente.id, NULL);
    END LOOP;

    FOR r_cliente IN
        SELECT id, auth_id FROM public.clientes WHERE nutriologo_id = p_nutriologo_id
    LOOP
        PERFORM public.eliminar_paciente_definitivo(r_cliente.id, r_cliente.auth_id);
    END LOOP;
    
    DELETE FROM public.citas WHERE nutriologo_id = p_nutriologo_id;
    DELETE FROM public.disponibilidad WHERE nutriologo_id = p_nutriologo_id;
    DELETE FROM public.biblioteca_ejercicios WHERE nutriologo_id = p_nutriologo_id;
    
    DELETE FROM public.recibos_pago WHERE nutriologo_id = p_nutriologo_id;
    DELETE FROM public.premium_patrocinado WHERE patrocinador_id = p_nutriologo_id;
    DELETE FROM public.notificaciones WHERE profile_id = p_nutriologo_id;
    DELETE FROM public.solicitudes_entrenamiento WHERE from_nutriologo_id = p_nutriologo_id;
    
    IF v_email IS NOT NULL AND v_email <> '' THEN
        DELETE FROM public.solicitudes_profesionales WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email));
        DELETE FROM public.solicitudes_entrenamiento WHERE LOWER(TRIM(to_email)) = LOWER(TRIM(v_email));
    END IF;
    
    DELETE FROM public.profiles WHERE id = p_nutriologo_id;
    DELETE FROM auth.users WHERE id = p_nutriologo_id;
END;
$$;
