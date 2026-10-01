-- CONSTRUCTION MONITORING v28.22
-- CUMULATIVE SAFE MIGRATION from v28.18+
-- No existing Inventory, Billing, Payment, BOQ, Actual or Projected row is deleted.

-- =========================================================
-- A) GenCon -> Subcon one-to-one mirror
-- =========================================================
alter table public.billings
  add column if not exists source_gencon_billing_id uuid;

-- Preserve historical Subcon row when GenCon is deleted.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid='public.billings'::regclass
      and contype='f'
      and pg_get_constraintdef(oid) ilike '%source_gencon_billing_id%'
  loop
    execute format('alter table public.billings drop constraint %I',r.conname);
  end loop;
end $$;

alter table public.billings
  add constraint billings_source_gencon_billing_id_fkey
  foreign key (source_gencon_billing_id)
  references public.billings(id)
  on delete set null;

-- Link matching existing manual Subcon rows first.
with gen_ranked as (
  select id,project_id,
         coalesce(billing_no,'') billing_no_key,
         coalesce(variation_no,'') variation_no_key,
         coalesce(billing_category,'Billing') category_key,
         row_number() over (
           partition by project_id,coalesce(billing_no,''),coalesce(variation_no,''),coalesce(billing_category,'Billing')
           order by created_at nulls last,id
         ) rn
  from public.billings
  where coalesce(billing_type,'Client Billing')='Client Billing'
),
sub_ranked as (
  select id,project_id,
         coalesce(billing_no,'') billing_no_key,
         coalesce(variation_no,'') variation_no_key,
         coalesce(billing_category,'Billing') category_key,
         row_number() over (
           partition by project_id,coalesce(billing_no,''),coalesce(variation_no,''),coalesce(billing_category,'Billing')
           order by created_at nulls last,id
         ) rn
  from public.billings
  where billing_type='Subcontractor Billing'
    and source_gencon_billing_id is null
),
pairs as (
  select s.id sub_id,g.id gen_id
  from gen_ranked g
  join sub_ranked s
    on s.project_id=g.project_id
   and s.billing_no_key=g.billing_no_key
   and s.variation_no_key=g.variation_no_key
   and s.category_key=g.category_key
   and s.rn=g.rn
)
update public.billings b
set source_gencon_billing_id=p.gen_id
from pairs p
where b.id=p.sub_id
  and not exists (
    select 1 from public.billings x
    where x.source_gencon_billing_id=p.gen_id
  );

create unique index if not exists billings_one_subcon_per_gencon_uidx
  on public.billings(source_gencon_billing_id)
  where source_gencon_billing_id is not null;

-- Add a blank Subcon row for each existing GenCon row still missing one.
insert into public.billings (
  project_id,billing_no,variation_no,billing_type,billing_category,transaction_side,
  accomplishment_percent,gross_amount,retention_applicable,retention_percent,retention_amount,
  recoupment_applicable,recoupment_percent,recoupment_amount,net_due,received_amount,
  outstanding_amount,date_request,date_submitted,date_paid,status,subcontractor_name,
  input_by_name,created_by,source_gencon_billing_id
)
select
  g.project_id,
  coalesce(g.billing_no,g.variation_no,'AUTO-'||left(g.id::text,8)),
  g.variation_no,
  'Subcontractor Billing',
  coalesce(g.billing_category,'Billing'),
  'payable',
  0,0,false,0,0,false,0,0,0,0,0,
  g.date_request,g.date_submitted,null,'Pending',null,null,g.created_by,g.id
from public.billings g
where coalesce(g.billing_type,'Client Billing')='Client Billing'
  and not exists (
    select 1 from public.billings s
    where s.source_gencon_billing_id=g.id
  );

create or replace function public.sync_subcon_row_from_gencon()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(new.billing_type,'Client Billing') <> 'Client Billing' then
    return new;
  end if;

  update public.billings s
  set project_id=new.project_id,
      billing_no=coalesce(new.billing_no,new.variation_no,'AUTO-'||left(new.id::text,8)),
      variation_no=new.variation_no,
      billing_category=coalesce(new.billing_category,'Billing'),
      date_request=new.date_request,
      date_submitted=new.date_submitted
  where s.source_gencon_billing_id=new.id;

  if not found then
    insert into public.billings (
      project_id,billing_no,variation_no,billing_type,billing_category,transaction_side,
      accomplishment_percent,gross_amount,retention_applicable,retention_percent,retention_amount,
      recoupment_applicable,recoupment_percent,recoupment_amount,net_due,received_amount,
      outstanding_amount,date_request,date_submitted,date_paid,status,subcontractor_name,
      input_by_name,created_by,source_gencon_billing_id
    ) values (
      new.project_id,
      coalesce(new.billing_no,new.variation_no,'AUTO-'||left(new.id::text,8)),
      new.variation_no,
      'Subcontractor Billing',
      coalesce(new.billing_category,'Billing'),
      'payable',
      0,0,false,0,0,false,0,0,0,0,0,
      new.date_request,new.date_submitted,null,'Pending',null,null,new.created_by,new.id
    );
  end if;

  return new;
end $$;

drop trigger if exists trg_billings_auto_subcon_insert on public.billings;
create trigger trg_billings_auto_subcon_insert
after insert on public.billings
for each row
execute function public.sync_subcon_row_from_gencon();

drop trigger if exists trg_billings_auto_subcon_update on public.billings;
create trigger trg_billings_auto_subcon_update
after update of project_id,billing_no,variation_no,billing_category,billing_type,date_request,date_submitted
on public.billings
for each row
execute function public.sync_subcon_row_from_gencon();

-- =========================================================
-- B) Exact workbook-style editable Budget Tracker fields
-- =========================================================
alter table public.projects add column if not exists budget_project_manager text;
alter table public.projects add column if not exists budget_project_address text;
alter table public.projects add column if not exists budget_progress_override numeric(8,2);
alter table public.projects add column if not exists budget_hide_empty_rows boolean not null default false;
alter table public.projects add column if not exists budget_vat_percent numeric(8,4) not null default 0;
alter table public.projects add column if not exists budget_misc_percent numeric(8,4) not null default 0;
alter table public.projects add column if not exists budget_discount_percent numeric(12,6);

alter table public.boq_items add column if not exists phase_name text;
alter table public.boq_items add column if not exists markup_percent numeric(12,6) not null default 0;
alter table public.boq_items add column if not exists actual_cost_adjustment numeric(18,2) not null default 0;
alter table public.boq_items add column if not exists display_order integer not null default 0;

-- Sensible initial phase for existing BOQ rows without a phase.
update public.boq_items
set phase_name='GENERAL REQUIREMENTS'
where nullif(trim(coalesce(phase_name,'')),'') is null;

grant select,insert,update,delete on public.projects to authenticated;
grant select,insert,update,delete on public.boq_items to authenticated;
grant select,insert,update,delete on public.billings to authenticated;

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.22 exact Excel Budget Cost Tracker + collection formulas + Inventory Add Row'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select 'v28.22 ready' as result;
