-- CONSTRUCTION MONITORING v28.30
-- Safe cumulative settings/data backfill.
-- No Billing, Payment, Inventory, BOQ, Actual or Projected row is deleted.

alter table public.projects
  add column if not exists budget_retention_percent numeric(8,4) not null default 0;

alter table public.projects
  add column if not exists budget_recoupment_percent numeric(8,4) not null default 0;

alter table public.projects
  add column if not exists budget_billed_accomplishment_override numeric(8,4);

-- Apply EXISTING billing deduction rates to the per-project Budget inputs
-- only when the project-level value has not yet been set.
update public.projects p
set budget_retention_percent = x.retention_percent
from lateral (
  select b.retention_percent
  from public.billings b
  where b.project_id=p.id
    and coalesce(b.retention_amount,0)>0
    and coalesce(b.retention_percent,0)>0
  order by coalesce(b.date_request,b.date_submitted,b.created_at::date) desc nulls last,
           b.created_at desc nulls last
  limit 1
) x
where coalesce(p.budget_retention_percent,0)=0;

update public.projects p
set budget_recoupment_percent = x.recoupment_percent
from lateral (
  select b.recoupment_percent
  from public.billings b
  where b.project_id=p.id
    and coalesce(b.recoupment_amount,0)>0
    and coalesce(b.recoupment_percent,0)>0
  order by coalesce(b.date_request,b.date_submitted,b.created_at::date) desc nulls last,
           b.created_at desc nulls last
  limit 1
) x
where coalesce(p.budget_recoupment_percent,0)=0;

-- Confirmed Melendrez historical billed accomplishment baseline:
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
      'v28.30 optional Billing deductions + editable Budget rates + Dashboard Need-to-Collect cleanup'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select
  p.project_name,
  p.budget_retention_percent,
  p.budget_recoupment_percent,
  p.budget_billed_accomplishment_override
from public.projects p
order by p.project_name;
