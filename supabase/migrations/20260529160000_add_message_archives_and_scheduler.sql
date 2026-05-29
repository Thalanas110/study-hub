create table public.message_archives (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  storage_path text not null,
  file_name text not null,
  message_count integer not null check (message_count >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed', 'expired')),
  unique (group_id, window_start, window_end),
  check (window_end > window_start),
  check (expires_at > created_at)
);

create index idx_message_archives_group_window
  on public.message_archives (group_id, window_start desc);

create index idx_message_archives_expires_at
  on public.message_archives (expires_at);

grant select on public.message_archives to authenticated;
grant all on public.message_archives to service_role;

alter table public.message_archives enable row level security;

create policy "Members view active message archives"
on public.message_archives
for select
to authenticated
using (
  status = 'ready'
  and expires_at > now()
  and public.is_group_member(group_id)
);

insert into storage.buckets (id, name, public)
values ('message-archives', 'message-archives', false)
on conflict (id) do nothing;

-- Scheduling is configured outside this migration.
--
-- The original SQL job used Supabase Vault to inject the cron secret into a
-- pg_net HTTP call, but some environments do not ship the vault extension.
-- To keep this migration portable, create the scheduled invocation in the
-- Supabase Dashboard or your deployment automation instead.
--
-- Use these settings for the scheduled request:
--   endpoint: /functions/v1/message-archive-maintenance
--   method: POST
--   schedule: every 15 minutes
--   header: x-message-archive-cron-secret = <MESSAGE_ARCHIVE_CRON_SECRET>
--   body: {"trigger":"cron"}
