-- CONSTRUCTION MONITORING v28.20
-- UI/runtime edit enhancement only. No schema/data migration.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.20 full Subcon row edit + editable issued payment history'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.20 ready' as result;
