-- SAIKO Construction AI v24.7
-- Explicit subcontract contract amount + subcontracted scope caption per project.

alter table public.projects
  add column if not exists subcon_contract_amount numeric(18,2) not null default 0,
  add column if not exists subcon_scope_caption text;

update public.projects
set subcon_contract_amount = coalesce(subcon_contract_amount,0);

grant select, insert, update, delete on public.projects to authenticated;
notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v24.7 subcontract contract amount + scope caption');
  end if;
end $$;

select 'v24.7 ready' as result;
