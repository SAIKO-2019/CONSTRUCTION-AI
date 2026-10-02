-- CONSTRUCTION MONITORING v28.32
-- UI-only patch: hide Project Cost Folders on Projects page.
-- No schema/data migration. Existing cost records remain untouched.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.32 hide Project Cost Folders on Projects page'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.32 ready' as result;
