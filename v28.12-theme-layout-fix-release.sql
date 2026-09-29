-- CONSTRUCTION MONITORING v28.12
-- Theme layout hotfix only. No schema changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.12 theme layout fix: fixed sidebar + topbar restored while keeping architectural backgrounds'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.12 ready' as result;
