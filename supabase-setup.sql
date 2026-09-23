-- SAIKO Construction AI complete database setup
-- Safe to run after the existing profile table "SAIKO BUILDERS" has been created.

-- Make new self-signups editors by default.
alter table public."SAIKO BUILDERS" alter column role set default 'editor';
alter table public."SAIKO BUILDERS" alter column status set default 'active';

-- Ensure RLS on profiles.
alter table public."SAIKO BUILDERS" enable row level security;

create or replace function public.is_saiko_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public."SAIKO BUILDERS" p where p.user_id=auth.uid() and p.role='admin' and p.status='active');
$$;
create or replace function public.is_saiko_active()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public."SAIKO BUILDERS" p where p.user_id=auth.uid() and p.status='active');
$$;

-- Drop old policies if present, then rebuild.
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='SAIKO BUILDERS' loop
    execute format('drop policy if exists %I on public."SAIKO BUILDERS"',r.policyname);
  end loop;
end $$;
create policy profile_self_select on public."SAIKO BUILDERS" for select to authenticated using (user_id=auth.uid() or public.is_saiko_admin());
create policy profile_self_insert on public."SAIKO BUILDERS" for insert to authenticated with check (user_id=auth.uid() and role in ('editor','viewer') and status='active');
create policy profile_admin_update on public."SAIKO BUILDERS" for update to authenticated using (public.is_saiko_admin()) with check (public.is_saiko_admin());

-- Automatic profile row after signup.
create or replace function public.handle_new_saiko_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public."SAIKO BUILDERS"(user_id,full_name,email,role,department,status)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),new.email,'editor',coalesce(new.raw_user_meta_data->>'department','Other'),'active')
  on conflict do nothing;
  return new;
end;$$;
drop trigger if exists on_auth_user_created_saiko on auth.users;
create trigger on_auth_user_created_saiko after insert on auth.users for each row execute function public.handle_new_saiko_user();

create table if not exists public.projects(
  id uuid primary key default gen_random_uuid(), project_name text not null, client_name text, location text,
  contract_amount numeric(18,2) default 0, start_date date, target_date date, status text default 'Planning',
  progress numeric(8,2) default 0, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.billings(
  id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete cascade,
  billing_no text not null, gross_amount numeric(18,2) default 0, retention_percent numeric(8,2) default 0,
  retention_amount numeric(18,2) default 0, recoupment_percent numeric(8,2) default 0, recoupment_amount numeric(18,2) default 0,
  net_due numeric(18,2) default 0, received_amount numeric(18,2) default 0, outstanding_amount numeric(18,2) default 0,
  date_submitted date, date_paid date, status text default 'Pending', created_by uuid references auth.users(id), created_at timestamptz default now()
);
create table if not exists public.payments(
  id uuid primary key default gen_random_uuid(), billing_id uuid references public.billings(id) on delete cascade,
  amount numeric(18,2) not null, payment_date date default current_date, reference_no text, created_by uuid references auth.users(id), created_at timestamptz default now()
);
create table if not exists public.schedule_items(
  id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete cascade,
  activity text not null, start_date date not null, end_date date not null, weight numeric(8,2) default 0,
  created_by uuid references auth.users(id), created_at timestamptz default now()
);
create table if not exists public.actual_progress(
  id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete cascade,
  activity text not null, weight numeric(8,2) default 0, actual_percent numeric(8,2) default 0,
  updated_by uuid references auth.users(id), updated_at timestamptz default now(), unique(project_id,activity)
);
create table if not exists public.project_files(
  id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete cascade,
  category text, file_name text not null, storage_path text not null, uploaded_by text, created_by uuid references auth.users(id), created_at timestamptz default now()
);
create table if not exists public.document_templates(
  id uuid primary key default gen_random_uuid(), template_type text not null, template_name text not null, storage_path text not null,
  created_by uuid references auth.users(id), created_at timestamptz default now()
);

-- RLS helper: active users can read/write operational data.
do $$ declare t text; begin
  foreach t in array array['projects','billings','payments','schedule_items','actual_progress','project_files','document_templates'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists active_select on public.%I',t);
    execute format('drop policy if exists active_insert on public.%I',t);
    execute format('drop policy if exists active_update on public.%I',t);
    execute format('drop policy if exists active_delete on public.%I',t);
    execute format('create policy active_select on public.%I for select to authenticated using (public.is_saiko_active())',t);
    execute format('create policy active_insert on public.%I for insert to authenticated with check (public.is_saiko_active())',t);
    execute format('create policy active_update on public.%I for update to authenticated using (public.is_saiko_active()) with check (public.is_saiko_active())',t);
    execute format('create policy active_delete on public.%I for delete to authenticated using (public.is_saiko_active())',t);
  end loop;
end $$;

-- Storage buckets for cloud document retention.
insert into storage.buckets(id,name,public) values('project-files','project-files',false) on conflict(id) do nothing;
insert into storage.buckets(id,name,public) values('templates','templates',false) on conflict(id) do nothing;

drop policy if exists saiko_project_files_select on storage.objects;
drop policy if exists saiko_project_files_insert on storage.objects;
drop policy if exists saiko_project_files_update on storage.objects;
drop policy if exists saiko_project_files_delete on storage.objects;
create policy saiko_project_files_select on storage.objects for select to authenticated using (bucket_id in ('project-files','templates') and public.is_saiko_active());
create policy saiko_project_files_insert on storage.objects for insert to authenticated with check (bucket_id in ('project-files','templates') and public.is_saiko_active());
create policy saiko_project_files_update on storage.objects for update to authenticated using (bucket_id in ('project-files','templates') and public.is_saiko_active());
create policy saiko_project_files_delete on storage.objects for delete to authenticated using (bucket_id in ('project-files','templates') and public.is_saiko_active());
