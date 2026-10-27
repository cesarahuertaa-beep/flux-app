-- Tabla de recibos de pago para Atletas Independientes (Civil Premium)
-- Ejecutar en el SQL Editor de Supabase

create table if not exists public.recibos_pago_civil (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  monto           numeric(10,2) not null,
  fecha_corte_mes date,
  comprobante_url text,
  estado          text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  created_at      timestamptz not null default now()
);

-- Habilitar RLS
alter table public.recibos_pago_civil enable row level security;

-- El atleta independiente puede insertar sus propios recibos
create policy "Civil puede insertar sus recibos"
  on public.recibos_pago_civil
  for insert
  with check (cliente_id = auth.uid());

-- El atleta puede ver sus propios recibos; el superadmin ve todos
create policy "Civil y superadmin pueden leer recibos"
  on public.recibos_pago_civil
  for select
  using (
    cliente_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'superadmin'
    )
  );

-- Solo el superadmin puede actualizar (aprobar/rechazar)
create policy "Superadmin actualiza recibos civil"
  on public.recibos_pago_civil
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'superadmin'
    )
  );
