-- Otorga permisos a los Atletas Independientes (Civil) para gestionar sus propios planes (nutricion, rutinas, etc.)

-- 1. NUTRICION
DROP POLICY IF EXISTS "Civil puede insertar nutricion" ON public.nutricion;
CREATE POLICY "Civil puede insertar nutricion" ON public.nutricion
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Civil puede actualizar nutricion" ON public.nutricion;
CREATE POLICY "Civil puede actualizar nutricion" ON public.nutricion
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND auth_id = auth.uid())
);

-- 2. NUTRICION_DIAS
DROP POLICY IF EXISTS "Civil puede insertar nutricion_dias" ON public.nutricion_dias;
CREATE POLICY "Civil puede insertar nutricion_dias" ON public.nutricion_dias
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM nutricion n JOIN clientes c ON c.id = n.cliente_id 
    WHERE n.id = nutricion_id AND c.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Civil puede actualizar nutricion_dias" ON public.nutricion_dias;
CREATE POLICY "Civil puede actualizar nutricion_dias" ON public.nutricion_dias
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM nutricion n JOIN clientes c ON c.id = n.cliente_id 
    WHERE n.id = nutricion_id AND c.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Civil puede eliminar nutricion_dias" ON public.nutricion_dias;
CREATE POLICY "Civil puede eliminar nutricion_dias" ON public.nutricion_dias
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM nutricion n JOIN clientes c ON c.id = n.cliente_id 
    WHERE n.id = nutricion_id AND c.auth_id = auth.uid()
  )
);

-- 3. COMIDAS
DROP POLICY IF EXISTS "Civil puede insertar comidas" ON public.comidas;
CREATE POLICY "Civil puede insertar comidas" ON public.comidas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM nutricion_dias nd 
    JOIN nutricion n ON n.id = nd.nutricion_id 
    JOIN clientes c ON c.id = n.cliente_id 
    WHERE nd.id = dia_id AND c.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Civil puede actualizar comidas" ON public.comidas;
CREATE POLICY "Civil puede actualizar comidas" ON public.comidas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM nutricion_dias nd 
    JOIN nutricion n ON n.id = nd.nutricion_id 
    JOIN clientes c ON c.id = n.cliente_id 
    WHERE nd.id = dia_id AND c.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Civil puede eliminar comidas" ON public.comidas;
CREATE POLICY "Civil puede eliminar comidas" ON public.comidas
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM nutricion_dias nd 
    JOIN nutricion n ON n.id = nd.nutricion_id 
    JOIN clientes c ON c.id = n.cliente_id 
    WHERE nd.id = dia_id AND c.auth_id = auth.uid()
  )
);

-- 4. RUTINAS
DROP POLICY IF EXISTS "Civil puede insertar rutinas" ON public.rutinas;
CREATE POLICY "Civil puede insertar rutinas" ON public.rutinas
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Civil puede actualizar rutinas" ON public.rutinas;
CREATE POLICY "Civil puede actualizar rutinas" ON public.rutinas
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Civil puede eliminar rutinas" ON public.rutinas;
CREATE POLICY "Civil puede eliminar rutinas" ON public.rutinas
FOR DELETE USING (
  EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND auth_id = auth.uid())
);

-- 5. EJERCICIOS
DROP POLICY IF EXISTS "Civil puede insertar ejercicios" ON public.ejercicios;
CREATE POLICY "Civil puede insertar ejercicios" ON public.ejercicios
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM rutinas r JOIN clientes c ON c.id = r.cliente_id 
    WHERE r.id = rutina_id AND c.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Civil puede actualizar ejercicios" ON public.ejercicios;
CREATE POLICY "Civil puede actualizar ejercicios" ON public.ejercicios
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM rutinas r JOIN clientes c ON c.id = r.cliente_id 
    WHERE r.id = rutina_id AND c.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Civil puede eliminar ejercicios" ON public.ejercicios;
CREATE POLICY "Civil puede eliminar ejercicios" ON public.ejercicios
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM rutinas r JOIN clientes c ON c.id = r.cliente_id 
    WHERE r.id = rutina_id AND c.auth_id = auth.uid()
  )
);

-- 6. CICLOS
DROP POLICY IF EXISTS "Civil puede insertar ciclos" ON public.ciclos;
CREATE POLICY "Civil puede insertar ciclos" ON public.ciclos
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Civil puede actualizar ciclos" ON public.ciclos;
CREATE POLICY "Civil puede actualizar ciclos" ON public.ciclos
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Civil puede eliminar ciclos" ON public.ciclos;
CREATE POLICY "Civil puede eliminar ciclos" ON public.ciclos
FOR DELETE USING (
  EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND auth_id = auth.uid())
);
