-- CONSTRUCTION MONITORING v28.16
-- Cumulative runtime hotfix only. No schema/data changes.
-- Re-ships the Billing null-render fix with the current Subcon Issued Amount workflow.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.16 cumulative billing null-render fix + Subcon issued amount workflow'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.16 ready' as result;
