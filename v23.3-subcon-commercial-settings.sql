-- SAIKO Construction AI v23.3
-- Subcontract commercial settings are stored per project/contract,
-- but edited only from Billing & Payments.

alter table public.projects
  add column if not exists subcon_markup_percent numeric(8,3) not null default 0,
  add column if not exists subcon_other_deductions numeric(18,2) not null default 0,
  add column if not exists subcon_deduction_notes text;

grant select, insert, update, delete on public.projects to authenticated;
notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v23.3 subcontract commercial settings in billing');
  end if;
end $$;

select 'v23.3 ready' as result;
