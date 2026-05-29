import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildArchiveFileName,
  buildArchiveStoragePath,
  formatArchiveMessageTimeLabel,
  formatArchiveWindowLabel,
  getArchiveExpiry,
  getArchiveWindow,
} from "../_shared/message-archive-window.ts";
import { renderArchivePdf } from "../_shared/message-archive-pdf.ts";

type MessageRow = {
  content: string;
  created_at: string;
  group_id: string;
  id: string;
  user_id: string;
};

type GroupRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  display_name: string;
  user_id: string;
};

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
}

async function cleanupExpiredArchives(supabase: ReturnType<typeof createClient>, nowIso: string) {
  const { data: expiredArchives, error } = await supabase
    .from("message_archives")
    .select("id, storage_path")
    .lte("expires_at", nowIso);

  if (error) {
    throw error;
  }

  if (!expiredArchives?.length) {
    return 0;
  }

  const storagePaths = expiredArchives
    .map((archive) => archive.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("message-archives").remove(storagePaths);
    if (storageError) {
      throw storageError;
    }
  }

  const archiveIds = expiredArchives.map((archive) => archive.id);
  const { error: deleteError } = await supabase
    .from("message_archives")
    .delete()
    .in("id", archiveIds);

  if (deleteError) {
    throw deleteError;
  }

  return archiveIds.length;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (request.headers.get("x-message-archive-cron-secret") !== requireEnv("MESSAGE_ARCHIVE_CRON_SECRET")) {
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
  const { windowEnd } = getArchiveWindow(now);
  const currentWindowEndIso = windowEnd.toISOString();

  try {
    const expiredCount = await cleanupExpiredArchives(supabase, nowIso);

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, group_id, user_id, content, created_at")
      .lt("created_at", currentWindowEndIso)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    if (!messages?.length) {
      return json(200, {
        expiredCount,
        failedGroups: [],
        processedGroups: [],
        windowEnd: currentWindowEndIso,
        windowStart: null,
      });
    }

    const typedMessages = messages as MessageRow[];
    const groupIds = [...new Set(typedMessages.map((message) => message.group_id))];
    const userIds = [...new Set(typedMessages.map((message) => message.user_id))];

    const [
      { data: groups, error: groupsError },
      { data: profiles, error: profilesError },
    ] = await Promise.all([
      supabase.from("study_groups").select("id, name").in("id", groupIds),
      supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
    ]);

    if (groupsError) {
      throw groupsError;
    }
    if (profilesError) {
      throw profilesError;
    }

    const groupNameById = new Map((groups as GroupRow[]).map((group) => [group.id, group.name]));
    const displayNameByUserId = new Map((profiles as ProfileRow[]).map((profile) => [profile.user_id, profile.display_name]));
    const windowBuckets = new Map<
      string,
      {
        messagesByGroupId: Map<string, MessageRow[]>;
        windowEndIso: string;
        windowStartIso: string;
      }
    >();

    typedMessages.forEach((message) => {
      const { windowStart, windowEnd: messageWindowEnd } = getArchiveWindow(new Date(message.created_at));
      const windowStartIso = windowStart.toISOString();
      const windowEndIso = messageWindowEnd.toISOString();
      const bucketKey = `${windowStartIso}|${windowEndIso}`;
      const bucket = windowBuckets.get(bucketKey) ?? {
        messagesByGroupId: new Map<string, MessageRow[]>(),
        windowEndIso,
        windowStartIso,
      };
      const groupMessages = bucket.messagesByGroupId.get(message.group_id) ?? [];

      groupMessages.push(message);
      bucket.messagesByGroupId.set(message.group_id, groupMessages);
      windowBuckets.set(bucketKey, bucket);
    });

    const processedGroups: Array<{ groupId: string; messageCount: number }> = [];
    const failedGroups: Array<{ groupId: string; reason: string }> = [];

    const orderedBuckets = [...windowBuckets.values()].sort((left, right) =>
      left.windowStartIso.localeCompare(right.windowStartIso),
    );

    for (const bucket of orderedBuckets) {
      for (const [groupId, groupMessages] of bucket.messagesByGroupId.entries()) {
        const fileName = buildArchiveFileName(bucket.windowStartIso, bucket.windowEndIso);
        const storagePath = buildArchiveStoragePath(groupId, bucket.windowStartIso, bucket.windowEndIso);
        const expiresAtIso = getArchiveExpiry(now).toISOString();

        const { error: pendingError } = await supabase
          .from("message_archives")
          .upsert(
            {
              created_at: nowIso,
              expires_at: expiresAtIso,
              file_name: fileName,
              group_id: groupId,
              message_count: groupMessages.length,
              status: "pending",
              storage_path: storagePath,
              window_end: bucket.windowEndIso,
              window_start: bucket.windowStartIso,
            },
            { onConflict: "group_id,window_start,window_end" },
          );

        if (pendingError) {
          failedGroups.push({ groupId, reason: pendingError.message });
          continue;
        }

        let archiveIsReady = false;

        try {
          const pdfBytes = await renderArchivePdf({
            groupName: groupNameById.get(groupId) ?? "Study group",
            messageCount: groupMessages.length,
            messages: groupMessages.map((message) => ({
              authorName: displayNameByUserId.get(message.user_id) ?? "Anonymous",
              content: message.content,
              createdAtLabel: formatArchiveMessageTimeLabel(message.created_at),
            })),
            userPassword: requireEnv("MESSAGE_ARCHIVE_PDF_PASSWORD"),
            windowLabel: formatArchiveWindowLabel(bucket.windowStartIso, bucket.windowEndIso),
          });

          const { error: uploadError } = await supabase.storage
            .from("message-archives")
            .upload(storagePath, pdfBytes, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadError) {
            throw uploadError;
          }

          const { error: readyError } = await supabase
            .from("message_archives")
            .update({
              created_at: nowIso,
              expires_at: expiresAtIso,
              file_name: fileName,
              message_count: groupMessages.length,
              status: "ready",
              storage_path: storagePath,
            })
            .eq("group_id", groupId)
            .eq("window_start", bucket.windowStartIso)
            .eq("window_end", bucket.windowEndIso);

          if (readyError) {
            throw readyError;
          }

          archiveIsReady = true;

          const messageIds = groupMessages.map((message) => message.id);
          const { error: deleteMessagesError } = await supabase
            .from("messages")
            .delete()
            .in("id", messageIds);

          if (deleteMessagesError) {
            throw deleteMessagesError;
          }

          processedGroups.push({ groupId, messageCount: groupMessages.length });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown archive failure";

          if (!archiveIsReady) {
            await supabase
              .from("message_archives")
              .update({ status: "failed" })
              .eq("group_id", groupId)
              .eq("window_start", bucket.windowStartIso)
              .eq("window_end", bucket.windowEndIso);
          }

          failedGroups.push({ groupId, reason });
        }
      }
    }

    return json(200, {
      expiredCount,
      failedGroups,
      processedGroups,
      windowEnd: currentWindowEndIso,
      windowStart: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archive maintenance failed";
    return json(500, { error: message, windowEnd: currentWindowEndIso, windowStart: null });
  }
});
