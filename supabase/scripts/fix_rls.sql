
-- Permitir subida de archivos a los buckets
CREATE POLICY " Permitir subida a buckets\ ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('comidas', 'comprobantes'));
CREATE POLICY \Permitir update a buckets\ ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('comidas', 'comprobantes'));

-- Por si acaso, relajar temporalmente RLS de recibos_pago para confirmar
DROP POLICY IF EXISTS \Nutriologos pueden insertar sus recibos\ ON public.recibos_pago;
CREATE POLICY \Nutriologos pueden insertar sus recibos\ ON public.recibos_pago FOR INSERT TO authenticated WITH CHECK (true);

