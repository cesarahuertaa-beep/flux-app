-- Fix: Asignar valor por defecto a tipo_movimiento en biblioteca_ejercicios
-- para evitar fallos por restricción NOT NULL si alguna inserción no lo especifica.

ALTER TABLE public.biblioteca_ejercicios 
  ALTER COLUMN tipo_movimiento SET DEFAULT 'Empuje';
