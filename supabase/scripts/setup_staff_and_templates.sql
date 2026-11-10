-- ============================================================================
-- FLUX · Arquitectura de Base de Datos para Staff, Compensaciones y Plantillas
-- Tablas:
--   1. public.staff_roles          → Catálogo de roles corporativos y permisos de módulos
--   2. public.staff_compensaciones  → Esquema de sueldos, comisiones y datos bancarios
--   3. public.plantillas            → Plantillas de dietas y rutinas por nutriólogo
-- ============================================================================

-- Función auxiliar de rol para RLS seguro (SECURITY DEFINER evita recursión)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 1. TABLA: STAFF_ROLES ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id           text PRIMARY KEY,
  nombre       text NOT NULL,
  departamento text NOT NULL DEFAULT 'Operaciones',
  descripcion  text NOT NULL DEFAULT '',
  modulos      text[] NOT NULL DEFAULT '{}', -- clientes, agenda, equipo, aprobaciones, biblioteca, tienda, pagos, etc.
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_roles_select" ON public.staff_roles;
DROP POLICY IF EXISTS "staff_roles_insert" ON public.staff_roles;
DROP POLICY IF EXISTS "staff_roles_update" ON public.staff_roles;
DROP POLICY IF EXISTS "staff_roles_delete" ON public.staff_roles;

-- Lectura: Cualquier usuario autenticado (para que los miembros del staff consulten sus permisos desde cualquier dispositivo)
CREATE POLICY "staff_roles_select" ON public.staff_roles FOR SELECT TO authenticated USING (true);

-- Escritura: Solo superadmin
CREATE POLICY "staff_roles_insert" ON public.staff_roles FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "staff_roles_update" ON public.staff_roles FOR UPDATE TO authenticated USING (public.get_my_role() = 'superadmin') WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "staff_roles_delete" ON public.staff_roles FOR DELETE TO authenticated USING (public.get_my_role() = 'superadmin');

-- Insertar roles corporativos oficiales de FLUX iniciales
INSERT INTO public.staff_roles (id, nombre, departamento, descripcion, modulos, activo)
VALUES 
  (
    'staff_general',
    'Staff Corporativo (General)',
    'Operaciones',
    'Acceso estándar a operaciones diarias, directorio general, biblioteca y tienda.',
    ARRAY['clientes', 'aprobaciones', 'biblioteca', 'tienda'],
    true
  ),
  (
    'staff_ventas',
    'Ventas y Afiliaciones',
    'Comercial',
    'Enfocado en prospección, seguimiento comercial de nuevos prospectos y liquidación en tienda.',
    ARRAY['clientes', 'tienda', 'pagos'],
    true
  ),
  (
    'staff_finanzas',
    'Finanzas y Liquidaciones',
    'Administración',
    'Acceso contable a nóminas, liquidaciones de comisiones y control de ingresos.',
    ARRAY['pagos', 'equipo', 'tienda'],
    true
  ),
  (
    'staff_marketing',
    'Marketing y Catálogo',
    'Marketing',
    'Gestión visual del catálogo de movimientos, recetas, alimentos y productos de tienda.',
    ARRAY['biblioteca', 'tienda', 'clientes'],
    true
  ),
  (
    'staff_soporte',
    'Soporte y Operaciones',
    'Atención a Usuarios',
    'Atención de incidencias operativas, directorio, agenda y validación de solicitudes.',
    ARRAY['clientes', 'agenda', 'aprobaciones', 'biblioteca'],
    true
  )
ON CONFLICT (id) DO NOTHING;


