-- Script para crear la tabla de control de nóminas (Firma de colaboradores)
CREATE TABLE IF NOT EXISTS nomina_colaboradores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_nombre TEXT NOT NULL,
  mes_facturacion TEXT NOT NULL, -- Formato 'YYYY-MM'
  monto NUMERIC NOT NULL DEFAULT 0,
  transferido_por_admin BOOLEAN DEFAULT false,
  confirmado_por_colaborador BOOLEAN DEFAULT false,
  fecha_confirmacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(colaborador_nombre, mes_facturacion)
);

-- Políticas RLS (Row Level Security)
ALTER TABLE nomina_colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura general a autenticados" 
ON nomina_colaboradores FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir modificacion a todos los autenticados" 
ON nomina_colaboradores FOR ALL
TO authenticated 
USING (true)
WITH CHECK (true);
