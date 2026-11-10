-- ============================================================================
-- FLUX: Esquema Relacional para Alimentos Oficiales SMAE (5ª Ed.) y Platillos Estructurados
-- Respaldo relacional complementario al almacenamiento en la nube (Supabase Storage `logos` bucket:
-- `biblioteca_smae_alimentos_v2.json` y `biblioteca_platillos_smae_v2.json`).
-- ============================================================================

-- 1. Tabla Oficial de Alimentos Equivalentes SMAE (5ª Edición)
CREATE TABLE IF NOT EXISTS public.smae_alimentos (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  grupo_smae text NOT NULL,             -- verduras, frutas, cereales_sg, cereales_cg, leguminosas, aoa_mb, aoa_b, aoa_m, aoa_a, leche_d, leche_sd, leche_e, grasas_sp, grasas_cp, azucares_sg, libres
  cantidad_base numeric DEFAULT 1,
  unidad_base text DEFAULT 'g',
  gramos_base numeric DEFAULT 30,
  porcion_1eq text,
  tags_restriccion text[] DEFAULT '{}', -- lacteos, gluten, mariscos, carne_roja, nueces, animal_meat
  keywords text[] DEFAULT '{}',
  foto text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabla de Platillos Estructurados con Equivalentes SMAE
CREATE TABLE IF NOT EXISTS public.biblioteca_platillos (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  categoria text NOT NULL DEFAULT 'comida', -- desayuno, comida, cena, colacion
  texto text NOT NULL DEFAULT '',
  foto_url text DEFAULT '',
  smae_equivalentes jsonb DEFAULT '{}'::jsonb, -- Ej: {"aoa_mb": 4, "cereales_sg": 2, "verduras": 2, "grasas_sp": 1}
  tags_restriccion text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  calorias integer DEFAULT 0,
  proteina integer DEFAULT 0,
  carbohidratos integer DEFAULT 0,
  grasas integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_global boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.smae_alimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_platillos ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública para usuarios autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'smae_alimentos' AND policyname = 'Lectura global smae_alimentos'
  ) THEN
    CREATE POLICY "Lectura global smae_alimentos"
      ON public.smae_alimentos FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'biblioteca_platillos' AND policyname = 'Lectura global biblioteca_platillos'
  ) THEN
    CREATE POLICY "Lectura global biblioteca_platillos"
      ON public.biblioteca_platillos FOR SELECT
      USING (true);
  END IF;
END $$;
