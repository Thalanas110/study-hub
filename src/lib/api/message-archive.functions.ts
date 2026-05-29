import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getMessageArchiveDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1), archiveId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (userError || !userData?.user) {
      throw new Error("Unauthorized");
    }

    const { data: archive, error: archiveError } = await supabaseAdmin
      .from("message_archives")
      .select("id, group_id, storage_path, file_name, expires_at, status")
      .eq("id", data.archiveId)
      .maybeSingle();

    if (archiveError) {
      throw new Error(archiveError.message);
    }

    if (!archive || archive.status !== "ready") {
      throw new Error("Archive not available");
    }

    if (new Date(archive.expires_at).getTime() <= Date.now()) {
      throw new Error("Archive expired");
    }

    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", archive.group_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!memberRow) {
      throw new Error("Forbidden");
    }

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
