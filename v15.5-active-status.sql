-- SAIKO Construction AI v15.5
-- Per-user Active Status privacy toggle.

alter table public.user_preferences
  add column if not exists show_active_status boolean not null default true;

-- Presence rows are still protected by existing v14.8 RLS.
-- When a user disables Active Status, the frontend deletes that user's presence row
-- and stops publishing presence heartbeats until enabled again.

select 'SAIKO Construction AI v15.5 active status privacy ready' as result;
