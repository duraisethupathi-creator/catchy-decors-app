-- Atomic quotation numbering for all devices sharing this Supabase project.
-- Run once in Supabase Dashboard -> SQL Editor.
create table if not exists public.quotation_number_sequences (
  prefix text not null,
  sequence_year integer not null,
  last_sequence bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (prefix, sequence_year)
);

alter table public.quotation_number_sequences enable row level security;
revoke all on public.quotation_number_sequences from anon, authenticated, public;

create or replace function public.next_quotation_sequence(
  p_prefix text,
  p_year integer,
  p_start_number integer default 1
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing bigint := 0;
  v_initial bigint;
  v_next bigint;
  v_prefix text := coalesce(p_prefix, '');
  v_year integer := coalesce(p_year, 0);
begin
  if p_start_number is null or p_start_number < 1 then
    raise exception 'p_start_number must be at least 1';
  end if;

  -- Seed from quotations already present so installing this migration does
  -- not restart an existing business sequence at 1.
  select coalesce(max((regexp_match(q.quotation_number, '([0-9]+)$'))[1]::bigint), 0)
    into v_existing
    from public.quotations q
   where q.quotation_number is not null
     and left(q.quotation_number, length(v_prefix)) = v_prefix
     and (v_year = 0 or position(v_year::text in q.quotation_number) > 0);

  v_initial := greatest(v_existing, p_start_number - 1) + 1;

  insert into public.quotation_number_sequences(prefix, sequence_year, last_sequence)
  values (v_prefix, v_year, v_initial)
  on conflict (prefix, sequence_year)
  do update set
    last_sequence = greatest(
      public.quotation_number_sequences.last_sequence + 1,
      excluded.last_sequence
    ),
    updated_at = now()
  returning last_sequence into v_next;

  return v_next;
end;
$$;

revoke all on function public.next_quotation_sequence(text, integer, integer) from public;
grant execute on function public.next_quotation_sequence(text, integer, integer) to anon, authenticated;
