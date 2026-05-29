create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

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

create or replace function public.invoke_message_archive_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  cron_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'message_archive_cron_secret'
  limit 1;

  if project_url is null or cron_secret is null then
    raise exception 'Missing vault secret(s) for message archive maintenance';
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/message-archive-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-message-archive-cron-secret', cron_secret
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
end;
$$;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'message-archive-maintenance'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end
$$;

select cron.schedule(
  'message-archive-maintenance',
  '*/15 * * * *',
  $$select public.invoke_message_archive_maintenance();$$
);
