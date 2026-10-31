-- ==============================================================
-- FLUX HEALTH SYSTEM: CORREGIR RPC eliminar_paciente_definitivo
-- ==============================================================
-- Elimina la referencia errónea a la tabla inexistente 'fotos_progreso'
-- que provocaba el error 42P01 ("relation public.fotos_progreso does not exist").
-- Además, garantiza que si no se proporciona p_auth_id, se busque automáticamente
-- en la tabla clientes para borrar la cuenta de auth.users y profiles.

CREATE OR REPLACE FUNCTION public.eliminar_paciente_definitivo(p_cliente_id UUID, p_auth_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
    v_auth_id UUID;
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

    -- 2. Borrar métricas y registros de progreso de entrenamiento y nutrición
    DELETE FROM public.metricas_progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.nutricion_progreso WHERE cliente_id = p_cliente_id;
    DELETE FROM public.notas_nutriologo WHERE cliente_id = p_cliente_id;
    DELETE FROM public.citas WHERE cliente_id = p_cliente_id;

    -- 3. Borrar planes asignados o personalizados del atleta
    DELETE FROM public.ciclos WHERE cliente_id = p_cliente_id;
    DELETE FROM public.rutinas WHERE cliente_id = p_cliente_id;
    DELETE FROM public.nutricion WHERE cliente_id = p_cliente_id;

    -- 4. Borrar recibos de pago si es atleta civil (ignorar si la tabla no existe)
    BEGIN
        DELETE FROM public.recibos_pago_civil WHERE cliente_id = p_cliente_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- 5. Borrar el registro del cliente
    DELETE FROM public.clientes WHERE id = p_cliente_id;

    -- 6. Si cuenta con auth_id, borrar su perfil y cuenta en auth.users
    IF v_auth_id IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id = v_auth_id;
        DELETE FROM auth.users WHERE id = v_auth_id;
    END IF;

    -- 7. Borrar cualquier solicitud profesional asociada a su correo (Cumplimiento Google Play)
    IF v_email IS NOT NULL AND v_email <> '' THEN
        DELETE FROM public.solicitudes_profesionales WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email));
    END IF;
END;
$$;
