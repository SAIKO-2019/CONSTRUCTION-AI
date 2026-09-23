-- SAIKO Construction AI v14 Integrated Control
-- Additive migration. Existing data is preserved.

grant usage on schema public to authenticated;

-- PROJECTS: accomplishment is derived from Actual Progress / schedule, not manually encoded.
alter table public.projects add column if not exists derived_progress boolean default true;

-- BILLING: optional retention/recoupment for every billing type and subcontractor balance tracking.
alter table public.billings add column if not exists issued_amount numeric(18,2) default 0;
alter table public.billings add column if not exists subcontract_balance numeric(18,2) default 0;
alter table public.billings add column if not exists billing_type text default 'Client Billing';

-- INVENTORY: spreadsheet custom columns.
create table if not exists public.inventory_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  column_name text not null,
  column_key text not null,
  display_order integer default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(project_id, column_key)
);

alter table public.inventory_entries add column if not exists custom_data jsonb default '{}'::jsonb;

-- PENDING WORKS + EVIDENCE
create table if not exists public.pending_works (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  work_item text not null,
  assigned_to text,
  target_date date,
  required_evidence text,
  notes text,
  status text default 'Pending',
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pending_work_evidence (
  id uuid primary key default gen_random_uuid(),
  pending_work_id uuid references public.pending_works(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  note text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.inventory_columns to authenticated;
grant select, insert, update, delete on public.pending_works to authenticated;
grant select, insert, update, delete on public.pending_work_evidence to authenticated;

alter table public.inventory_columns enable row level security;
alter table public.pending_works enable row level security;
alter table public.pending_work_evidence enable row level security;

drop policy if exists inventory_columns_all_authenticated on public.inventory_columns;
create policy inventory_columns_all_authenticated on public.inventory_columns for all to authenticated using (true) with check (true);

drop policy if exists pending_works_all_authenticated on public.pending_works;
create policy pending_works_all_authenticated on public.pending_works for all to authenticated using (true) with check (true);

drop policy if exists pending_work_evidence_all_authenticated on public.pending_work_evidence;
create policy pending_work_evidence_all_authenticated on public.pending_work_evidence for all to authenticated using (true) with check (true);

-- Ensure authenticated users can manage evidence files in project-files bucket.
drop policy if exists v14_pending_evidence_insert on storage.objects;
create policy v14_pending_evidence_insert on storage.objects
for insert to authenticated
with check (bucket_id='project-files');

select 'SAIKO Construction AI v14 integrated control ready' as result;
