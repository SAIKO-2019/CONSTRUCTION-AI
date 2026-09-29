-- CONSTRUCTION MONITORING v28.11
-- Safe superset migration for:
--   1) reliable DP classification
--   2) Amount to Issue per linked Subcon billing
--   3) separate dated Subcon payment history
--   4) Melendres -900 transparent material correction
--   5) realtime Subcon payment sync
--   6) v28.11 release broadcast
--
-- The UI financial engine uses selected-project data only.
-- Downpayment remains separate and is NOT included in Total Received.

alter table public.billings
  add column if not exists billing_category text not null default 'Billing';

alter table public.billings
  add column if not exists subcon_amount_to_issue numeric(18,2) not null default 0;

-- Normalize obvious legacy DP rows so they cannot inflate Total Received.
update public.billings
set billing_category='Downpayment'
where lower(coalesce(billing_category,'')) <> 'downpayment'
  and (
    lower(trim(coalesce(billing_no,''))) ~ '(^|[^a-z])(down[[:space:]]*payment|downpayment|dp)([^a-z]|$)'
    or lower(trim(coalesce(variation_no,''))) ~ '(^|[^a-z])(down[[:space:]]*payment|downpayment|dp)([^a-z]|$)'
  );

create table if not exists public.subcon_payments (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.billings(id) on delete cascade,
  amount numeric(18,2) not null default 0 check (amount >= 0),
  payment_date date not null,
  reference_no text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcon_payments_billing_id_idx
  on public.subcon_payments(billing_id);

alter table public.subcon_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='subcon_payments'
      and policyname='subcon_payments_authenticated_select'
  ) then
    create policy subcon_payments_authenticated_select
      on public.subcon_payments
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='subcon_payments'
      and policyname='subcon_payments_authenticated_insert'
  ) then
    create policy subcon_payments_authenticated_insert
      on public.subcon_payments
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='subcon_payments'
      and policyname='subcon_payments_authenticated_update'
  ) then
    create policy subcon_payments_authenticated_update
      on public.subcon_payments
      for update
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='subcon_payments'
      and policyname='subcon_payments_authenticated_delete'
  ) then
    create policy subcon_payments_authenticated_delete
      on public.subcon_payments
      for delete
      to authenticated
      using (true);
  end if;
end $$;

grant select, insert, update, delete on public.subcon_payments to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.subcon_payments;
exception
  when duplicate_object then null;
end $$;

-- Keep the already-agreed Melendres material correction duplicate-safe.
insert into public.inventory_entries (
  project_id,
  category,
  description,
  quantity,
  unit,
  unit_cost,
  total_amount,
  paid_amount,
  balance_amount,
  date_purchase,
  supplier,
  reference_no,
  input_by_name,
  custom_data
)
select
  p.id,
  'Materials',
  'MATERIAL COST CORRECTION (-900)',
  1,
  'ADJ',
  -900.00,
  -900.00,
  -900.00,
  0,
  null,
  null,
  'CORRECTION',
  'System Correction',
  jsonb_build_object(
    'adjustment_key','melendres_material_minus_900_20260929',
    'reason','User verified material cost was overstated by 900',
    'import_batch','melendres_inventory_20260929'
  )
from public.projects p
where lower(p.project_name)='melendres-enriquez residences'
  and not exists (
    select 1
    from public.inventory_entries i
    where i.project_id=p.id
      and i.custom_data->>'adjustment_key'='melendres_material_minus_900_20260929'
  );

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.11 selected-project live finance + correct DP exclusion + unified budget + architectural theme backgrounds'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.11 ready' as result;
