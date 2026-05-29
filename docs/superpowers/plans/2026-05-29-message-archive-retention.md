# Message Archive Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase-managed archive pipeline that exports each group's chat messages to password-protected PDFs every 6 hours on a GMT+8 schedule, deletes archived messages only after a successful export, and exposes each PDF to current group members for 12 hours.

**Architecture:** Keep message writes on the current browser-to-Supabase path, but move retention, export, PDF generation, and cleanup into a scheduled Supabase Edge Function. Expose archive metadata through a new `message_archives` table with RLS-based listing, and use one TanStack `createServerFn` to issue short-lived signed download URLs after a membership check.

**Tech Stack:** Supabase Postgres, Supabase Storage, Supabase Edge Functions (Deno), TanStack Start `createServerFn`, React 19, TypeScript

---

## File Map

| File | Purpose |
| --- | --- |
| `supabase/migrations/20260529160000_add_message_archives_and_scheduler.sql` | Archive table, RLS, storage bucket, cron trigger |
| `supabase/config.toml` | Function config for cron-only Edge Function invocation |
| `supabase/functions/_shared/message-archive-window.ts` | GMT+8 window, expiry, path, and label helpers for the function |
| `supabase/functions/_shared/message-archive-pdf.ts` | Password-protected PDF rendering helper |
| `supabase/functions/message-archive-maintenance/index.ts` | Scheduled archive/export/delete entrypoint |
| `supabase/functions/tests/message-archive-window-test.ts` | Deno tests for window, label, expiry, and visibility helpers |
| `supabase/functions/tests/message-archive-pdf-test.ts` | Deno smoke test for PDF generation |
| `src/integrations/supabase/types.ts` | Local stopgap type patch for `message_archives` |
| `src/lib/message-archives.ts` | UI-safe archive label and expiry helpers |
| `src/lib/api/message-archive.functions.ts` | Signed download URL server function |
| `src/routes/_authenticated/groups.$groupId.tsx` | Archive listing UI, download action, and message delete invalidation |

---

### Task 1: Add Archive Schema, Bucket, and Cron Wiring

**Files:**
- Create: `supabase/migrations/20260529160000_add_message_archives_and_scheduler.sql`
- Modify: `supabase/config.toml`

**Dependencies:** Existing `public.is_group_member()` helper from `supabase/migrations/20260529015329_ec3b4d75-2dbd-4a7a-b602-4be83265d2b9.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260529160000_add_message_archives_and_scheduler.sql` with:

```sql
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
  status text not null check (status in ('pending', 'ready', 'failed', 'expired')),
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
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/message-archive-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-message-archive-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'message_archive_cron_secret')
    ),
    body := '{"trigger":"cron"}'::jsonb
  );
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'message-archive-maintenance') then
    perform cron.unschedule('message-archive-maintenance');
  end if;
end
$$;

select cron.schedule(
  'message-archive-maintenance',
  '0 4,10,16,22 * * *',
  $$select public.invoke_message_archive_maintenance();$$
);
```

- [ ] **Step 2: Configure the function as secret-header only**

Append this block to `supabase/config.toml`:

```toml
[functions.message-archive-maintenance]
verify_jwt = false
```

- [ ] **Step 3: Apply the migration locally**

Run:

```bash
supabase db push
```

Expected: the migration applies cleanly and the CLI reports the database is up to date.

- [ ] **Step 4: Commit the schema and config changes**

Run:

```bash
git add supabase/migrations/20260529160000_add_message_archives_and_scheduler.sql supabase/config.toml
git commit -m "feat: add archive schema and scheduler"
```

---

### Task 2: Add Pure Archive Helpers and Failing Deno Tests

**Files:**
- Create: `supabase/functions/_shared/message-archive-window.ts`
- Create: `src/lib/message-archives.ts`
- Create: `supabase/functions/tests/message-archive-window-test.ts`

**Dependencies:** None

- [ ] **Step 1: Write the failing helper test first**

