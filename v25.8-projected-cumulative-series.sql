-- SAIKO Construction AI v25.8
-- Stores the exact projected cumulative accomplishment % series per project.

create table if not exists public.projected_progress_series (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  progress_date date not null,
  cumulative_percent numeric(12,4) not null default 0,
  source_label text,
  synced_at timestamptz not null default now(),
  unique(project_id, progress_date)
);

create index if not exists projected_progress_series_project_id_idx
  on public.projected_progress_series(project_id);

grant select, insert, update, delete on public.projected_progress_series to authenticated;

alter table public.projected_progress_series enable row level security;

drop policy if exists "authenticated can read projected progress series" on public.projected_progress_series;
create policy "authenticated can read projected progress series"
on public.projected_progress_series for select
to authenticated using (true);

drop policy if exists "authenticated can insert projected progress series" on public.projected_progress_series;
create policy "authenticated can insert projected progress series"
on public.projected_progress_series for insert
to authenticated with check (true);

drop policy if exists "authenticated can update projected progress series" on public.projected_progress_series;
create policy "authenticated can update projected progress series"
on public.projected_progress_series for update
to authenticated using (true) with check (true);

drop policy if exists "authenticated can delete projected progress series" on public.projected_progress_series;
create policy "authenticated can delete projected progress series"
on public.projected_progress_series for delete
to authenticated using (true);

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v25.8 exact STATUS actual + projected cumulative percentage');
  end if;
end $$;

select 'v25.8 ready' as result;
