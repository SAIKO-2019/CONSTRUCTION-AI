-- SAIKO Construction AI v14.2 - Quotation Workspace + Ongoing Schedule Health
-- Additive migration.

create table if not exists public.quotation_projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  client_name text,
  estimator text,
  target_submission date,
  status text default 'For Quotation',
  boq_file_name text,
  boq_storage_path text,
  gsheet_link text,
  estimated_cost numeric(18,2) default 0,
  quoted_amount numeric(18,2) default 0,
  running_amount numeric(18,2) default 0,
  projected_profit numeric(18,2) default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

grant select, insert, update, delete on public.quotation_projects to authenticated;
alter table public.quotation_projects enable row level security;
drop policy if exists quotation_projects_all_authenticated on public.quotation_projects;
create policy quotation_projects_all_authenticated on public.quotation_projects
for all to authenticated using (true) with check (true);

select 'SAIKO Construction AI v14.2 quotation workspace ready' as result;
