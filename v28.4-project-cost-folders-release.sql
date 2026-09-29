-- CONSTRUCTION MONITORING v28.4
-- Per-project Materials / Labor / Overhead Cost folder browser.
-- No schema changes. Existing inventory data remains in inventory_entries.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.4 per-project materials labor overhead cost folders');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.4 ready' as result;
