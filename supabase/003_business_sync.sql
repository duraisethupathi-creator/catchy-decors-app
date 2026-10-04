-- Catchy Decors Pro: business modules used by multi-device sync
-- Run after 002_schema_with_rls.sql in Supabase SQL Editor.

create table if not exists public.payments (
  id text primary key, quotation_id text, amount numeric not null default 0,
  mode text, date timestamptz, note text, updated_at timestamptz default now()
);
create table if not exists public.expenses (
  id text primary key, quotation_id text, category text, description text,
  amount numeric not null default 0, date timestamptz, updated_at timestamptz default now()
);
create table if not exists public.rate_library (
  id text primary key, product text, type text, material text, rate numeric not null default 0,
  unit text, updated_at timestamptz default now()
);
create table if not exists public.service_bills (
  id text primary key, payload jsonb not null default '{}'::jsonb, updated_at timestamptz default now()
);

alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.rate_library enable row level security;
alter table public.service_bills enable row level security;

-- Current app uses the project's anon key. Keep these policies aligned with the existing 002 schema.
do $$ begin
  create policy "payments anon all" on public.payments for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "expenses anon all" on public.expenses for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "rate library anon all" on public.rate_library for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service bills anon all" on public.service_bills for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
