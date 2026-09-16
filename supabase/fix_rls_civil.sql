-- Corrección de políticas de seguridad para recibos_pago_civil
-- Ejecutar en el SQL Editor de Supabase

drop policy if exists "Civil puede insertar sus recibos" on public.recibos_pago_civil;
drop policy if exists "Civil y superadmin pueden leer recibos" on public.recibos_pago_civil;

create policy "Civil puede insertar sus recibos"
  on public.recibos_pago_civil
  for insert
  with check (
    exists (
      select 1 from public.clientes 
      where id = cliente_id and auth_id = auth.uid()
    )
  );

create policy "Civil y superadmin pueden leer recibos"
  on public.recibos_pago_civil
  for select
  using (
    exists (
      select 1 from public.clientes 
      where id = cliente_id and auth_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles 
      where id = auth.uid() and role = 'superadmin'
    )
  );