Create `supabase/functions/tests/message-archive-window-test.ts` with:

```ts
import { assertEquals } from "jsr:@std/assert@1";
import {
  buildArchiveStoragePath,
  formatArchiveWindowLabel as formatBackendWindowLabel,
  getArchiveExpiry,
  getArchiveWindow,
} from "../_shared/message-archive-window.ts";
import {
  formatArchiveExpiryLabel,
  formatArchiveWindowLabel,
  isArchiveVisible,
} from "../../src/lib/message-archives.ts";

Deno.test("aligns a 06:00 GMT+8 run to the midnight-to-06:00 window", () => {
  const { windowStart, windowEnd } = getArchiveWindow(new Date("2026-05-28T22:00:00.000Z"));

  assertEquals(windowStart.toISOString(), "2026-05-28T16:00:00.000Z");
  assertEquals(windowEnd.toISOString(), "2026-05-28T22:00:00.000Z");
});

Deno.test("builds a deterministic storage path in GMT+8", () => {
  const path = buildArchiveStoragePath(
    "group-123",
    new Date("2026-05-28T16:00:00.000Z"),
    new Date("2026-05-28T22:00:00.000Z"),
  );

  assertEquals(
    path,
    "group-123/2026/05/29/2026-05-29T00-00-00+08-00_2026-05-29T06-00-00+08-00.pdf",
  );
});

Deno.test("adds 12 hours to compute archive expiry", () => {
  const expiresAt = getArchiveExpiry(new Date("2026-05-29T00:00:00.000Z"));
  assertEquals(expiresAt.toISOString(), "2026-05-29T12:00:00.000Z");
});

Deno.test("formats the same GMT+8 label in the backend and UI helpers", () => {
  const windowStart = "2026-05-28T16:00:00.000Z";
  const windowEnd = "2026-05-28T22:00:00.000Z";

  assertEquals(formatBackendWindowLabel(windowStart, windowEnd), "May 29, 2026 00:00-06:00 GMT+8");
  assertEquals(formatArchiveWindowLabel(windowStart, windowEnd), "May 29, 2026 00:00-06:00 GMT+8");
});

Deno.test("hides expired archives and formats expiry labels in GMT+8", () => {
  assertEquals(isArchiveVisible("2026-05-29T10:00:01.000Z", new Date("2026-05-29T10:00:00.000Z")), true);
  assertEquals(isArchiveVisible("2026-05-29T09:59:59.000Z", new Date("2026-05-29T10:00:00.000Z")), false);
  assertEquals(
    formatArchiveExpiryLabel("2026-05-29T12:00:00.000Z"),
    "Expires May 29, 2026 20:00 GMT+8",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
deno test supabase/functions/tests/message-archive-window-test.ts
```

Expected: FAIL because `message-archive-window.ts` and `src/lib/message-archives.ts` do not exist yet.

- [ ] **Step 3: Create the backend helper module**

Create `supabase/functions/_shared/message-archive-window.ts` with:

