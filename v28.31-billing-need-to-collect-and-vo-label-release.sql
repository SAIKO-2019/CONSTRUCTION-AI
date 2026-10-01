-- CONSTRUCTION MONITORING v28.31
-- UI/runtime computation + Billing/VO save fix only.
-- No schema/data migration.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.31 Billing Need-to-Collect formula + non-null Billing/VO label save fix'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.31 ready' as result;
