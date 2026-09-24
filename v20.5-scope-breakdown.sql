-- SAIKO Construction AI v20.5
-- Store project scope breakdown read from Google Sheets.

alter table public.quotation_projects
  add column if not exists scope_breakdown jsonb not null default '[]'::jsonb;

grant select, insert, update, delete on public.quotation_projects to authenticated;

select 'v20.5 scope breakdown ready' as result;
