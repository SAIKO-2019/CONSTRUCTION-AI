-- CONSTRUCTION MONITORING v28.36
-- ADAPTIVE READABILITY HOTFIX — VISUAL ONLY
-- Fixes white-on-light text in Home hero / Project Pulse and strengthens
-- theme-responsive contrast/borders.
-- NO project/business data changes.
-- NO schema migration.
-- NO billing/projected/actual/inventory/quotation logic changes.
-- NO button/event-handler changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.36 adaptive readability hotfix'
    );
  end if;
end $$;

notify pgrst, 'reload schema';
select 'v28.36 ready' as result;
