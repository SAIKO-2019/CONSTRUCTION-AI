-- SAIKO Construction AI v28.0
-- UI/Home/Profile/Login release broadcast.
-- No destructive schema changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.0 home + project dashboard + editable profile + login redesign');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.0 ready' as result;
