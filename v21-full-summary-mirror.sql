-- SAIKO Construction AI v21
-- Stores the complete visible contents of the linked Google Sheet SUMMARY tab.

alter table public.quotation_projects
  add column if not exists summary_table jsonb not null default '[]'::jsonb;

alter table public.quotation_projects
  add column if not exists summary_headers jsonb not null default '[]'::jsonb;

grant select, insert, update, delete on public.quotation_projects to authenticated;

select 'v21 full summary mirror ready' as result;
