-- SAIKO Construction AI v24.1
-- Link each GenCon/client billing to a Subcon settlement setup.

alter table public.billings
  add column if not exists has_subcon boolean not null default false,
  add column if not exists subcon_total_deductions numeric(18,2) not null default 0,
  add column if not exists subcon_retention_percent numeric(8,3) not null default 0,
  add column if not exists subcon_recoupment_percent numeric(8,3) not null default 0;

grant select, insert, update, delete on public.billings to authenticated;
notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v24.1 linked GenCon to Subcon settlement setup');
  end if;
end $$;

select 'v24.1 ready' as result;
