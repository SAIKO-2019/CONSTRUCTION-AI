-- SAIKO Construction AI v24.2
-- Make all new features work with EXISTING records.
-- No delete/re-create/re-upload should be needed.

alter table public.billings
  add column if not exists has_subcon boolean not null default false,
  add column if not exists subcon_total_deductions numeric(18,2) not null default 0,
  add column if not exists subcon_retention_percent numeric(8,3) not null default 0,
  add column if not exists subcon_recoupment_percent numeric(8,3) not null default 0,
  add column if not exists subcontractor_name text,
  add column if not exists issued_date date,
  add column if not exists issued_amount numeric(18,2) default 0,
  add column if not exists subcontract_balance numeric(18,2) default 0;

alter table public.projects
  add column if not exists subcon_dependency text not null default 'Independent',
  add column if not exists subcon_markup_percent numeric(8,3) not null default 0,
  add column if not exists subcon_other_deductions numeric(18,2) not null default 0,
  add column if not exists subcon_deduction_notes text;

-- Backfill all existing rows with safe defaults.
update public.billings
set
  has_subcon = coalesce(has_subcon,false),
  subcon_total_deductions = coalesce(subcon_total_deductions,0),
  subcon_retention_percent = coalesce(subcon_retention_percent,0),
  subcon_recoupment_percent = coalesce(subcon_recoupment_percent,0),
  issued_amount = coalesce(issued_amount,0),
  subcontract_balance = coalesce(subcontract_balance,0);

update public.projects
set
  subcon_dependency = coalesce(nullif(trim(subcon_dependency),''),'Independent'),
  subcon_markup_percent = coalesce(subcon_markup_percent,0),
  subcon_other_deductions = coalesce(subcon_other_deductions,0);

grant select, insert, update, delete on public.billings to authenticated;
grant select, insert, update, delete on public.projects to authenticated;

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v24.2 existing-record live compatibility');
  end if;
end $$;

select 'v24.2 existing records ready' as result;
