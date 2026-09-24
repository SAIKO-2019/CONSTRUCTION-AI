-- SAIKO Construction AI v26.1
-- Stores Projected cumulative % per canonical scope/date so it can be compared
-- directly with Actual STATUS using the same scope format.

create table if not exists public.projected_scope_series (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  progress_date date not null,
  scope_name text not null,
  cumulative_percent numeric(12,4) not null default 0,
  synced_at timestamptz not null default now(),
  unique(project_id, progress_date, scope_name)
);

create index if not exists projected_scope_series_project_id_idx
  on public.projected_scope_series(project_id);

grant select, insert, update, delete on public.projected_scope_series to authenticated;

alter table public.projected_scope_series enable row level security;

drop policy if exists "authenticated read projected scope series" on public.projected_scope_series;
create policy "authenticated read projected scope series"
on public.projected_scope_series for select to authenticated using (true);

drop policy if exists "authenticated insert projected scope series" on public.projected_scope_series;
create policy "authenticated insert projected scope series"
on public.projected_scope_series for insert to authenticated with check (true);

drop policy if exists "authenticated update projected scope series" on public.projected_scope_series;
create policy "authenticated update projected scope series"
on public.projected_scope_series for update to authenticated using (true) with check (true);

drop policy if exists "authenticated delete projected scope series" on public.projected_scope_series;
create policy "authenticated delete projected scope series"
on public.projected_scope_series for delete to authenticated using (true);

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v26.1 projected vs actual scope comparison');
  end if;
end $$;

select 'v26.1 ready' as result;
