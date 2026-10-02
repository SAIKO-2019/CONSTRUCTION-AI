-- CONSTRUCTION MONITORING v28.34
-- VISUAL-ONLY HOTFIX:
--   1) improve readability/contrast across all themes
--   2) animate the left sidebar background/effects per theme
-- NO project/business data changes
-- NO schema migration
-- NO calculation/button/event-handler changes

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.34 readability + live animated sidebar theme effects'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.34 ready' as result;
