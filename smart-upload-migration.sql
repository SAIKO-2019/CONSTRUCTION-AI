-- SAIKO Construction AI v11 Smart Upload add-on
-- Safe to re-run. This is also included in supabase-setup.sql.

create table if not exists public.boq_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  item_no text,
  description text not null,
  unit text,
  quantity numeric(18,4) default 0,
  unit_cost numeric(18,2) default 0,
  amount numeric(18,2) default 0,
  source_file text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.boq_items to authenticated;
alter table public.boq_items enable row level security;
drop policy if exists boq_select_authenticated on public.boq_items;
drop policy if exists boq_insert_authenticated on public.boq_items;
drop policy if exists boq_update_authenticated on public.boq_items;
drop policy if exists boq_delete_authenticated on public.boq_items;
create policy boq_select_authenticated on public.boq_items for select to authenticated using (true);
create policy boq_insert_authenticated on public.boq_items for insert to authenticated with check (true);
create policy boq_update_authenticated on public.boq_items for update to authenticated using (true) with check (true);
create policy boq_delete_authenticated on public.boq_items for delete to authenticated using (true);

select 'Smart Upload add-on ready' as result;
