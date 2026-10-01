-- CONSTRUCTION MONITORING v28.19
-- AUTO-MIRRORED SUBCON BILLING
--
-- One GenCon Client Billing row = one corresponding Subcontractor Billing row.
-- Existing GenCon rows are backfilled now.
-- Future GenCon rows are mirrored by database trigger automatically.
-- Subcon billing amount / retention / recoupment / payment remain manually encoded.

alter table public.billings
  add column if not exists source_gencon_billing_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='billings_source_gencon_billing_id_fkey'
      and conrelid='public.billings'::regclass
  ) then
    alter table public.billings
      add constraint billings_source_gencon_billing_id_fkey
      foreign key (source_gencon_billing_id)
      references public.billings(id)
      on delete cascade;
  end if;
end $$;

-- Match existing manual Subcon rows to existing GenCon rows one-to-one
-- when project + billing label/category already match.
with gen_ranked as (
  select
    id,
    project_id,
    coalesce(billing_no,'') as billing_no_key,
    coalesce(variation_no,'') as variation_no_key,
    coalesce(billing_category,'Billing') as category_key,
    row_number() over (
      partition by project_id,
                   coalesce(billing_no,''),
                   coalesce(variation_no,''),
                   coalesce(billing_category,'Billing')
      order by created_at nulls last, id
    ) as rn
  from public.billings
  where coalesce(billing_type,'Client Billing')='Client Billing'
),
sub_ranked as (
  select
    id,
    project_id,
    coalesce(billing_no,'') as billing_no_key,
    coalesce(variation_no,'') as variation_no_key,
    coalesce(billing_category,'Billing') as category_key,
    row_number() over (
      partition by project_id,
                   coalesce(billing_no,''),
                   coalesce(variation_no,''),
                   coalesce(billing_category,'Billing')
      order by created_at nulls last, id
    ) as rn
  from public.billings
  where billing_type='Subcontractor Billing'
    and source_gencon_billing_id is null
),
pairs as (
  select s.id as sub_id, g.id as gen_id
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
    select 1
    from public.billings x
    where x.source_gencon_billing_id=p.gen_id
  );

create unique index if not exists billings_one_subcon_per_gencon_uidx
  on public.billings(source_gencon_billing_id)
  where source_gencon_billing_id is not null;

-- Backfill a blank Subcon billing row for every existing GenCon Client Billing
-- that still does not have one.
insert into public.billings (
  project_id,
  billing_no,
  variation_no,
  billing_type,
  billing_category,
  transaction_side,
  accomplishment_percent,
  gross_amount,
  retention_applicable,
  retention_percent,
  retention_amount,
  recoupment_applicable,
  recoupment_percent,
  recoupment_amount,
  net_due,
  received_amount,
  outstanding_amount,
  date_request,
  date_submitted,
  date_paid,
  status,
  subcontractor_name,
  input_by_name,
  created_by,
  source_gencon_billing_id
)
select
  g.project_id,
  coalesce(g.billing_no,g.variation_no,'AUTO-'||left(g.id::text,8)),
  g.variation_no,
  'Subcontractor Billing',
  coalesce(g.billing_category,'Billing'),
  'payable',
  0,
  0,
  false,
  0,
  0,
  false,
  0,
  0,
  0,
  0,
  0,
  g.date_request,
  g.date_submitted,
  null,
  'Pending',
  null,
  null,
  g.created_by,
  g.id
from public.billings g
where coalesce(g.billing_type,'Client Billing')='Client Billing'
  and not exists (
    select 1
    from public.billings s
    where s.source_gencon_billing_id=g.id
  );

create or replace function public.sync_subcon_row_from_gencon()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  -- Only GenCon Client Billing rows create/maintain mirrored Subcon rows.
  if coalesce(new.billing_type,'Client Billing') <> 'Client Billing' then
    if tg_op='UPDATE'
       and coalesce(old.billing_type,'Client Billing')='Client Billing'
       and old.id is not null then
      delete from public.billings
      where source_gencon_billing_id=old.id;
    end if;
    return new;
  end if;

  update public.billings s
  set
    project_id=new.project_id,
    billing_no=coalesce(new.billing_no,new.variation_no,'AUTO-'||left(new.id::text,8)),
    variation_no=new.variation_no,
    billing_category=coalesce(new.billing_category,'Billing'),
    date_request=new.date_request,
    date_submitted=new.date_submitted,
    updated_at=now()
  where s.source_gencon_billing_id=new.id;

  if not found then
    insert into public.billings (
      project_id,
      billing_no,
      variation_no,
      billing_type,
      billing_category,
      transaction_side,
      accomplishment_percent,
      gross_amount,
      retention_applicable,
      retention_percent,
      retention_amount,
      recoupment_applicable,
      recoupment_percent,
      recoupment_amount,
      net_due,
      received_amount,
      outstanding_amount,
      date_request,
      date_submitted,
      date_paid,
      status,
      subcontractor_name,
      input_by_name,
      created_by,
      source_gencon_billing_id
    ) values (
      new.project_id,
      coalesce(new.billing_no,new.variation_no,'AUTO-'||left(new.id::text,8)),
      new.variation_no,
      'Subcontractor Billing',
      coalesce(new.billing_category,'Billing'),
      'payable',
      0,
      0,
      false,
      0,
      0,
      false,
      0,
      0,
      0,
      0,
      0,
      new.date_request,
      new.date_submitted,
      null,
      'Pending',
      null,
      null,
      new.created_by,
      new.id
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

grant select, insert, update, delete on public.billings to authenticated;

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release(
      'v28.19 auto mirror GenCon to Subcon + auto billing percent + Budget Subcon report'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select
  p.project_name,
  count(*) filter (where b.billing_type='Client Billing') as gencon_rows,
  count(*) filter (where b.billing_type='Subcontractor Billing' and b.source_gencon_billing_id is not null) as auto_linked_subcon_rows
from public.projects p
left join public.billings b on b.project_id=p.id
group by p.id,p.project_name
order by p.project_name;
