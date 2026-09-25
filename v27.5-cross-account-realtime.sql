-- SAIKO Construction AI v27.5
-- Cross-account live updates + release broadcast.

-- Add shared app tables to Supabase Realtime publication.
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects',
    'billings',
    'payments',
    'schedule_items',
    'actual_progress',
    'projected_progress_series',
    'actual_progress_series',
    'projected_scope_series',
    'actual_sheet_snapshots',
    'projected_sheet_snapshots'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end loop;
end $$;

-- Broadcast this release to every signed-in account/browser that is already open.
do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v27.5 cross-account realtime + shared S-curve cache');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v27.5 ready' as result;
