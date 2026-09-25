-- SAIKO Construction AI v26.8
-- Safety tables for PDF-based Planned/Projected snapshots and per-project dashboard curves.

create table if not exists public.projected_progress_series (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  progress_date date not null,
  cumulative_percent numeric(12,4) not null default 0,
  source_label text,
  synced_at timestamptz not null default now(),
  unique(project_id, progress_date)
);

create table if not exists public.projected_scope_series (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  progress_date date not null,
  scope_name text not null,
  cumulative_percent numeric(12,4) not null default 0,
  synced_at timestamptz not null default now(),
  unique(project_id, progress_date, scope_name)
);

create table if not exists public.actual_progress_series (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  progress_date date not null,
  cumulative_percent numeric(12,4) not null default 0,
  source_label text,
  synced_at timestamptz not null default now(),
  unique(project_id, progress_date)
);

create table if not exists public.projected_sheet_snapshots (
  project_id uuid primary key references public.projects(id) on delete cascade,
  sheet_name text,
  visible_rows jsonb not null default '[]'::jsonb,
  uploaded_at timestamptz not null default now()
);

create index if not exists projected_progress_series_project_id_idx
  on public.projected_progress_series(project_id);
create index if not exists projected_scope_series_project_id_idx
  on public.projected_scope_series(project_id);
create index if not exists actual_progress_series_project_id_idx
  on public.actual_progress_series(project_id);

grant select, insert, update, delete on public.projected_progress_series to authenticated;
grant select, insert, update, delete on public.projected_scope_series to authenticated;
grant select, insert, update, delete on public.actual_progress_series to authenticated;
grant select, insert, update, delete on public.projected_sheet_snapshots to authenticated;

alter table public.projected_progress_series enable row level security;
alter table public.projected_scope_series enable row level security;
alter table public.actual_progress_series enable row level security;
alter table public.projected_sheet_snapshots enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'projected_progress_series',
    'projected_scope_series',
    'actual_progress_series',
    'projected_sheet_snapshots'
  ]
  loop
    execute format('drop policy if exists "authenticated all %s" on public.%I', t, t);
    execute format(
      'create policy "authenticated all %s" on public.%I for all to authenticated using (true) with check (true)',
      t,t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v26.8 projected PDF planned tracker + clean project S-curves');
  end if;
end $$;

select 'v26.8 ready' as result;
