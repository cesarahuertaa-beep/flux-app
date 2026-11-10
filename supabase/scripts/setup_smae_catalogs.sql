-- ============================================================================
-- FLUX · Catálogos SMAE en Supabase (fuente única de verdad)
--   · public.smae_alimentos        → alimentos equivalentes (SMAE 5ª ed.)
--   · public.biblioteca_platillos  → platillos con equivalentes SMAE estructurados
--
-- ORDEN DE EJECUCIÓN (SQL Editor de Supabase, uno tras otro):
--   1) este archivo (setup_smae_catalogs.sql)
--   2) supabase/scripts/seed_smae_alimentos.sql
--   3) supabase/scripts/seed_smae_platillos.sql
-- Es idempotente: se puede volver a correr sin perder datos.
-- ============================================================================

-- Función de rol (misma definición que fix_rls_recursion.sql; SECURITY DEFINER evita recursión RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 1. Alimentos SMAE ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.smae_alimentos (
  id               text PRIMARY KEY,
  nombre           text NOT NULL,
  grupo_smae       text NOT NULL,                 -- ver los 16 ids oficiales en src/lib/smaeData.js
  cantidad_base    numeric NOT NULL DEFAULT 1,
  unidad_base      text    NOT NULL DEFAULT 'g',
  gramos_base      numeric NOT NULL DEFAULT 30,
  porcion_1eq      text,
  tags_restriccion text[]  NOT NULL DEFAULT '{}', -- lacteos, gluten, mariscos, carne_roja, nueces, animal_meat
  keywords         text[]  NOT NULL DEFAULT '{}',
  foto             text    NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smae_alimentos_grupo_chk CHECK (grupo_smae IN (
    'verduras','frutas','cereales_sg','cereales_cg','leguminosas',
    'aoa_mb','aoa_b','aoa_m','aoa_a','leche_d','leche_sd','leche_e',
    'grasas_sp','grasas_cp','azucares_sg','libres'))
);
CREATE INDEX IF NOT EXISTS smae_alimentos_grupo_idx ON public.smae_alimentos (grupo_smae);

-- 2. Platillos ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.biblioteca_platillos (
  id                text PRIMARY KEY,
  nombre            text NOT NULL,
  categoria         text NOT NULL DEFAULT 'comida',   -- desayuno | comida | cena | colacion
  texto             text NOT NULL DEFAULT '',
  foto_url          text NOT NULL DEFAULT '',
  smae_equivalentes jsonb NOT NULL DEFAULT '{}'::jsonb, -- {"aoa_mb":4,"cereales_sg":2,...}
  tags_restriccion  text[] NOT NULL DEFAULT '{}',
  keywords          text[] NOT NULL DEFAULT '{}',
  calorias          integer NOT NULL DEFAULT 0,
  proteina          integer NOT NULL DEFAULT 0,
  carbohidratos     integer NOT NULL DEFAULT 0,
  grasas            integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 3. Seguridad (RLS) ----------------------------------------------------------
ALTER TABLE public.smae_alimentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_platillos ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado. Escritura: solo superadmin (igual que la UI de Biblioteca).
DROP POLICY IF EXISTS "smae_alimentos_select"  ON public.smae_alimentos;
DROP POLICY IF EXISTS "smae_alimentos_insert"  ON public.smae_alimentos;
DROP POLICY IF EXISTS "smae_alimentos_update"  ON public.smae_alimentos;
DROP POLICY IF EXISTS "smae_alimentos_delete"  ON public.smae_alimentos;
DROP POLICY IF EXISTS "Lectura global smae_alimentos" ON public.smae_alimentos;

CREATE POLICY "smae_alimentos_select" ON public.smae_alimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "smae_alimentos_insert" ON public.smae_alimentos FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "smae_alimentos_update" ON public.smae_alimentos FOR UPDATE TO authenticated USING (public.get_my_role() = 'superadmin') WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "smae_alimentos_delete" ON public.smae_alimentos FOR DELETE TO authenticated USING (public.get_my_role() = 'superadmin');

DROP POLICY IF EXISTS "biblioteca_platillos_select" ON public.biblioteca_platillos;
DROP POLICY IF EXISTS "biblioteca_platillos_insert" ON public.biblioteca_platillos;
DROP POLICY IF EXISTS "biblioteca_platillos_update" ON public.biblioteca_platillos;
DROP POLICY IF EXISTS "biblioteca_platillos_delete" ON public.biblioteca_platillos;
DROP POLICY IF EXISTS "Lectura global biblioteca_platillos" ON public.biblioteca_platillos;

CREATE POLICY "biblioteca_platillos_select" ON public.biblioteca_platillos FOR SELECT TO authenticated USING (true);
CREATE POLICY "biblioteca_platillos_insert" ON public.biblioteca_platillos FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "biblioteca_platillos_update" ON public.biblioteca_platillos FOR UPDATE TO authenticated USING (public.get_my_role() = 'superadmin') WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "biblioteca_platillos_delete" ON public.biblioteca_platillos FOR DELETE TO authenticated USING (public.get_my_role() = 'superadmin');

-- 4. Limpieza del esquema anterior (archivos JSON en Storage). Opcional, no afecta a la app nueva.
--    Si quieres borrar los JSON viejos: Storage → bucket "logos" → eliminar
--    biblioteca_ingredientes.json, biblioteca_platillos.json,
--    biblioteca_smae_alimentos_v2.json, biblioteca_platillos_smae_v2.json
