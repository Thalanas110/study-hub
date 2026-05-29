import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAdminDashboardData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { accessToken } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) throw new Error("Unauthorized");

    const userId = userData.user.id;
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden");

    const [profiles, roles, groups, members, notes, quizzes, questions, attempts] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("study_groups").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("group_members").select("*"),
      supabaseAdmin.from("notes").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("quizzes").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("quiz_questions").select("id, quiz_id"),
      supabaseAdmin.from("quiz_attempts").select("*").order("completed_at", { ascending: false }),
    ]);

    const firstError = [profiles, roles, groups, members, notes, quizzes, questions, attempts]
      .map((res) => res.error)
      .find(Boolean);
    if (firstError) throw new Error(firstError.message);

    return {
      profiles: profiles.data ?? [],
      roles: roles.data ?? [],
      groups: groups.data ?? [],
      members: members.data ?? [],
      notes: notes.data ?? [],
      quizzes: quizzes.data ?? [],
      questions: questions.data ?? [],
      attempts: attempts.data ?? [],
    };
  });

export const adminDeleteGroup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1), groupId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { accessToken, groupId } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) throw new Error("Unauthorized");

    const userId = userData.user.id;
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) throw new Error("Forbidden");

    const { error } = await supabaseAdmin.rpc("admin_delete_group", { _group_id: groupId });
    if (error) throw new Error(error.message);
  });
