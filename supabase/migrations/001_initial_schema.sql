-- Catchy Decors — Supabase schema
-- Run this in the Supabase SQL editor (Database -> SQL).
-- The app works fully offline first; when Supabase credentials are set in
-- app.json (extra.supabaseUrl / extra.supabaseAnonKey) these tables receive synced data.

create extension if not exists "uuid-ossp";

-- USERS
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  phone text,
  role text not null check (role in ('admin','staff')) default 'staff',
  created_at timestamptz not null default now()
);

-- CUSTOMERS
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null,
  address text,
  site_location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- MEASUREMENTS
create table if not exists measurements (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  product_type text not null,
  area_name text not null,
  type text,
  width numeric not null default 0,
  height numeric not null default 0,
  quantity numeric not null default 0,
  price numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ACCESSORIES
create table if not exists accessories (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  area_name text not null,
  track_type text,
  width numeric not null default 0,
  quantity numeric not null default 0,
  price numeric not null default 0,
  total numeric not null default 0
);

-- QUOTATIONS
create table if not exists quotations (
  id uuid primary key default uuid_generate_v4(),
  quotation_number text unique not null,
  customer_id uuid references customers(id) on delete set null,
  quotation_date date not null default current_date,
  subtotal numeric not null default 0,
  accessories_total numeric not null default 0,
  other_charges numeric not null default 0,
  discount numeric not null default 0,
  grand_total numeric not null default 0,
  status text not null check (status in ('draft','sent','approved','completed')) default 'draft',
  created_at timestamptz not null default now()
);

-- QUOTATION_ITEMS
create table if not exists quotation_items (
  id uuid primary key default uuid_generate_v4(),
  quotation_id uuid references quotations(id) on delete cascade,
  product_type text not null,
  area_name text not null,
  type text,
  width numeric not null default 0,
  height numeric not null default 0,
  quantity numeric not null default 0,
  price numeric not null default 0,
  total numeric not null default 0
);

-- ADDITIONAL_CHARGES
create table if not exists additional_charges (
  id uuid primary key default uuid_generate_v4(),
  quotation_id uuid references quotations(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  price numeric not null default 0,
  total numeric not null default 0
);

-- PAYMENTS
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  quotation_id uuid references quotations(id) on delete cascade,
  amount numeric not null default 0,
  payment_date date not null default current_date,
  payment_method text,
  notes text
);

-- Helpful indexes
create index if not exists idx_customers_phone on customers(phone);
create index if not exists idx_measurements_customer on measurements(customer_id);
create index if not exists idx_quotations_customer on quotations(customer_id);
create index if not exists idx_quotation_items_quotation on quotation_items(quotation_id);

-- Row Level Security: enable and add policies appropriate to your org.
-- Example (service role / authenticated users full access):
-- alter table customers enable row level security;
-- create policy "authenticated all access" on customers for authenticated using (true);
