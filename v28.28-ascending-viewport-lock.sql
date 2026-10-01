-- CONSTRUCTION MONITORING v28.28
-- Safe cumulative settings release.
-- No Billing, Payment, Inventory, BOQ, Actual or Projected record is deleted.

alter table public.projects
  add column if not exists budget_retention_percent numeric(8,4) not null default 0;

alter table public.projects
  add column if not exists budget_recoupment_percent numeric(8,4) not null default 0;

alter table public.projects
  add column if not exists budget_billed_accomplishment_override numeric(8,4);

-- Confirmed Melendrez historical billed accomplishment:
-- 47.25%, not 47.34%.
update public.projects
set budget_billed_accomplishment_override=47.25
where lower(project_name) like '%melendrez%'
   or lower(project_name) like '%melendres%';

grant select,insert,update,delete on public.projects to authenticated;

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.28 ascending Billing order + stable viewport + capped collection'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.28 ready' as result;
