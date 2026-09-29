-- CONSTRUCTION MONITORING v28.5
-- Payment history / editable payment transactions UI release.
-- Uses the existing public.payments table; no schema change required.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.5 billing add payment history editable amount and date');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.5 ready' as result;