```ts
const GMT_PLUS_EIGHT_OFFSET_MS = 8 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const GMT_PLUS_EIGHT_TIME_ZONE = "Asia/Singapore";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toGmtPlusEightDate(dateLike: string | Date) {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return new Date(date.getTime() + GMT_PLUS_EIGHT_OFFSET_MS);
}

function getTimeParts(dateLike: string | Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: GMT_PLUS_EIGHT_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(typeof dateLike === "string" ? new Date(dateLike) : dateLike);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    month: map.month,
    day: map.day,
    year: map.year,
    hour: map.hour,
    minute: map.minute,
  };
}

function toStamp(date: Date) {
  const shifted = toGmtPlusEightDate(date);
  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
  ].join("-") + `T${pad(shifted.getUTCHours())}-${pad(shifted.getUTCMinutes())}-${pad(shifted.getUTCSeconds())}+08-00`;
}

export function getArchiveWindow(runAt = new Date()) {
  const shiftedMs = runAt.getTime() + GMT_PLUS_EIGHT_OFFSET_MS;
  const alignedWindowEndMs = Math.floor(shiftedMs / SIX_HOURS_MS) * SIX_HOURS_MS - GMT_PLUS_EIGHT_OFFSET_MS;

  return {
    windowStart: new Date(alignedWindowEndMs - SIX_HOURS_MS),
    windowEnd: new Date(alignedWindowEndMs),
  };
}

export function getArchiveExpiry(createdAt = new Date()) {
  return new Date(createdAt.getTime() + TWELVE_HOURS_MS);
}

export function buildArchiveFileName(windowStart: Date, windowEnd: Date) {
  return `${toStamp(windowStart)}_${toStamp(windowEnd)}.pdf`;
}

export function buildArchiveStoragePath(groupId: string, windowStart: Date, windowEnd: Date) {
  const shifted = toGmtPlusEightDate(windowStart);
  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());

  return `${groupId}/${year}/${month}/${day}/${buildArchiveFileName(windowStart, windowEnd)}`;
}

export function formatArchiveWindowLabel(windowStartIso: string, windowEndIso: string) {
  const start = getTimeParts(windowStartIso);
  const end = getTimeParts(windowEndIso);
  return `${start.month} ${start.day}, ${start.year} ${start.hour}:${start.minute}-${end.hour}:${end.minute} GMT+8`;
}
```

- [ ] **Step 4: Create the UI helper module**

Create `src/lib/message-archives.ts` with:

```ts
const GMT_PLUS_EIGHT_TIME_ZONE = "Asia/Singapore";

function getTimeParts(dateLike: string | Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: GMT_PLUS_EIGHT_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(typeof dateLike === "string" ? new Date(dateLike) : dateLike);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function formatArchiveWindowLabel(windowStartIso: string, windowEndIso: string) {
  const start = getTimeParts(windowStartIso);
  const end = getTimeParts(windowEndIso);

  return `${start.month} ${start.day}, ${start.year} ${start.hour}:${start.minute}-${end.hour}:${end.minute} GMT+8`;
}

export function formatArchiveExpiryLabel(expiresAtIso: string) {
  const expires = getTimeParts(expiresAtIso);
  return `Expires ${expires.month} ${expires.day}, ${expires.year} ${expires.hour}:${expires.minute} GMT+8`;
}

export function isArchiveVisible(expiresAtIso: string, now = new Date()) {
  return new Date(expiresAtIso).getTime() > now.getTime();
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
deno test supabase/functions/tests/message-archive-window-test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the helpers and tests**

Run:

```bash
git add supabase/functions/_shared/message-archive-window.ts supabase/functions/tests/message-archive-window-test.ts src/lib/message-archives.ts
git commit -m "test: add archive window helper coverage"
```

---

### Task 3: Build the PDF Helper and Scheduled Edge Function

**Files:**
- Create: `supabase/functions/_shared/message-archive-pdf.ts`
- Create: `supabase/functions/message-archive-maintenance/index.ts`
- Create: `supabase/functions/tests/message-archive-pdf-test.ts`

**Dependencies:** `supabase/functions/_shared/message-archive-window.ts`, `src/lib/message-archives.ts`

- [ ] **Step 1: Write the PDF smoke test first**

Create `supabase/functions/tests/message-archive-pdf-test.ts` with:

```ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { renderArchivePdf } from "../_shared/message-archive-pdf.ts";

