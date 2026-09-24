-- SAIKO Construction AI v20.6
-- Store the full parsed quotation Summary-sheet breakdown.

alter table public.quotation_projects
  add column if not exists summary_breakdown jsonb not null default '[]'::jsonb;

alter table public.quotation_projects
  add column if not exists summary_sheet_name text;

grant select, insert, update, delete on public.quotation_projects to authenticated;

select 'v20.6 summary reader ready' as result;
