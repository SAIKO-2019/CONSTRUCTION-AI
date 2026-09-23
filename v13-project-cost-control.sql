-- SAIKO Construction AI v13 - Project Cost Control upgrade
-- Safe additive migration. Existing project data is preserved.

grant usage on schema public to authenticated;

-- PROJECT FINANCIAL BASELINE
alter table public.projects add column if not exists original_contract_amount numeric(18,2) default 0;
alter table public.projects add column if not exists discount_amount numeric(18,2) default 0;
update public.projects
set original_contract_amount = contract_amount
where coalesce(original_contract_amount,0)=0 and coalesce(contract_amount,0)>0;

-- BILLING / PAYABLE METADATA
alter table public.billings add column if not exists billing_type text default 'Client Billing';
alter table public.billings add column if not exists accomplishment_percent numeric(8,2) default 0;
alter table public.billings add column if not exists variation_no text;
alter table public.billings add column if not exists date_request date;
alter table public.billings add column if not exists retention_applicable boolean default false;
alter table public.billings add column if not exists recoupment_applicable boolean default false;
alter table public.billings add column if not exists input_by_name text;
alter table public.billings add column if not exists transaction_side text default 'receivable';

-- BOQ CLASSIFICATION
alter table public.boq_items add column if not exists cost_category text default 'Materials';

-- ACTUAL PROGRESS LINKS TO BOQ / COST
alter table public.actual_progress add column if not exists boq_item_id uuid references public.boq_items(id) on delete set null;
alter table public.actual_progress add column if not exists cost_category text;
alter table public.actual_progress add column if not exists budget_amount numeric(18,2) default 0;

-- HISTORY FOR S-CURVE ACTUAL TREND
create table if not exists public.progress_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  activity text not null,
  boq_item_id uuid references public.boq_items(id) on delete set null,
  weight numeric(8,2) default 0,
  actual_percent numeric(8,2) default 0,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz default now()
);

-- INVENTORY / PURCHASES
create table if not exists public.inventory_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  boq_item_id uuid references public.boq_items(id) on delete set null,
  category text default 'Materials',
  description text not null,
  quantity numeric(18,4) default 0,
  unit text,
  unit_cost numeric(18,2) default 0,
  total_amount numeric(18,2) default 0,
  paid_amount numeric(18,2) default 0,
  balance_amount numeric(18,2) default 0,
  date_request date,
  date_purchase date,
  supplier text,
  reference_no text,
  input_by_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

grant select, insert, update, delete on public.progress_history to authenticated;
grant select, insert, update, delete on public.inventory_entries to authenticated;

alter table public.progress_history enable row level security;
alter table public.inventory_entries enable row level security;

drop policy if exists progress_history_all_authenticated on public.progress_history;
create policy progress_history_all_authenticated on public.progress_history
for all to authenticated using (true) with check (true);

drop policy if exists inventory_all_authenticated on public.inventory_entries;
create policy inventory_all_authenticated on public.inventory_entries
for all to authenticated using (true) with check (true);

select 'SAIKO Construction AI v13 project cost control ready' as result;
