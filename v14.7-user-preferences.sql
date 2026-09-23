-- SAIKO Construction AI v14.7 - Per-user profile settings

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  theme text default 'system',
  density text default 'comfortable',
  remember_project boolean default true,
  confirm_delete boolean default true,
  daily_pending_reminder boolean default true,
  last_project_id uuid references public.projects(id) on delete set null,
  updated_at timestamptz default now()
);

grant select, insert, update, delete on public.user_preferences to authenticated;
alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_own on public.user_preferences;
create policy user_preferences_own
on public.user_preferences
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

select 'SAIKO Construction AI v14.7 user preferences ready' as result;
