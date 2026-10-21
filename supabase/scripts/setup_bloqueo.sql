-- Agregar campo de bloqueo a perfiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
