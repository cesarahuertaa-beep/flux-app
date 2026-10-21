-- Permitir que el directorio público de la Landing Page pueda leer los perfiles de los nutriólogos/admins activos
CREATE POLICY "Permitir lectura publica de nutriologos activos" 
ON public.profiles 
FOR SELECT 
USING (
  activo = true AND role IN ('nutriologo', 'superadmin', 'admin')
);
