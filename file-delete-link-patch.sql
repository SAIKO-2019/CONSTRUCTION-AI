-- SAIKO Construction AI v12.1 - link imported rows to their source project file
-- Safe to run on the existing v12 database. No existing operational data is deleted.

alter table public.boq_items add column if not exists source_file_id uuid references public.project_files(id) on delete set null;
alter table public.schedule_items add column if not exists source_file text;
alter table public.schedule_items add column if not exists source_file_id uuid references public.project_files(id) on delete set null;
alter table public.billings add column if not exists source_file text;
alter table public.billings add column if not exists source_file_id uuid references public.project_files(id) on delete set null;
alter table public.variation_orders add column if not exists source_file_id uuid references public.project_files(id) on delete set null;
alter table public.actual_progress add column if not exists source_file text;
alter table public.actual_progress add column if not exists source_file_id uuid references public.project_files(id) on delete set null;

grant select, insert, update, delete on public.boq_items to authenticated;
grant select, insert, update, delete on public.schedule_items to authenticated;
grant select, insert, update, delete on public.billings to authenticated;
grant select, insert, update, delete on public.variation_orders to authenticated;
grant select, insert, update, delete on public.actual_progress to authenticated;
grant select, insert, update, delete on public.project_files to authenticated;

select 'Project file delete/link support ready' as result;