-- 2. TABLA: STAFF_COMPENSACIONES ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_compensaciones (
  colaborador_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  modalidad      text NOT NULL DEFAULT 'solo_comision', -- solo_comision | sueldo_fijo | mixto | honorarios
  sueldo_base    numeric NOT NULL DEFAULT 0,
  comision_pct   numeric NOT NULL DEFAULT 32,
  bono_fijo      numeric NOT NULL DEFAULT 0,
  banco          text NOT NULL DEFAULT '',
  clabe          text NOT NULL DEFAULT '',
  titular        text NOT NULL DEFAULT '',
  notas          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.staff_compensaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_compensaciones_select" ON public.staff_compensaciones;
DROP POLICY IF EXISTS "staff_compensaciones_insert" ON public.staff_compensaciones;
DROP POLICY IF EXISTS "staff_compensaciones_update" ON public.staff_compensaciones;
DROP POLICY IF EXISTS "staff_compensaciones_delete" ON public.staff_compensaciones;

-- Lectura: El superadmin puede ver todas; el propio colaborador puede ver su ficha financiera
CREATE POLICY "staff_compensaciones_select" ON public.staff_compensaciones 
FOR SELECT TO authenticated 
USING (
  public.get_my_role() = 'superadmin' OR colaborador_id = auth.uid()
);

-- Escritura: Solo superadmin
CREATE POLICY "staff_compensaciones_insert" ON public.staff_compensaciones FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "staff_compensaciones_update" ON public.staff_compensaciones FOR UPDATE TO authenticated USING (public.get_my_role() = 'superadmin') WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "staff_compensaciones_delete" ON public.staff_compensaciones FOR DELETE TO authenticated USING (public.get_my_role() = 'superadmin');


-- 3. TABLA: PLANTILLAS (Nutrición y Rutinas) ---------------------------------
CREATE TABLE IF NOT EXISTS public.plantillas (
  id          text PRIMARY KEY,
  creador_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('nutri', 'rutina')),
  nombre      text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  datos       jsonb NOT NULL DEFAULT '{}'::jsonb, -- Días estructurados con comidas, SMAE o ejercicios
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plantillas_creador_tipo_idx ON public.plantillas(creador_id, tipo);

-- Habilitar RLS
ALTER TABLE public.plantillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plantillas_select" ON public.plantillas;
DROP POLICY IF EXISTS "plantillas_insert" ON public.plantillas;
DROP POLICY IF EXISTS "plantillas_update" ON public.plantillas;
DROP POLICY IF EXISTS "plantillas_delete" ON public.plantillas;

-- Lectura: El creador de la plantilla o el superadmin
CREATE POLICY "plantillas_select" ON public.plantillas 
FOR SELECT TO authenticated 
USING (
  creador_id = auth.uid() OR public.get_my_role() = 'superadmin'
);

-- Escritura: El creador de la plantilla o el superadmin
CREATE POLICY "plantillas_insert" ON public.plantillas 
FOR INSERT TO authenticated 
WITH CHECK (
  creador_id = auth.uid() OR public.get_my_role() = 'superadmin'
);

CREATE POLICY "plantillas_update" ON public.plantillas 
FOR UPDATE TO authenticated 
USING (
  creador_id = auth.uid() OR public.get_my_role() = 'superadmin'
) WITH CHECK (
  creador_id = auth.uid() OR public.get_my_role() = 'superadmin'
);

CREATE POLICY "plantillas_delete" ON public.plantillas 
FOR DELETE TO authenticated 
USING (
  creador_id = auth.uid() OR public.get_my_role() = 'superadmin'
);

-- 4. EXPEDIENTE CLÍNICO NATIVO EN CLIENTES ------------------------------------
-- Permite que la historia clínica, anamnesis y check-ins queden respaldados
-- directamente en el registro relacional del paciente en PostgreSQL.
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS expediente_clinico jsonb DEFAULT NULL;

-- 5. CONFIGURACIÓN DE LANDING Y TIENDA EN BASE DE DATOS -----------------------
-- Números de ventas, WhatsApp de soporte, enlaces de redes y tienda oficial
ALTER TABLE public.configuracion_plataforma ADD COLUMN IF NOT EXISTS landing_config jsonb DEFAULT NULL;


