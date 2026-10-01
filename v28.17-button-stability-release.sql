-- CONSTRUCTION MONITORING v28.17
-- Runtime/button stability hotfix only. No schema/data changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.17 button stability + billing delete cleanup + no MutationObserver'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.17 ready' as result;
