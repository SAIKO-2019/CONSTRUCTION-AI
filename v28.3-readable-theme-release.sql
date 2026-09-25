-- CONSTRUCTION MONITORING v28.3
-- Theme palette/readability release. No destructive schema changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.3 readable earth matcha navy teal palette themes');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.3 ready' as result;
