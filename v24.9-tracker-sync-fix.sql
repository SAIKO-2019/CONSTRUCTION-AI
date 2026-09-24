-- SAIKO Construction AI v24.9
-- Tracker sync compatibility / performance safeguards.

-- Remove accidental duplicate Actual Progress rows before enforcing uniqueness.
-- Keeps the newest row for each exact project/activity pair.
delete from public.actual_progress a
using public.actual_progress b
where a.project_id = b.project_id
  and a.activity = b.activity
  and a.updated_at < b.updated_at;

-- If equal timestamps still left duplicates, keep the lexicographically first UUID.
delete from public.actual_progress a
using public.actual_progress b
where a.project_id = b.project_id
  and a.activity = b.activity
  and a.updated_at = b.updated_at
  and a.id::text > b.id::text;

create unique index if not exists actual_progress_project_id_activity_key
  on public.actual_progress(project_id, activity);

create index if not exists schedule_items_project_id_idx
  on public.schedule_items(project_id);
create index if not exists actual_progress_project_id_idx
  on public.actual_progress(project_id);

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v24.9 Schedule/Actual live sync fixes');
  end if;
end $$;

select 'v24.9 tracker sync ready' as result;
