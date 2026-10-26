-- ==============================================================
-- Actualización del constraint profiles_role_check para admitir nutriologo_estudiante y civil
-- ==============================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
  'superadmin', 
  'admin', 
  'nutriologo', 
  'nutriologo_estudiante', 
  'administrativo', 
  'cliente', 
  'client', 
  'staff', 
  'civil'
));
