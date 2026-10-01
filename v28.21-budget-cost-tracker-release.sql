-- CONSTRUCTION MONITORING v28.21
-- Budget & Cost Tracker UI/runtime release only.
-- No schema or data migration.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.21 Budget Cost Tracker: BOQ + Inventory + Subcon Issued Amounts'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.21 ready' as result;
