-- SAIKO Construction AI v27.0
-- Keeps current Actual scope rows canonical while preserving historical Actual series.

-- No destructive reset. Existing actual_progress_series history is preserved.
-- The runtime selectively removes only stale non-canonical current-state rows
-- after a successful live sync.

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v27.0 exact actual scope sync + workday reminders + new themes');
  end if;
end $$;

select 'v27.0 ready' as result;
