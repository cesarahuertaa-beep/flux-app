-- ========================================================================================
-- FLUX HEALTH SYSTEM: SINCRONIZACIÓN UNIVERSAL DE PERFIL Y VINCULACIÓN MULTI-ROL AUTOMÁTICA
-- ========================================================================================
-- Este script resuelve de forma definitiva la propagación de datos personales (foto, nombre,
-- teléfono, fecha de nacimiento, género, país, estado) entre todos los roles asociados a un
-- único correo (Atleta civil, Paciente de consultorio, Nutriólogo, Staff administrativo).
-- ========================================================================================

-- 1. Actualizar política RLS de clientes para permitir actualización por correo verificado de Auth
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "clientes_update_policy" ON public.clientes;
END $$;

CREATE POLICY "clientes_update_policy"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
    auth_id = auth.uid()
    OR nutriologo_id = auth.uid()
    OR public.is_admin()
    OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email')))
)
WITH CHECK (
    auth_id = auth.uid()
    OR nutriologo_id = auth.uid()
    OR public.is_admin()
    OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email')))
);

-- 2. Función RPC para vincular automáticamente el auth_id de pacientes huérfanos
CREATE OR REPLACE FUNCTION public.vincular_auth_pacientes(
    p_auth_id UUID,
    p_email TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_email TEXT;
    v_auth_email TEXT;
    v_count INT := 0;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    v_auth_email := LOWER(TRIM(auth.jwt() ->> 'email'));

    -- Verificación de seguridad: el email debe coincidir con el usuario autenticado o ser superadmin
    IF v_auth_email IS NULL OR (v_clean_email <> v_auth_email AND NOT public.is_admin()) THEN
        RETURN 0;
    END IF;

    UPDATE public.clientes
    SET auth_id = p_auth_id
    WHERE LOWER(TRIM(email)) = v_clean_email
      AND (auth_id IS NULL OR auth_id <> p_auth_id);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 3. Función RPC atómica para sincronizar perfil en todas las identidades (profiles + clientes)
CREATE OR REPLACE FUNCTION public.sincronizar_perfil_universal(
    p_email TEXT,
    p_nombre TEXT DEFAULT NULL,
    p_telefono TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_fecha_nacimiento DATE DEFAULT NULL,
    p_genero TEXT DEFAULT NULL,
    p_pais TEXT DEFAULT NULL,
    p_estado_provincia TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_email TEXT;
    v_auth_email TEXT;
    v_auth_uid UUID;
    v_profiles_updated INT := 0;
    v_clientes_updated INT := 0;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    v_auth_email := LOWER(TRIM(auth.jwt() ->> 'email'));
    v_auth_uid := auth.uid();

    -- Verificación de seguridad
    IF v_auth_email IS NULL OR (v_clean_email <> v_auth_email AND NOT public.is_admin()) THEN
        RAISE EXCEPTION 'No autorizado para sincronizar este correo';
    END IF;

    -- A. Actualizar tabla profiles si existe perfil profesional o staff
    UPDATE public.profiles
    SET
        nombre = COALESCE(p_nombre, nombre),
        telefono = COALESCE(p_telefono, telefono),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        fecha_nacimiento = COALESCE(p_fecha_nacimiento, fecha_nacimiento),
        genero = COALESCE(p_genero, genero),
        pais = COALESCE(p_pais, pais),
        estado_provincia = COALESCE(p_estado_provincia, estado_provincia)
    WHERE LOWER(TRIM(email)) = v_clean_email OR id = v_auth_uid;
    GET DIAGNOSTICS v_profiles_updated = ROW_COUNT;

    -- B. Actualizar todas las filas en clientes (civil, paciente de consultorio, mi plan)
    --    y enlazar de inmediato su auth_id si no lo tenía.
    UPDATE public.clientes
    SET
        nombre = COALESCE(p_nombre, nombre),
        telefono = COALESCE(p_telefono, telefono),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        fecha_nacimiento = COALESCE(p_fecha_nacimiento, fecha_nacimiento),
        genero = COALESCE(p_genero, genero),
        pais = COALESCE(p_pais, pais),
        estado_provincia = COALESCE(p_estado_provincia, estado_provincia),
        auth_id = COALESCE(auth_id, v_auth_uid)
    WHERE LOWER(TRIM(email)) = v_clean_email OR (v_auth_uid IS NOT NULL AND auth_id = v_auth_uid);
    GET DIAGNOSTICS v_clientes_updated = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'profiles_updated', v_profiles_updated,
        'clientes_updated', v_clientes_updated
    );
END;
$$;
