-- SAIKO Construction AI v23.0
-- Add project subcontract dependency category

alter table public.projects
  add column if not exists subcon_dependency text not null default 'Independent';

update public.projects
set subcon_dependency = 'Independent'
where subcon_dependency is null or trim(subcon_dependency) = '';

alter table public.projects
  drop constraint if exists projects_subcon_dependency_check;

alter table public.projects
  add constraint projects_subcon_dependency_check
  check (subcon_dependency in ('Dependent','Independent'));

notify pgrst, 'reload schema';

-- Trigger global release gate if v22.5+ migration is installed.
do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v23.0 project subcontract dependency category');
  end if;
end $$;
