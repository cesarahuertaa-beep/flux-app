
DROP POLICY IF EXISTS " Permitir subidas comidas y comprobantes\ ON storage.objects;
DROP POLICY IF EXISTS \Permitir editar comidas y comprobantes\ ON storage.objects;
DROP POLICY IF EXISTS \Permitir borrar comidas y comprobantes\ ON storage.objects;

CREATE POLICY \Permitir subidas comidas y comprobantes\ ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('comidas', 'comprobantes'));
CREATE POLICY \Permitir editar comidas y comprobantes\ ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('comidas', 'comprobantes'));
CREATE POLICY \Permitir borrar comidas y comprobantes\ ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('comidas', 'comprobantes'));

