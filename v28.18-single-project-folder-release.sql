-- CONSTRUCTION MONITORING v28.18
-- UI/runtime selection model only. No schema/data changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.18 one Active Project Folder across all project modules'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.18 ready' as result;
