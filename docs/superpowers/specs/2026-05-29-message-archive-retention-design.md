# Message Archive Retention Design

## Goal

Add automated chat retention so group messages are exported to password-protected PDFs every 6 hours on a GMT+8 schedule, deleted only after successful export, and the resulting PDFs remain downloadable to current group members for 12 hours before being removed by the app.

## Current Context

- Chat messages are currently written directly from the browser to `public.messages`.
- The current app has no archive model, no storage bucket integration for chat exports, and no scheduled cleanup path.
- The repo already uses Supabase Postgres, TanStack `createServerFn` handlers, and a service-role server client.
- The current message UI lives in `src/routes/_authenticated/groups.$groupId.tsx`.

## Requirements

### Retention schedule

- Message deletion must happen every 6 hours.
- The schedule must be anchored to GMT+8 midnight:
  - `00:00` GMT+8
  - `06:00` GMT+8
  - `12:00` GMT+8
  - `18:00` GMT+8
- In UTC, the scheduled runs are:
  - `16:00`
  - `22:00`
  - `04:00`
  - `10:00`
- Each run processes the just-closed 6-hour window.

### Export behavior

- Before any messages are deleted, the app must export them into PDFs.
- Each export run must generate one PDF per study group that has messages in the window.
- PDFs must be password protected.
- The configured password value for deployment is `20May2026`, but that value must not be committed to git.
- The password must be supplied via runtime secret, using a server-only variable such as `MESSAGE_ARCHIVE_PDF_PASSWORD`.

### Archive visibility and lifetime

- Exported PDFs are visible only for 12 hours after creation.
- Only current members of the corresponding study group may access an archive during that 12-hour window.
- Access is based on current membership, not historical membership.
- After 12 hours, the app must delete the stored PDF and remove or expire its manifest row so it no longer appears in the UI.

## Architecture

### Backend ownership

The archive and deletion workflow will be owned by Supabase infrastructure instead of the browser client. A scheduled job will invoke a Supabase Edge Function that:

1. Determines the just-closed 6-hour window in GMT+8.
2. Loads all messages in that window.
3. Groups them by `group_id`.
4. Generates one password-protected PDF per group.
5. Uploads each PDF into a private Storage bucket.
6. Writes archive metadata into Postgres.
7. Deletes only the messages that were successfully archived.
8. Removes expired archives whose `expires_at` is older than the current run time.

This keeps retention, password handling, export generation, and deletion out of the browser.

### Scheduling model

- Use Supabase `pg_cron` to invoke the Edge Function.
- Use `pg_net` for the HTTP call from the cron job to the function endpoint.
- Store any function invocation secrets required by the cron SQL in Supabase Vault.
- The cron schedule must align with the GMT+8 anchors, even though Supabase cron expressions are evaluated in UTC.

### Storage model

- Create a private Storage bucket named `message-archives`.
- Store PDFs at deterministic paths that include the group and time window, for example:
  - `group-id/YYYY/MM/DD/2026-05-29T00-00-00+08-00_2026-05-29T06-00-00+08-00.pdf`
- The browser will never receive direct bucket paths for unrestricted use.
- Downloads will be mediated by a server function that returns a short-lived signed URL.

## Data Model

Create a `message_archives` table with these columns:

- `id uuid primary key default gen_random_uuid()`
- `group_id uuid not null references public.study_groups(id) on delete cascade`
- `window_start timestamptz not null`
- `window_end timestamptz not null`
- `storage_path text not null`
- `file_name text not null`
- `message_count integer not null`
- `created_at timestamptz not null default now()`
- `expires_at timestamptz not null`
- `status text not null`

### Data rules

- `window_start` and `window_end` define a half-open interval: `[window_start, window_end)`.
- `expires_at` is always `created_at + interval '12 hours'`.
- `status` must distinguish at least:
  - `pending`
  - `ready`
  - `failed`
  - `expired`
- Store only metadata and the storage path in Postgres.
- Do not store the PDF password in Postgres.

### Idempotency

- Archive creation must be idempotent per `group_id + window_start + window_end`.
- Re-running the same window must not create duplicate archive records or duplicate PDFs.
- The job may skip already-ready archives or replace a failed/pending attempt in a deterministic way.

## Access Control

### Archive listing

- Archive metadata shown in the UI must include only non-expired, `ready` archives for the current group.
- The UI must never list `failed` or incomplete exports as downloadable items.

### Archive download

- Add a TanStack `createServerFn` that accepts:
  - the caller access token
  - the archive id
- The handler must:
  - validate the access token
  - load the target archive
  - confirm the archive is `ready`
  - confirm `expires_at` is still in the future
  - confirm the caller is currently a member of the related group
  - return a short-lived signed URL, such as 5 minutes

### Membership rule

- If a user leaves the group before the archive expires, they immediately lose access.
- Group membership is checked at download time, not archived at export time.

## User Experience

### Chat page

- Add a lightweight `Recent archives` section in the group chat experience, either inside the chat tab or directly below it.
- Each row should show:
  - the archive window label in GMT+8
  - message count
  - expiry time
  - a download action

Example label:

- `May 29, 2026 00:00-06:00 GMT+8`

### Visibility behavior

- If there are no active archives for the group, the section should show an empty state.
- Expired archives must disappear from the list.
- Broken or failed archives must not appear as downloadable.

## Failure Handling

### Export-before-delete

- The workflow is strictly `export first, delete second`.
- If PDF generation or upload fails for a specific group, that group's messages for that window must not be deleted.

### Isolation

- Each group archive is processed independently.
- A failure for one group must not block archival and deletion for other groups in the same run.

### Status updates

- Archive rows should be created or updated so failures are visible operationally.
- Only `ready` archives are downloadable.
- Expiration cleanup should mark rows `expired` before deleting them or remove them immediately after successful file deletion, depending on whichever cleanup path is simpler and consistent.

## Verification Strategy

### In-repo testing

- This repo currently does not contain a proper automated test harness for this workflow.
- Add practical coverage for pure logic that can be tested locally, such as:
  - window boundary calculation
  - GMT+8 schedule alignment
  - archive label formatting
  - expiry filtering

### Deployment-level validation

The full workflow still requires environment validation after implementation:

1. Apply the migration.
2. Create the private Storage bucket.
3. Deploy the Edge Function.
4. Configure cron, vault secrets, and runtime secrets.
5. Seed or create test messages across multiple windows.
6. Trigger the function manually and verify:
   - one PDF per group is created
   - the PDF requires the configured password
   - archived messages are deleted only after a successful export
   - download access works for current members only
   - archives disappear and files are removed after 12 hours

## Implementation Boundaries

- Reuse the existing TanStack server function pattern for authenticated server-side archive access.
- Reuse the existing Supabase service-role client for trusted server-side operations.
- Do not move message inserts away from the current browser flow in this change unless needed for archive correctness.
- Keep the UI addition narrow and scoped to archive visibility and download.

## Deployment Prerequisites

- Set `MESSAGE_ARCHIVE_PDF_PASSWORD=20May2026` in the deployment environment.
- Create and deploy the Supabase Edge Function.
- Enable and configure any required Supabase extensions and secrets:
  - `pg_cron`
  - `pg_net`
  - Vault secret(s) for scheduled invocation
- Create the private archive Storage bucket.
- Apply the new migration for archive metadata and scheduling objects.