Deno.test("renderArchivePdf returns a non-empty PDF document", async () => {
  const pdf = await renderArchivePdf({
    groupName: "Algorithms",
    windowLabel: "May 29, 2026 00:00-06:00 GMT+8",
    messageCount: 2,
    userPassword: "20May2026",
    messages: [
      { createdAtLabel: "00:15", authorName: "Ada", content: "Need help with Dijkstra." },
      { createdAtLabel: "00:17", authorName: "Grace", content: "Let's review the heap invariant." },
    ],
  });

  assert(pdf.byteLength > 512);
  assertEquals(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
deno test supabase/functions/tests/message-archive-pdf-test.ts
```

Expected: FAIL because `message-archive-pdf.ts` does not exist yet.

- [ ] **Step 3: Create the PDF rendering helper**

Create `supabase/functions/_shared/message-archive-pdf.ts` with:

```ts
import PDFDocument from "npm:pdfkit@0.17.2";
import { Buffer } from "node:buffer";

type ArchiveMessage = {
  createdAtLabel: string;
  authorName: string;
  content: string;
};

type RenderArchivePdfInput = {
  groupName: string;
  windowLabel: string;
  messageCount: number;
  userPassword: string;
  messages: ArchiveMessage[];
};

export async function renderArchivePdf(input: RenderArchivePdfInput) {
  const doc = new PDFDocument({
    margin: 48,
    pdfVersion: "1.7ext3",
    userPassword: input.userPassword,
    ownerPassword: input.userPassword,
    permissions: {
      printing: "lowResolution",
      modifying: false,
      copying: false,
    },
  });

  const chunks: Uint8Array[] = [];

  return await new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text(input.groupName);
    doc.moveDown(0.25);
    doc.fontSize(11).fillColor("#4b5563").text(input.windowLabel);
    doc.text(`${input.messageCount} messages archived`);
    doc.moveDown();

    doc.fillColor("#111827");
    for (const message of input.messages) {
      doc.fontSize(10).fillColor("#6b7280").text(`${message.createdAtLabel}  ${message.authorName}`);
      doc.moveDown(0.15);
      doc.fontSize(11).fillColor("#111827").text(message.content, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      });
      doc.moveDown();
    }

    doc.end();
  });
}
```

- [ ] **Step 4: Create the archive maintenance function**

Create `supabase/functions/message-archive-maintenance/index.ts` with:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildArchiveFileName,
  buildArchiveStoragePath,
  formatArchiveWindowLabel,
  getArchiveExpiry,
  getArchiveWindow,
} from "../_shared/message-archive-window.ts";
import { renderArchivePdf } from "../_shared/message-archive-pdf.ts";

type MessageRow = {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type GroupRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  user_id: string;
  display_name: string;
};

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function cleanupExpiredArchives(supabase: ReturnType<typeof createClient>, nowIso: string) {
  const { data: expiredArchives, error } = await supabase
    .from("message_archives")
    .select("id, storage_path")
    .lte("expires_at", nowIso)
    .in("status", ["ready", "failed", "expired"]);

  if (error) throw error;
  if (!expiredArchives?.length) return 0;

  const storagePaths = expiredArchives
    .map((archive) => archive.storage_path)
    .filter((value): value is string => Boolean(value));

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("message-archives").remove(storagePaths);
    if (storageError) throw storageError;
  }

  const archiveIds = expiredArchives.map((archive) => archive.id);
  const { error: deleteError } = await supabase
    .from("message_archives")
    .delete()
    .in("id", archiveIds);

  if (deleteError) throw deleteError;
  return archiveIds.length;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (req.headers.get("x-message-archive-cron-secret") !== requireEnv("MESSAGE_ARCHIVE_CRON_SECRET")) {
    return json(401, { error: "Unauthorized" });
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const now = new Date();
  const nowIso = now.toISOString();
  const { windowStart, windowEnd } = getArchiveWindow(now);
  const windowStartIso = windowStart.toISOString();
  const windowEndIso = windowEnd.toISOString();

  const expiredCount = await cleanupExpiredArchives(supabase, nowIso);

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, group_id, user_id, content, created_at")
    .gte("created_at", windowStartIso)
    .lt("created_at", windowEndIso)
    .order("created_at", { ascending: true });

  if (messagesError) return json(500, { error: messagesError.message });
  if (!messages?.length) {
    return json(200, {
      expiredCount,
      windowStart: windowStartIso,
      windowEnd: windowEndIso,
      processedGroups: [],
      failedGroups: [],
    });
  }

  const groupIds = [...new Set(messages.map((message) => message.group_id))];
  const userIds = [...new Set(messages.map((message) => message.user_id))];

  const [{ data: groups, error: groupsError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase.from("study_groups").select("id, name").in("id", groupIds),
    supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
  ]);

  if (groupsError) return json(500, { error: groupsError.message });
  if (profilesError) return json(500, { error: profilesError.message });

  const groupNameById = new Map((groups as GroupRow[]).map((group) => [group.id, group.name]));
  const profileNameById = new Map((profiles as ProfileRow[]).map((profile) => [profile.user_id, profile.display_name]));
  const messagesByGroup = new Map<string, MessageRow[]>();

  for (const message of messages as MessageRow[]) {
    const bucket = messagesByGroup.get(message.group_id) ?? [];
    bucket.push(message);
    messagesByGroup.set(message.group_id, bucket);
  }

  const processedGroups: Array<{ groupId: string; messageCount: number }> = [];
  const failedGroups: Array<{ groupId: string; reason: string }> = [];

  for (const [groupId, groupMessages] of messagesByGroup.entries()) {
    const fileName = buildArchiveFileName(windowStart, windowEnd);
    const storagePath = buildArchiveStoragePath(groupId, windowStart, windowEnd);
    const expiresAtIso = getArchiveExpiry(now).toISOString();

    const { error: pendingError } = await supabase
      .from("message_archives")
      .upsert(
        {
          group_id: groupId,
          window_start: windowStartIso,
          window_end: windowEndIso,
          storage_path: storagePath,
          file_name: fileName,
          message_count: groupMessages.length,
          expires_at: expiresAtIso,
          status: "pending",
        },
        { onConflict: "group_id,window_start,window_end" },
      );

    if (pendingError) {
      failedGroups.push({ groupId, reason: pendingError.message });
      continue;
    }

    try {
      const pdfBytes = await renderArchivePdf({
        groupName: groupNameById.get(groupId) ?? "Study group",
        windowLabel: formatArchiveWindowLabel(windowStartIso, windowEndIso),
        messageCount: groupMessages.length,
        userPassword: requireEnv("MESSAGE_ARCHIVE_PDF_PASSWORD"),
        messages: groupMessages.map((message) => ({
          createdAtLabel: formatArchiveWindowLabel(message.created_at, message.created_at).split(" ").at(-1) ?? "",
          authorName: profileNameById.get(message.user_id) ?? "Anonymous",
          content: message.content,
        })),
      });

      const { error: uploadError } = await supabase.storage
        .from("message-archives")
        .upload(storagePath, pdfBytes, {
          upsert: true,
          contentType: "application/pdf",
        });

      if (uploadError) throw uploadError;

      const { error: deleteMessagesError } = await supabase
        .from("messages")
        .delete()
        .eq("group_id", groupId)
        .gte("created_at", windowStartIso)
        .lt("created_at", windowEndIso);

      if (deleteMessagesError) throw deleteMessagesError;

      const { error: readyError } = await supabase
        .from("message_archives")
        .update({
          file_name: fileName,
          storage_path: storagePath,
          message_count: groupMessages.length,
          created_at: nowIso,
          expires_at: expiresAtIso,
          status: "ready",
        })
        .eq("group_id", groupId)
        .eq("window_start", windowStartIso)
        .eq("window_end", windowEndIso);

      if (readyError) throw readyError;

      processedGroups.push({ groupId, messageCount: groupMessages.length });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown archive failure";

      await supabase
        .from("message_archives")
        .update({ status: "failed" })
        .eq("group_id", groupId)
        .eq("window_start", windowStartIso)
        .eq("window_end", windowEndIso);

      failedGroups.push({ groupId, reason });
    }
  }

  return json(200, {
    expiredCount,
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    processedGroups,
    failedGroups,
  });
});
```

