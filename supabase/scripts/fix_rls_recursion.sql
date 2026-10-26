-- ==============================================================
-- FLUX HEALTH SYSTEM: CORRECCIÓN DEFINITIVA DE RECURSIÓN RLS (ERROR 54001)
-- ==============================================================
-- Este script soluciona el error "stack depth limit exceeded" (código 54001)
-- causado por políticas RLS circulares en public.profiles y public.clientes.
-- Instrucciones: Ejecuta este script en el SQL Editor de tu panel de Supabase.

-- 1. FUNCIONES AUXILIARES SECURITY DEFINER (No disparan RLS al evaluarse)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('superadmin', 'staff', 'admin')
  );
$$;

-- 2. LIMPIEZA DE POLÍTICAS EN PROFILES (Eliminar las que causan bucles infinitos)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. POLÍTICAS LIMPIAS Y NO RECURSIVAS EN PROFILES
-- Lectura: Libre para todos (el directorio de especialistas y la UI necesitan leer perfiles)
CREATE POLICY "profiles_select_all"
ON public.profiles
FOR SELECT
USING (true);

-- Actualización: Cada usuario puede actualizar su propio perfil
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Inserción: Usuarios autenticados o superadmins
CREATE POLICY "profiles_insert_own_or_admin"
ON public.profiles
FOR INSERT
TO authenticated, anon
WITH CHECK (id = auth.uid() OR public.is_admin() OR auth.uid() IS NULL);

-- Gestión total: Solo administradores
CREATE POLICY "profiles_all_admin"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. LIMPIEZA Y HOMOLOGACIÓN DE POLÍTICAS EN CLIENTES
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'clientes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clientes', pol.policyname);
  END LOOP;
END $$;

-- Lectura de clientes: Paciente ve el suyo, especialista ve sus pacientes, admin ve todos
CREATE POLICY "clientes_select_policy"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  auth_id = auth.uid()
  OR nutriologo_id = auth.uid()
  OR public.is_admin()
);

-- Inserción de clientes:
CREATE POLICY "clientes_insert_policy"
ON public.clientes
FOR INSERT
TO authenticated, anon
WITH CHECK (
  auth_id = auth.uid()
  OR nutriologo_id = auth.uid()
  OR public.is_admin()
  OR auth.uid() IS NULL
);

-- Actualización de clientes:
CREATE POLICY "clientes_update_policy"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  auth_id = auth.uid()
  OR nutriologo_id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  auth_id = auth.uid()
  OR nutriologo_id = auth.uid()
  OR public.is_admin()
);

-- Eliminación de clientes:
CREATE POLICY "clientes_delete_policy"
ON public.clientes
FOR DELETE
TO authenticated
USING (
  auth_id = auth.uid()
  OR nutriologo_id = auth.uid()
  OR public.is_admin()
);

-- 5. RECARGAR CACHÉ DE POSTGREST
NOTIFY pgrst, 'reload schema';
