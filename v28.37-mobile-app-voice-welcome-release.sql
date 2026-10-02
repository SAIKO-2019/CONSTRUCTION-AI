-- CONSTRUCTION MONITORING v28.37
-- MOBILE PWA + VOICE WELCOME RELEASE MARKER
-- NO project/business data changes.
-- NO Supabase schema/data migration.
-- NO billing/projected/actual/inventory/quotation calculation changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.37 Mobile PWA + voice welcome'
    );
  end if;
end $$;

notify pgrst, 'reload schema';
select 'v28.37 ready' as result;
