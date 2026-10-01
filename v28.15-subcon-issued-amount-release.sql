-- CONSTRUCTION MONITORING v28.15
-- Runtime/UI patch only.
-- No schema change.
-- Subcontractor Billing now uses the existing payments table as dated
-- "Issued Amount" transactions, exactly like GenCon payments.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.15 Subcon Billing per-billing Issued Amount + Paid/Balance/Status sync'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.15 ready' as result;