- [ ] **Step 5: Fix the per-message time label before the green run**

Before running tests, replace the `createdAtLabel` line inside `supabase/functions/message-archive-maintenance/index.ts` with:

```ts
createdAtLabel: new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Singapore",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(message.created_at)),
```

- [ ] **Step 6: Run the helper tests to verify they pass**

Run:

```bash
deno test supabase/functions/tests/message-archive-window-test.ts supabase/functions/tests/message-archive-pdf-test.ts
```

Expected: PASS

- [ ] **Step 7: Smoke-test the function locally**

Run:

```bash
$env:MESSAGE_ARCHIVE_CRON_SECRET="local-dev-secret"
$env:MESSAGE_ARCHIVE_PDF_PASSWORD="20May2026"
supabase functions serve
```

In another terminal, invoke it with a local secret:

```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/message-archive-maintenance -H "x-message-archive-cron-secret: local-dev-secret"
```

Expected: `200 OK` with JSON containing `windowStart`, `windowEnd`, and processed or failed group arrays.

- [ ] **Step 8: Commit the function implementation**

Run:

```bash
git add supabase/functions/_shared/message-archive-pdf.ts supabase/functions/message-archive-maintenance/index.ts supabase/functions/tests/message-archive-pdf-test.ts
git commit -m "feat: add message archive maintenance function"
```

