-- SAIKO Construction AI v26.9
-- Keeps the saved Actual GSheet link/data across patches and auto-saves every live sync.

create table if not exists public.actual_sheet_snapshots (
  project_id uuid primary key references public.projects(id) on delete cascade,
  source_link text,
  visible_rows jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now()
);

grant select, insert, update, delete on public.actual_sheet_snapshots to authenticated;

alter table public.actual_sheet_snapshots enable row level security;

drop policy if exists "authenticated all actual sheet snapshots" on public.actual_sheet_snapshots;
create policy "authenticated all actual sheet snapshots"
on public.actual_sheet_snapshots
for all to authenticated
using (true)
with check (true);

-- Keep current Actual scope rows by key instead of delete-all / reinsert.
-- Existing installs normally already have this from the tracker migrations.
delete from public.actual_progress a
using public.actual_progress b
where a.project_id=b.project_id
  and lower(trim(a.activity))=lower(trim(b.activity))
  and a.ctid < b.ctid;

create unique index if not exists actual_progress_project_id_activity_key
  on public.actual_progress(project_id, activity);

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v26.9 actual continuity + autosave');
  end if;
end $$;

select 'v26.9 ready' as result;
