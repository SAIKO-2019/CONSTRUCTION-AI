-- CONSTRUCTION MONITORING v28.29
-- UI/runtime action cleanup only.
-- No schema/data changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.29 one Add Issued Amount action per Subcon billing row'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.29 ready' as result;