---

### Task 4: Add App Types and Signed URL Server Function

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Create: `src/lib/api/message-archive.functions.ts`

**Dependencies:** Existing `supabaseAdmin` client at `src/integrations/supabase/client.server.ts`

- [ ] **Step 1: Patch the generated Supabase types file locally**

Insert this table definition in `src/integrations/supabase/types.ts` immediately after the existing `messages` table block:

```ts
      message_archives: {
        Row: {
          created_at: string
          expires_at: string
          file_name: string
          group_id: string
          id: string
          message_count: number
          status: string
          storage_path: string
          window_end: string
          window_start: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          file_name: string
          group_id: string
          id?: string
          message_count: number
          status: string
          storage_path: string
          window_end: string
          window_start: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          file_name?: string
          group_id?: string
          id?: string
          message_count?: number
          status?: string
          storage_path?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_archives_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Create the signed URL server function**

Create `src/lib/api/message-archive.functions.ts` with:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getMessageArchiveDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1), archiveId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (userError || !userData?.user) throw new Error("Unauthorized");

    const { data: archive, error: archiveError } = await supabaseAdmin
      .from("message_archives")
      .select("id, group_id, storage_path, file_name, expires_at, status")
      .eq("id", data.archiveId)
      .maybeSingle();

    if (archiveError) throw new Error(archiveError.message);
    if (!archive || archive.status !== "ready") throw new Error("Archive not available");
    if (new Date(archive.expires_at).getTime() <= Date.now()) throw new Error("Archive expired");

    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", archive.group_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memberError) throw new Error(memberError.message);
    if (!memberRow) throw new Error("Forbidden");

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from("message-archives")
      .createSignedUrl(archive.storage_path, 300, { download: archive.file_name });

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(signedUrlError?.message ?? "Failed to create signed URL");
    }

    return {
      fileName: archive.file_name,
      signedUrl: signedUrlData.signedUrl,
    };
  });
```

- [ ] **Step 3: Run the app build to verify the new server function compiles**

Run:

