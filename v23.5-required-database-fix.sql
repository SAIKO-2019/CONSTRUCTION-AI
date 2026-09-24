-- SAIKO Construction AI v23.5
-- Consolidated database fix for Project Subcon + Billing/Subcon fields.

alter table public.projects
  add column if not exists subcon_dependency text not null default 'Independent',
  add column if not exists subcon_markup_percent numeric(8,3) not null default 0,
  add column if not exists subcon_other_deductions numeric(18,2) not null default 0,
  add column if not exists subcon_deduction_notes text;

alter table public.billings
  add column if not exists subcontractor_name text,
  add column if not exists issued_date date,
  add column if not exists issued_amount numeric(18,2) default 0,
  add column if not exists subcontract_balance numeric(18,2) default 0;

update public.projects
set subcon_dependency='Independent'
where subcon_dependency is null or trim(subcon_dependency)='';

alter table public.projects
  drop constraint if exists projects_subcon_dependency_check;

alter table public.projects
  add constraint projects_subcon_dependency_check
  check (subcon_dependency in ('Dependent','Independent'));

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.billings to authenticated;

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v23.5 consolidated billing schema fix');
  end if;
end $$;

select 'v23.5 database ready' as result;
