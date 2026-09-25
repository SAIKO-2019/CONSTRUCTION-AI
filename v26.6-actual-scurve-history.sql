-- SAIKO Construction AI v26.6
-- Safety migration for Actual historical S-Curve points.

create table if not exists public.actual_progress_series (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  progress_date date not null,
  cumulative_percent numeric(12,4) not null default 0,
  source_label text,
  synced_at timestamptz not null default now(),
  unique(project_id, progress_date)
);

create index if not exists actual_progress_series_project_id_idx
  on public.actual_progress_series(project_id);

grant select, insert, update, delete on public.actual_progress_series to authenticated;

alter table public.actual_progress_series enable row level security;

drop policy if exists "authenticated read actual progress series" on public.actual_progress_series;
create policy "authenticated read actual progress series"
on public.actual_progress_series for select to authenticated using (true);

drop policy if exists "authenticated insert actual progress series" on public.actual_progress_series;
create policy "authenticated insert actual progress series"
on public.actual_progress_series for insert to authenticated with check (true);

drop policy if exists "authenticated update actual progress series" on public.actual_progress_series;
create policy "authenticated update actual progress series"
on public.actual_progress_series for update to authenticated using (true) with check (true);

drop policy if exists "authenticated delete actual progress series" on public.actual_progress_series;
create policy "authenticated delete actual progress series"
on public.actual_progress_series for delete to authenticated using (true);

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v26.6 actual live S-curve history');
  end if;
end $$;

select 'v26.6 ready' as result;
