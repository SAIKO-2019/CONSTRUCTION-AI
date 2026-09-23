-- SAIKO Construction AI v11 - unified operational setup + permission fix
-- Safe to re-run. Existing data is preserved.
-- Run this once in Supabase SQL Editor as a normal query.

-- 1) PROFILE DEFAULTS / EXISTING VIEWERS
alter table public."SAIKO BUILDERS" alter column role set default 'editor';
alter table public."SAIKO BUILDERS" alter column status set default 'active';
update public."SAIKO BUILDERS" set role='editor' where role='viewer';

-- 2) OPERATIONAL TABLES
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  client_name text,
  location text,
  contract_amount numeric(18,2) default 0,
  start_date date,
  target_date date,
  status text default 'Planning',
  progress numeric(8,2) default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.billings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  billing_no text not null,
  gross_amount numeric(18,2) default 0,
  retention_percent numeric(8,2) default 0,
  retention_amount numeric(18,2) default 0,
  recoupment_percent numeric(8,2) default 0,
  recoupment_amount numeric(18,2) default 0,
  net_due numeric(18,2) default 0,
  received_amount numeric(18,2) default 0,
  outstanding_amount numeric(18,2) default 0,
  date_submitted date,
  date_paid date,
  status text default 'Pending',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid references public.billings(id) on delete cascade,
  amount numeric(18,2) not null,
  payment_date date default current_date,
  reference_no text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  activity text not null,
  start_date date not null,
  end_date date not null,
  weight numeric(8,2) default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.actual_progress (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  activity text not null,
  weight numeric(8,2) default 0,
  actual_percent numeric(8,2) default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  unique(project_id, activity)
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  category text,
  file_name text not null,
  storage_path text not null,
  uploaded_by text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,
  template_name text not null,
  storage_path text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.boq_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  item_no text,
  description text not null,
  unit text,
  quantity numeric(18,4) default 0,
  unit_cost numeric(18,2) default 0,
  amount numeric(18,2) default 0,
  source_file text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 3) EXPLICIT TABLE PRIVILEGES FOR SIGNED-IN USERS
-- This fixes "permission denied for table projects" and similar errors.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.billings to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.schedule_items to authenticated;
grant select, insert, update, delete on public.actual_progress to authenticated;
grant select, insert, update, delete on public.project_files to authenticated;
grant select, insert, update, delete on public.document_templates to authenticated;
grant select, insert, update, delete on public.boq_items to authenticated;

-- 4) RLS - ALL AUTHENTICATED USERS CAN WORK WITH OPERATIONAL DATA
alter table public.projects enable row level security;
alter table public.billings enable row level security;
alter table public.payments enable row level security;
alter table public.schedule_items enable row level security;
alter table public.actual_progress enable row level security;
alter table public.project_files enable row level security;
alter table public.document_templates enable row level security;
alter table public.boq_items enable row level security;

-- projects
drop policy if exists projects_select_authenticated on public.projects;
drop policy if exists projects_insert_authenticated on public.projects;
drop policy if exists projects_update_authenticated on public.projects;
drop policy if exists projects_delete_authenticated on public.projects;
create policy projects_select_authenticated on public.projects for select to authenticated using (true);
create policy projects_insert_authenticated on public.projects for insert to authenticated with check (true);
create policy projects_update_authenticated on public.projects for update to authenticated using (true) with check (true);
create policy projects_delete_authenticated on public.projects for delete to authenticated using (true);

-- billings
drop policy if exists billings_select_authenticated on public.billings;
drop policy if exists billings_insert_authenticated on public.billings;
drop policy if exists billings_update_authenticated on public.billings;
drop policy if exists billings_delete_authenticated on public.billings;
create policy billings_select_authenticated on public.billings for select to authenticated using (true);
create policy billings_insert_authenticated on public.billings for insert to authenticated with check (true);
create policy billings_update_authenticated on public.billings for update to authenticated using (true) with check (true);
create policy billings_delete_authenticated on public.billings for delete to authenticated using (true);

-- payments
drop policy if exists payments_select_authenticated on public.payments;
drop policy if exists payments_insert_authenticated on public.payments;
drop policy if exists payments_update_authenticated on public.payments;
drop policy if exists payments_delete_authenticated on public.payments;
create policy payments_select_authenticated on public.payments for select to authenticated using (true);
create policy payments_insert_authenticated on public.payments for insert to authenticated with check (true);
create policy payments_update_authenticated on public.payments for update to authenticated using (true) with check (true);
create policy payments_delete_authenticated on public.payments for delete to authenticated using (true);

