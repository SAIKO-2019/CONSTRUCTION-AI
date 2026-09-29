-- Construction Monitoring v28.11
do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.11 architectural theme backgrounds + unified live PHP financial control');
  end if;
end $$;
notify pgrst, 'reload schema';
select 'v28.11 ready' as result;
