-- SAIKO Construction AI v23.2
-- Editable billing records + subcontractor issued details

-- Keep v23.0 field compatible even if that migration has not been run yet.
alter table public.projects
  add column if not exists subcon_dependency text not null default 'Independent';

alter table public.billings
  add column if not exists subcontractor_name text,
  add column if not exists issued_date date,
  add column if not exists issued_amount numeric(18,2) default 0,
  add column if not exists subcontract_balance numeric(18,2) default 0;

grant select, insert, update, delete on public.billings to authenticated;

notify pgrst, 'reload schema';

-- Register as a real system patch when the global release gate exists.
do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v23.2 billing edit + subcontract issued details + page persistence');
  end if;
end $$;

select 'v23.2 ready' as result;
