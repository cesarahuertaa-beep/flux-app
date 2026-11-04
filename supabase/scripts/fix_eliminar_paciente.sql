-- ==============================================================
-- FLUX HEALTH SYSTEM: RPC DEFINITIVO DE ELIMINACIÓN DE USUARIOS
-- ==============================================================

-- 1. Eliminar paciente/atleta definitivo
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
    -- 1. Obtener email y auth_id del cliente antes de borrar su registro
    SELECT email, auth_id INTO v_email, v_auth_id FROM public.clientes WHERE id = p_cliente_id;
    
    -- Si se pasó p_auth_id explícitamente, tomarlo como prioritario
    IF p_auth_id IS NOT NULL THEN
        v_auth_id := p_auth_id;
    END IF;

    -- Si no teníamos email del cliente, intentar sacarlo del profile
    IF (v_email IS NULL OR v_email = '') AND v_auth_id IS NOT NULL THEN
        SELECT email INTO v_email FROM public.profiles WHERE id = v_auth_id;
    END IF;

    -- Si teníamos email pero no auth_id, buscar el id en profiles
    IF v_auth_id IS NULL AND v_email IS NOT NULL AND v_email <> '' THEN
        SELECT id INTO v_auth_id FROM public.profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email)) LIMIT 1;
    END IF;

    -- 2. Borrar citas y registros con clave foránea hacia este expediente de cliente
    DELETE FROM public.citas WHERE cliente_id = p_cliente_id;
    DELETE FROM public.metricas_progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.nutricion_progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.citas_ratings WHERE cliente_id = p_cliente_id;
    DELETE FROM public.recibos_pago_civil WHERE cliente_id = p_cliente_id;
    DELETE FROM public.ciclos WHERE cliente_id = p_cliente_id;
    DELETE FROM public.rutinas WHERE cliente_id = p_cliente_id;
    DELETE FROM public.nutricion WHERE cliente_id = p_cliente_id;

    -- 3. Borrar el registro del cliente
    DELETE FROM public.clientes WHERE id = p_cliente_id;

    -- 4. Verificar si el usuario conserva alguna otra cuenta activa (Independiente, otro consultorio o Especialista)
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

    -- 5. Si NO le queda ninguna otra cuenta ni rol profesional, eliminar por completo de profiles y auth.users
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

-- 2. Eliminar nutriólogo definitivo (y los expedientes clínicos de su consultorio)
CREATE OR REPLACE FUNCTION public.eliminar_nutriologo_definitivo(p_nutriologo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
    r_cliente RECORD;
BEGIN
    -- Obtener email del perfil antes de borrarlo
    SELECT email INTO v_email FROM public.profiles WHERE id = p_nutriologo_id;
    
    -- 1. Eliminar primero el perfil de "cliente sombra" del propio nutriólogo
    FOR r_cliente IN
        SELECT id FROM public.clientes
        WHERE auth_id = p_nutriologo_id
           OR (v_email IS NOT NULL AND v_email <> '' AND LOWER(TRIM(email)) = LOWER(TRIM(v_email)) AND (nutriologo_id = p_nutriologo_id OR nutriologo_id IS NULL OR objetivo = 'Mi entrenamiento personal'))
    LOOP
        UPDATE public.clientes SET auth_id = NULL, email = NULL WHERE id = r_cliente.id;
        PERFORM public.eliminar_paciente_definitivo(r_cliente.id, NULL);
    END LOOP;

    -- 2. Eliminar todos los expedientes de pacientes pertenecientes a este consultorio
    --    (eliminar_paciente_definitivo conserva automáticamente las cuentas independientes o de otros consultorios si el paciente las tiene)
    FOR r_cliente IN
        SELECT id, auth_id FROM public.clientes WHERE nutriologo_id = p_nutriologo_id
    LOOP
        PERFORM public.eliminar_paciente_definitivo(r_cliente.id, r_cliente.auth_id);
    END LOOP;
    
    -- 3. Borrar citas, disponibilidad y biblioteca personalizada del nutriólogo
    DELETE FROM public.citas WHERE nutriologo_id = p_nutriologo_id;
    DELETE FROM public.disponibilidad WHERE nutriologo_id = p_nutriologo_id;
    DELETE FROM public.biblioteca_ejercicios WHERE nutriologo_id = p_nutriologo_id;
    
    -- 4. Borrar recibos, patrocinios, notificaciones y solicitudes enviadas
    DELETE FROM public.recibos_pago WHERE nutriologo_id = p_nutriologo_id;
    DELETE FROM public.premium_patrocinado WHERE patrocinador_id = p_nutriologo_id;
    DELETE FROM public.notificaciones WHERE profile_id = p_nutriologo_id;
    DELETE FROM public.solicitudes_entrenamiento WHERE from_nutriologo_id = p_nutriologo_id;
    
    -- 5. Borrar cualquier solicitud profesional asociada a su correo (Cumplimiento Google Play)
    IF v_email IS NOT NULL AND v_email <> '' THEN
        DELETE FROM public.solicitudes_profesionales WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email));
        DELETE FROM public.solicitudes_entrenamiento WHERE LOWER(TRIM(to_email)) = LOWER(TRIM(v_email));
    END IF;
    
    -- 6. Borrar de profiles y auth.users
    DELETE FROM public.profiles WHERE id = p_nutriologo_id;
    DELETE FROM auth.users WHERE id = p_nutriologo_id;
END;
$$;

-- 3. Eliminar colaborador (staff / administrativo) definitivo
CREATE OR REPLACE FUNCTION public.eliminar_colaborador_definitivo(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
    v_has_real_clientes BOOLEAN := FALSE;
    r_shadow RECORD;
BEGIN
    SELECT email INTO v_email FROM public.profiles WHERE id = p_profile_id;

    -- Limpiar cualquier cliente sombra ("Mi entrenamiento personal") del colaborador
    FOR r_shadow IN
        SELECT id FROM public.clientes
        WHERE objetivo = 'Mi entrenamiento personal'
          AND (
            auth_id = p_profile_id
            OR (v_email IS NOT NULL AND v_email <> '' AND LOWER(TRIM(email)) = LOWER(TRIM(v_email)))
          )
    LOOP
        UPDATE public.clientes SET auth_id = NULL, email = NULL WHERE id = r_shadow.id;
        PERFORM public.eliminar_paciente_definitivo(r_shadow.id, NULL);
    END LOOP;

    -- Verificar si conserva alguna cuenta real de paciente o atleta independiente
    SELECT EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE COALESCE(c.objetivo, '') <> 'Mi entrenamiento personal'
          AND (
            c.auth_id = p_profile_id
            OR (v_email IS NOT NULL AND v_email <> '' AND LOWER(TRIM(c.email)) = LOWER(TRIM(v_email)))
          )
    ) INTO v_has_real_clientes;

    IF v_has_real_clientes THEN
        UPDATE public.profiles
        SET role = 'cliente', nutriologo_id = NULL, especialidad = NULL, activo = TRUE
        WHERE id = p_profile_id;
    ELSE
        DELETE FROM public.notificaciones WHERE profile_id = p_profile_id;
        IF v_email IS NOT NULL AND v_email <> '' THEN
            DELETE FROM public.solicitudes_profesionales WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email));
        END IF;
        DELETE FROM public.profiles WHERE id = p_profile_id;
        DELETE FROM auth.users WHERE id = p_profile_id;
    END IF;
END;
$$;
