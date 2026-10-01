-- CONSTRUCTION MONITORING v28.25
-- CUMULATIVE from v28.23.
-- Adds Budget collection settings and the historical billed-accomplishment baseline.
-- No Billing, Payment, Inventory, BOQ, Actual or Projected record is deleted.

alter table public.projects
  add column if not exists budget_retention_percent numeric(8,4) not null default 0;

alter table public.projects
  add column if not exists budget_recoupment_percent numeric(8,4) not null default 0;

alter table public.projects
  add column if not exists budget_billed_accomplishment_override numeric(8,4);

-- Confirmed historical Melendrez baseline:
-- Total accomplishment before = 47.25%, NOT 47.34%.
update public.projects
set budget_billed_accomplishment_override = 47.25
where lower(project_name) like '%melendrez%'
   or lower(project_name) like '%melendres%';

grant select,insert,update,delete on public.projects to authenticated;

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.25 retention collection baseline + Melendrez 47.25% + Add Row in GenCon/Subcon'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select
  project_name,
  budget_billed_accomplishment_override as billed_accomplishment_before,
  budget_retention_percent as retention_percent,
  budget_recoupment_percent as recoupment_percent
from public.projects
where lower(project_name) like '%melendrez%'
   or lower(project_name) like '%melendres%';
