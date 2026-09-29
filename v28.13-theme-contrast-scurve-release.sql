-- CONSTRUCTION MONITORING v28.13
-- Visual/theme contrast hotfix only.
-- No schema, billing, inventory, payment, Actual, Projected, or budget data changes.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.13 theme-aware S-Curve + text + record contrast visibility'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.13 ready' as result;