-- schedule
drop policy if exists schedule_select_authenticated on public.schedule_items;
drop policy if exists schedule_insert_authenticated on public.schedule_items;
drop policy if exists schedule_update_authenticated on public.schedule_items;
drop policy if exists schedule_delete_authenticated on public.schedule_items;
create policy schedule_select_authenticated on public.schedule_items for select to authenticated using (true);
create policy schedule_insert_authenticated on public.schedule_items for insert to authenticated with check (true);
create policy schedule_update_authenticated on public.schedule_items for update to authenticated using (true) with check (true);
create policy schedule_delete_authenticated on public.schedule_items for delete to authenticated using (true);

-- actual progress
drop policy if exists progress_select_authenticated on public.actual_progress;
drop policy if exists progress_insert_authenticated on public.actual_progress;
drop policy if exists progress_update_authenticated on public.actual_progress;
drop policy if exists progress_delete_authenticated on public.actual_progress;
create policy progress_select_authenticated on public.actual_progress for select to authenticated using (true);
create policy progress_insert_authenticated on public.actual_progress for insert to authenticated with check (true);
create policy progress_update_authenticated on public.actual_progress for update to authenticated using (true) with check (true);
create policy progress_delete_authenticated on public.actual_progress for delete to authenticated using (true);

-- project files
drop policy if exists project_files_select_authenticated on public.project_files;
drop policy if exists project_files_insert_authenticated on public.project_files;
drop policy if exists project_files_update_authenticated on public.project_files;
drop policy if exists project_files_delete_authenticated on public.project_files;
create policy project_files_select_authenticated on public.project_files for select to authenticated using (true);
create policy project_files_insert_authenticated on public.project_files for insert to authenticated with check (true);
create policy project_files_update_authenticated on public.project_files for update to authenticated using (true) with check (true);
create policy project_files_delete_authenticated on public.project_files for delete to authenticated using (true);

-- templates
drop policy if exists templates_select_authenticated on public.document_templates;
drop policy if exists templates_insert_authenticated on public.document_templates;
drop policy if exists templates_update_authenticated on public.document_templates;
drop policy if exists templates_delete_authenticated on public.document_templates;
create policy templates_select_authenticated on public.document_templates for select to authenticated using (true);
create policy templates_insert_authenticated on public.document_templates for insert to authenticated with check (true);
create policy templates_update_authenticated on public.document_templates for update to authenticated using (true) with check (true);
create policy templates_delete_authenticated on public.document_templates for delete to authenticated using (true);

-- boq
drop policy if exists boq_select_authenticated on public.boq_items;
drop policy if exists boq_insert_authenticated on public.boq_items;
drop policy if exists boq_update_authenticated on public.boq_items;
drop policy if exists boq_delete_authenticated on public.boq_items;
create policy boq_select_authenticated on public.boq_items for select to authenticated using (true);
create policy boq_insert_authenticated on public.boq_items for insert to authenticated with check (true);
create policy boq_update_authenticated on public.boq_items for update to authenticated using (true) with check (true);
create policy boq_delete_authenticated on public.boq_items for delete to authenticated using (true);

-- 5) STORAGE BUCKETS
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('templates', 'templates', false)
on conflict (id) do nothing;

-- Storage policies for authenticated users.
drop policy if exists saiko_storage_select on storage.objects;
drop policy if exists saiko_storage_insert on storage.objects;
drop policy if exists saiko_storage_update on storage.objects;
drop policy if exists saiko_storage_delete on storage.objects;
create policy saiko_storage_select on storage.objects for select to authenticated using (bucket_id in ('project-files','templates'));
create policy saiko_storage_insert on storage.objects for insert to authenticated with check (bucket_id in ('project-files','templates'));
create policy saiko_storage_update on storage.objects for update to authenticated using (bucket_id in ('project-files','templates')) with check (bucket_id in ('project-files','templates'));
create policy saiko_storage_delete on storage.objects for delete to authenticated using (bucket_id in ('project-files','templates'));

select 'SAIKO Construction AI v11 database + permissions ready' as result;
