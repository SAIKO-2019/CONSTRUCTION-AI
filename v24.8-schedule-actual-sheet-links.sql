-- SAIKO Construction AI v24.8
-- Per-project Google Sheet links for Schedule and Actual Progress.

alter table public.projects
  add column if not exists schedule_sheet_link text,
  add column if not exists actual_progress_sheet_link text,
  add column if not exists tracker_last_sync_at timestamptz;

grant select, insert, update, delete on public.projects to authenticated;
notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v24.8 live Schedule + Actual Google Sheet links');
  end if;
end $$;

select 'v24.8 ready' as result;
