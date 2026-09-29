-- CONSTRUCTION MONITORING v28.6
-- Quotation result folders + downloadable final quotation file.
-- No schema changes. Uses existing quotation_projects fields and project-files storage.

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v28.6 quotation pending awarded not-awarded folders + final pdf download');
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.6 ready' as result;
