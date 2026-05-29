import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Users, Plus, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({ meta: [{ title: "Your groups — Studyhive" }] }),
  component: GroupsIndex,
});

function GroupsIndex() {
  const { user } = useAuth();
  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_groups")
        .select("id, name, description, topic, host_id, created_at, group_members(user_id, role), profiles:host_id(display_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: hosts } = useQuery({
    queryKey: ["hostprofiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.display_name]));
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Your groups</h1>
          <p className="mt-1 text-muted-foreground">Only groups you belong to appear here.</p>
        </div>
        <Link to="/groups/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft">
          <Plus className="h-4 w-4" /> Host a group
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-12 text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {groups?.map((g: any) => {
            const memberCount = g.group_members?.length ?? 0;
            const isMember = g.group_members?.some((m: any) => m.user_id === user?.id);
            const isHost = g.host_id === user?.id;
            return (
              <Link
                key={g.id}
                to="/groups/$groupId"
                params={{ groupId: g.id }}
                className="group rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lifted"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{g.topic}</span>
                  {isHost ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"><Crown className="h-3 w-3" /> Host</span>
                  ) : isMember ? (
                    <span className="rounded-full bg-accent/40 px-2 py-1 text-xs font-medium text-accent-foreground">Joined</span>
                  ) : null}
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold group-hover:text-primary">{g.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{g.description || "No description yet."}</p>
                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {memberCount} member{memberCount === 1 ? "" : "s"}</span>
                  <span>Hosted by {hosts?.[g.host_id] ?? "—"}</span>
                </div>
              </Link>
            );
          })}
          {groups?.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
              <p>You are not in any groups yet.</p>
              <Link to="/groups/new" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                <Plus className="h-3.5 w-3.5" /> Create your first group
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
