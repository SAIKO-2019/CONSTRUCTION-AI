-- SAIKO Construction AI v22.5
-- Central system-release state.
-- Any future SQL/database migration should call:
--   select public.bump_system_release('short description');

create table if not exists public.system_release_state (
  id integer primary key default 1 check (id = 1),
  release_no bigint not null default 1,
  release_label text not null default 'initial',
  changed_at timestamptz not null default now()
);

insert into public.system_release_state (id, release_no, release_label)
values (1, 1, 'v22.5 baseline')
on conflict (id) do nothing;

alter table public.system_release_state enable row level security;

grant select on public.system_release_state to authenticated;

drop policy if exists system_release_state_read on public.system_release_state;
create policy system_release_state_read
on public.system_release_state
for select
to authenticated
using (true);

create or replace function public.bump_system_release(p_label text default 'system update')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_release bigint;
begin
  update public.system_release_state
     set release_no = release_no + 1,
         release_label = coalesce(nullif(trim(p_label),''),'system update'),
         changed_at = now()
   where id = 1
   returning release_no into v_release;

  if v_release is null then
    insert into public.system_release_state(id,release_no,release_label,changed_at)
    values(1,1,coalesce(nullif(trim(p_label),''),'system update'),now())
    returning release_no into v_release;
  end if;

  perform pg_notify('pgrst','reload schema');
  return v_release;
end;
$$;

revoke all on function public.bump_system_release(text) from public;
revoke all on function public.bump_system_release(text) from anon;
revoke all on function public.bump_system_release(text) from authenticated;

-- Register this migration itself as a system change.
select public.bump_system_release('v22.5 global release gate installed') as release_no;
