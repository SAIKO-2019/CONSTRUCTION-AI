-- SAIKO Construction AI v26.3
-- Stores the uploaded Projected workbook's visible sheet rows per project.

create table if not exists public.projected_sheet_snapshots (
  project_id uuid primary key references public.projects(id) on delete cascade,
  sheet_name text,
  visible_rows jsonb not null default '[]'::jsonb,
  uploaded_at timestamptz not null default now()
);

grant select, insert, update, delete on public.projected_sheet_snapshots to authenticated;

alter table public.projected_sheet_snapshots enable row level security;

drop policy if exists "authenticated read projected snapshots" on public.projected_sheet_snapshots;
create policy "authenticated read projected snapshots"
on public.projected_sheet_snapshots for select to authenticated using (true);

drop policy if exists "authenticated insert projected snapshots" on public.projected_sheet_snapshots;
create policy "authenticated insert projected snapshots"
on public.projected_sheet_snapshots for insert to authenticated with check (true);

drop policy if exists "authenticated update projected snapshots" on public.projected_sheet_snapshots;
create policy "authenticated update projected snapshots"
on public.projected_sheet_snapshots for update to authenticated using (true) with check (true);

drop policy if exists "authenticated delete projected snapshots" on public.projected_sheet_snapshots;
create policy "authenticated delete projected snapshots"
on public.projected_sheet_snapshots for delete to authenticated using (true);

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v26.3 projected file upload + actual live link');
  end if;
end $$;

select 'v26.3 ready' as result;