```bash
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit the type patch and server function**

Run:

```bash
git add src/integrations/supabase/types.ts src/lib/api/message-archive.functions.ts
git commit -m "feat: add archive download server function"
```

---

### Task 5: Add Archive Listing UI and Message Delete Invalidation

**Files:**
- Modify: `src/routes/_authenticated/groups.$groupId.tsx`

**Dependencies:** `src/lib/message-archives.ts`, `src/lib/api/message-archive.functions.ts`

- [ ] **Step 1: Add the new imports**

In `src/routes/_authenticated/groups.$groupId.tsx`, add:

```tsx
import { getMessageArchiveDownloadUrl } from "@/lib/api/message-archive.functions";
import { formatArchiveExpiryLabel, formatArchiveWindowLabel, isArchiveVisible } from "@/lib/message-archives";
import { Download } from "lucide-react";
```

- [ ] **Step 2: Add archive query state and download action inside `ChatTab`**

Inside `ChatTab`, add:

```tsx
  const [downloadingArchiveId, setDownloadingArchiveId] = useState<string | null>(null);

  const { data: archives } = useQuery({
    queryKey: ["message-archives", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_archives")
        .select("id, file_name, window_start, window_end, expires_at, message_count, status")
        .eq("group_id", groupId)
        .eq("status", "ready")
        .order("window_start", { ascending: false });

      if (error) throw error;
      return (data ?? []).filter((archive) => isArchiveVisible(archive.expires_at));
    },
  });

  const downloadArchive = async (archiveId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      toast.error("Missing session. Please sign in again.");
      return;
    }

    try {
      setDownloadingArchiveId(archiveId);
      const { signedUrl } = await getMessageArchiveDownloadUrl({ data: { accessToken, archiveId } });
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download archive";
      toast.error(message);
    } finally {
      setDownloadingArchiveId(null);
    }
  };
```

- [ ] **Step 3: Expand the realtime invalidation to include DELETE events**

Replace the current `useEffect` subscription block with:

```tsx
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", groupId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", groupId] });
          qc.invalidateQueries({ queryKey: ["message-archives", groupId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc]);
```

- [ ] **Step 4: Render the archive section below the chat composer**

Immediately after the closing `</form>` in the `ChatTab` return block, add:

```tsx
      <div className="border-t border-border/70 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">Recent archives</h3>
            <p className="text-sm text-muted-foreground">
              Password-protected PDF exports remain available for 12 hours.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {archives?.length ? (
            archives.map((archive) => (
              <div
                key={archive.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">{formatArchiveWindowLabel(archive.window_start, archive.window_end)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {archive.message_count} messages | {formatArchiveExpiryLabel(archive.expires_at)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingArchiveId === archive.id}
                  onClick={() => downloadArchive(archive.id)}
                >
                  <Download className="h-4 w-4" />
                  {downloadingArchiveId === archive.id ? "Preparing..." : "Download PDF"}
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
              No archive exports are available for this group right now.
            </div>
          )}
        </div>
      </div>
```

- [ ] **Step 5: Run the app build to verify the route still compiles**

Run:

```bash
npm run build
```

Expected: PASS

- [ ] **Step 6: Commit the UI changes**

Run:

```bash
git add src/routes/_authenticated/groups.$groupId.tsx
git commit -m "feat: show downloadable message archives in group chat"
```

---

## Release Verification

- [ ] Set Supabase function secrets before deployment:

```bash
supabase secrets set MESSAGE_ARCHIVE_PDF_PASSWORD=20May2026 MESSAGE_ARCHIVE_CRON_SECRET=<same-random-secret-used-in-vault>
```

- [ ] Create the Vault secrets referenced by the migration SQL in the Supabase SQL editor:

```sql
select vault.create_secret('https://mkrulcrbjmcgjttkxkly.supabase.co', 'project_url');
select vault.create_secret('<same-random-secret-used-in-function-secret>', 'message_archive_cron_secret');
```

- [ ] Deploy the Edge Function:

```bash
supabase functions deploy message-archive-maintenance
```

- [ ] Smoke-test a manual run against the hosted function:

```bash
curl -i -X POST https://mkrulcrbjmcgjttkxkly.supabase.co/functions/v1/message-archive-maintenance -H "x-message-archive-cron-secret: <same-random-secret-used-in-function-secret>"
```

- [ ] Verify in the app:
  - create messages in one group before a 6-hour boundary
  - invoke the function
  - confirm the chat list clears
  - confirm `Recent archives` shows one new PDF row
  - confirm a current member can open the PDF with password `20May2026`
  - confirm a non-member or former member cannot download it
  - confirm the archive disappears after `12` hours and the storage object is removed
