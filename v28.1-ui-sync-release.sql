-- SAIKO Construction AI v28.1
-- UI + cross-account release broadcast. No destructive schema change.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.1 login redesign + home control center + projected delete + wider realtime sync');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.1 ready' as result;
