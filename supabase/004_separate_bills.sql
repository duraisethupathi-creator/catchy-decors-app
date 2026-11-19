-- Separate persisted non-GST bills and GST invoices from quotation records.
create table if not exists public.bills (
  id text primary key,
  quotation_id text not null,
  quotation_number text not null,
  document_type text not null check (document_type in ('bill', 'gst')),
  document_number text not null,
  customer_id text not null,
  customer_name text not null default '',
  customer_phone text not null default '',
  document_date date not null,
  subtotal numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  balance_amount numeric(14,2) not null default 0,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bills_customer_id_idx on public.bills(customer_id);
create index if not exists bills_quotation_id_idx on public.bills(quotation_id);
alter table public.bills enable row level security;
-- Align with the app's current anon-key shared-workspace sync model.
drop policy if exists "bills shared workspace access" on public.bills;
create policy "bills shared workspace access" on public.bills
  for all to anon, authenticated using (true) with check (true);
