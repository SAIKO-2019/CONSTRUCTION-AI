-- CONSTRUCTION MONITORING v28.8
-- Per-view scroll preservation + billing forecast computation.
-- No schema change.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.8 per-view scroll + DP-excluded collections + billing accumulated forecast');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.8 ready' as result;
