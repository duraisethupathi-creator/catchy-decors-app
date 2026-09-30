-- ============================================================================
--  CATCHY DECORS — Supabase schema with Row Level Security
--  Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  address       text,
  site_location text,
  date          text,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.quotations (
  id                uuid primary key default gen_random_uuid(),
  quotation_number  text unique,
  customer_id       uuid references public.customers(id) on delete cascade,
  customer_name     text,
  customer_phone    text,
  quotation_date    text,
  subtotal          numeric default 0,
  accessories_total numeric default 0,
  other_charges     numeric default 0,
  discount          numeric default 0,
  grand_total       numeric default 0,
  status            text default 'draft',
  site_location     text,
  gst               jsonb,
  items             jsonb,
  accessories       jsonb,
  charges           jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists public.measurements (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references public.customers(id) on delete cascade,
  product_type text,
  area_name    text,
  type         text,
  fabric_type  text,
  fabric_area  numeric default 0,
  width        numeric default 0,
  height       numeric default 0,
  quantity     numeric default 0,
  price        numeric default 0,
  total        numeric default 0,
  created_at   timestamptz default now()
);

create table if not exists public.accessories (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  area_name   text,
  track_type  text,
  width       numeric default 0,
  quantity    numeric default 0,
  price       numeric default 0,
  total       numeric default 0,
  created_at  timestamptz default now()
);

create table if not exists public.app_settings (
  id         uuid primary key default gen_random_uuid(),
  key        text unique,
  value      jsonb,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Indexes for the queries the app actually issues
-- ---------------------------------------------------------------------------
create index if not exists customers_phone_idx        on public.customers (phone);
create index if not exists quotations_customer_idx    on public.quotations (customer_id);
create index if not exists quotations_created_idx     on public.quotations (created_at desc);
create index if not exists measurements_customer_idx  on public.measurements (customer_id);
create index if not exists accessories_customer_idx   on public.accessories (customer_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

drop trigger if exists quotations_touch on public.quotations;
create trigger quotations_touch before update on public.quotations
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The app authenticates with the ANON key (staff logins are local to the
-- device). These policies therefore allow the anon role to read/write, which
-- is the simplest setup for a single-business deployment. TIGHTEN BEFORE
-- MULTI-TENANT USE: replace  true  with an auth check, e.g.
--     using (auth.uid() is not null)
-- or scope every row by an owner_id column once you add Supabase Auth.
-- ---------------------------------------------------------------------------
alter table public.customers    enable row level security;
alter table public.quotations   enable row level security;
alter table public.measurements enable row level security;
alter table public.accessories  enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "customers anon access"    on public.customers;
create policy "customers anon access"    on public.customers    for all to anon, authenticated using (true) with check (true);

drop policy if exists "quotations anon access"   on public.quotations;
create policy "quotations anon access"   on public.quotations   for all to anon, authenticated using (true) with check (true);

drop policy if exists "measurements anon access" on public.measurements;
create policy "measurements anon access" on public.measurements for all to anon, authenticated using (true) with check (true);

drop policy if exists "accessories anon access"  on public.accessories;
create policy "accessories anon access"  on public.accessories  for all to anon, authenticated using (true) with check (true);

drop policy if exists "app_settings anon access" on public.app_settings;
create policy "app_settings anon access" on public.app_settings for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Sanity check — should return 5
-- ---------------------------------------------------------------------------
select count(*) as catchy_decors_tables
from information_schema.tables
where table_schema = 'public'
  and table_name in ('customers','quotations','measurements','accessories','app_settings');

-- ---------------------------------------------------------------------------
-- Additive migration for databases created before the fabric column existed.
-- ---------------------------------------------------------------------------
alter table public.measurements add column if not exists fabric_type text;
alter table public.measurements add column if not exists fabric_area numeric default 0;
