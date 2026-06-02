create table if not exists public.ella_crow_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ella_crow_store enable row level security;

create policy "Allow dashboard reads"
on public.ella_crow_store
for select
using (true);

create policy "Allow dashboard writes"
on public.ella_crow_store
for insert
with check (true);

create policy "Allow dashboard updates"
on public.ella_crow_store
for update
using (true)
with check (true);

create policy "Allow dashboard deletes"
on public.ella_crow_store
for delete
using (true);
