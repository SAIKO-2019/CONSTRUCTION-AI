-- CONSTRUCTION MONITORING v28.33
-- VISUAL ONLY: cinematic animated theme effects + v28.32 Project Cost Folders UI hide.
-- NO project/business data migration. NO schema change.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.33 cinematic live theme effects + Project Cost Folders UI hide'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.33 ready' as result;
