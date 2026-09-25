-- CONSTRUCTION MONITORING v28.2
-- UI branding, Actual clear-data control, and theme readability release.
-- No destructive schema changes are introduced here.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.2 construction monitoring brand + actual clear data + theme readability');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.2 ready' as result;
