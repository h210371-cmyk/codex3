create table if not exists public.inventory_items (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;

drop policy if exists "Anyone can read inventory items" on public.inventory_items;
drop policy if exists "Anyone can add inventory items" on public.inventory_items;
drop policy if exists "Anyone can update inventory items" on public.inventory_items;
drop policy if exists "Anyone can delete inventory items" on public.inventory_items;

create policy "Anyone can read inventory items"
on public.inventory_items
for select
using (true);

create policy "Anyone can add inventory items"
on public.inventory_items
for insert
with check (true);

create policy "Anyone can update inventory items"
on public.inventory_items
for update
using (true)
with check (true);

create policy "Anyone can delete inventory items"
on public.inventory_items
for delete
using (true);
