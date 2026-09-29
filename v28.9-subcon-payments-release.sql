-- CONSTRUCTION MONITORING v28.9
-- Subcon total payable + payment history/actions.
-- No schema change. Reuses existing billings + payments tables.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.9 subcon total amount + add/edit dated payments');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.9 ready' as result;
