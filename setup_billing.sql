
-- Fase 2: Backend de Monetizacion y Cobros

-- 1. Agregar dia_corte a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dia_corte INTEGER;
-- Por defecto, a los nutriologos existentes se les pone el dia de su creacion (si es nulo)
UPDATE public.profiles SET dia_corte = EXTRACT(DAY FROM created_at) WHERE role = 'nutriologo' AND dia_corte IS NULL;

-- 2. Agregar deactivated_at a clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;

-- 3. Crear tabla recibos_pago
CREATE TABLE IF NOT EXISTS public.recibos_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nutriologo_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    monto NUMERIC NOT NULL,
    fecha_corte_mes DATE NOT NULL,
    comprobante_url TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para recibos_pago
ALTER TABLE public.recibos_pago ENABLE ROW LEVEL SECURITY;

CREATE POLICY " Nutriologos pueden ver sus propios recibos\ 
ON public.recibos_pago FOR SELECT 
USING (auth.uid() = nutriologo_id);

CREATE POLICY \Nutriologos pueden insertar sus recibos\ 
ON public.recibos_pago FOR INSERT 
WITH CHECK (auth.uid() = nutriologo_id);

CREATE POLICY \Admins pueden ver todos los recibos\ 
ON public.recibos_pago FOR ALL 
USING (
 EXISTS (
 SELECT 1 FROM public.profiles
 WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
 )
);

