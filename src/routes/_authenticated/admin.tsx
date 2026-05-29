import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useAuth } from "@/lib/auth";
import { getAdminDashboardData, adminDeleteGroup } from "@/lib/api/admin.functions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { toast } from "sonner";
import { ShieldCheck, Users, BookOpen, FileText, Brain, Trash2, LayoutDashboard } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Studyhive" }] }),
  component: AdminPage,
});

type Tab = "overview" | "users" | "groups" | "notes" | "quizzes";

function AdminPage() {
  const { isAdmin, loading } = useIsAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const { confirmAsync, confirmDialogProps } = useConfirmDialog();

  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/groups" }); }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast.error("Missing session. Please sign in again.");
        return;
      }
      try {
        const result = await getAdminDashboardData({ data: { accessToken } });
        setData(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load admin data";
        toast.error(message);
      }
    })();
  }, [isAdmin, refreshKey]);

  if (loading || !isAdmin) return <div className="p-10 text-muted-foreground">Loading admin…</div>;

  const nameFor = (uid: string) => data.profiles?.find((p: any) => p.user_id === uid)?.display_name ?? uid.slice(0, 8);
  const groupName = (gid: string) => data.groups?.find((g: any) => g.id === gid)?.name ?? gid.slice(0, 8);
  const isAdminUser = (uid: string) => data.roles?.some((r: any) => r.user_id === uid && r.role === "admin");

  const del = async (table: string, id: string) => {
    const ok = await confirmAsync({ title: "Delete record", description: "This action cannot be undone.", actionLabel: "Delete" });
    if (!ok) return;

    if (table === "study_groups") {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { toast.error("Missing session."); return; }
      try {
        await adminDeleteGroup({ data: { accessToken, groupId: id } });
        toast.success("Deleted");
        setRefreshKey((k) => k + 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete group";
        toast.error(message);
      }
    } else {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) toast.error(error.message);
      else { toast.success("Deleted"); setRefreshKey((k) => k + 1); }
    }
  };

  const grantAdmin = async (uid: string) => {
    const ok = await confirmAsync({ title: "Grant admin role", description: "This user will gain access to admin controls.", actionLabel: "Grant admin", variant: "default" });
    if (!ok) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error) toast.error(error.message);
    else { toast.success("Admin role granted"); setRefreshKey((k) => k + 1); }
  };

  const revokeAdmin = async (uid: string) => {
    const ok = await confirmAsync({ title: "Remove admin role", description: "This user will lose admin privileges.", actionLabel: "Remove admin", variant: "default" });
    if (!ok) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    if (error) toast.error(error.message);
    else { toast.success("Admin role revoked"); setRefreshKey((k) => k + 1); }
  };

  const deleteAccount = async (uid: string, label: string) => {
    const ok = await confirmAsync({ title: "Delete account", description: `Delete ${label}'s account? This cannot be undone.`, actionLabel: "Delete account" });
    if (!ok) return;
    const { error } = await supabase.rpc("admin_delete_user", { target_user_id: uid });
    if (error) toast.error(error.message);
    else { toast.success("Account deleted"); setRefreshKey((k) => k + 1); }
  };

  const stats = [
    { label: "Users", value: data.profiles?.length ?? 0, icon: Users },
    { label: "Groups", value: data.groups?.length ?? 0, icon: BookOpen },
    { label: "Notes", value: data.notes?.length ?? 0, icon: FileText },
    { label: "Quizzes", value: data.quizzes?.length ?? 0, icon: Brain },
    { label: "Attempts", value: data.attempts?.length ?? 0, icon: ShieldCheck },
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "groups", label: "Groups" },
    { id: "notes", label: "Notes" },
    { id: "quizzes", label: "Quizzes" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <ConfirmDialog {...confirmDialogProps} />
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Admin console</h1>
          <p className="text-sm text-muted-foreground">Full visibility across the study hub.</p>
        </div>
      </div>

      <div className="mt-6">
        {isMobile ? (
          <Select value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <SelectTrigger className="w-full bg-card/70">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview"><span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Overview</span></SelectItem>
              <SelectItem value="users"><span className="flex items-center gap-2"><Users className="h-4 w-4" /> Users</span></SelectItem>
              <SelectItem value="groups"><span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Groups</span></SelectItem>
              <SelectItem value="notes"><span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Notes</span></SelectItem>
              <SelectItem value="quizzes"><span className="flex items-center gap-2"><Brain className="h-4 w-4" /> Quizzes</span></SelectItem>
            </SelectContent>
          </Select>
        ) : (
        <div className="flex gap-2 overflow-x-auto border-b border-border/60 scrollbar-none">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        )}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/70 bg-card/70 p-5">
                <div className="flex items-center gap-2 text-muted-foreground"><s.icon className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">{s.label}</span></div>
                <p className="mt-2 font-display text-3xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "users" && (
          <Table headers={["Name", "Bio", "User ID", "Joined", "Role", "Admin", "Account"]}>
            {data.profiles?.map((p: any) => {
              const admin = isAdminUser(p.user_id);
              const isSelf = user?.id === p.user_id;
              return (
                <tr key={p.id} className="border-t border-border/50">
                  <td className="px-4 py-3 font-medium">{p.display_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.bio || "-"}</td>
                  <td className="px-4 py-3"><code className="text-xs">{p.user_id.slice(0, 8)}</code></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${admin ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {admin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {admin ? (
                      <Button size="sm" variant="ghost" disabled={isSelf} onClick={() => revokeAdmin(p.user_id)}>
                        Remove admin
                      </Button>
                    ) : (
                      <Button size="sm" disabled={isSelf} onClick={() => grantAdmin(p.user_id)}>
                        Make admin
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="destructive" disabled={isSelf} onClick={() => deleteAccount(p.user_id, p.display_name || "this user")}>
                      Delete account
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}

        {tab === "groups" && (
          <Table headers={["Name", "Topic", "Host", "Members", "Created", ""]}>
            {data.groups?.map((g: any) => {
              const count = data.members?.filter((m: any) => m.group_id === g.id).length ?? 0;
              return (
                <tr key={g.id} className="border-t border-border/50">
                  <td className="px-4 py-3 font-medium"><Link to="/groups/$groupId" params={{ groupId: g.id }} className="hover:underline">{g.name}</Link></td>
                  <td className="px-4 py-3 text-sm">{g.topic}</td>
                  <td className="px-4 py-3 text-sm">{nameFor(g.host_id)}</td>
                  <td className="px-4 py-3 text-sm">{count}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => del("study_groups", g.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              );
            })}
          </Table>
        )}

        {tab === "notes" && (
          <Table headers={["Title", "Group", "Author", "Updated", ""]}>
            {data.notes?.map((n: any) => (
              <tr key={n.id} className="border-t border-border/50">
                <td className="px-4 py-3 font-medium">{n.title}</td>
                <td className="px-4 py-3 text-sm">{groupName(n.group_id)}</td>
                <td className="px-4 py-3 text-sm">{nameFor(n.author_id)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(n.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => del("notes", n.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "quizzes" && (
          <Table headers={["Title", "Group", "Author", "Questions", "Attempts", ""]}>
            {data.quizzes?.map((q: any) => {
              const qc = data.questions?.filter((x: any) => x.quiz_id === q.id).length ?? 0;
              const ac = data.attempts?.filter((a: any) => a.quiz_id === q.id).length ?? 0;
              return (
                <tr key={q.id} className="border-t border-border/50">
                  <td className="px-4 py-3 font-medium">{q.title}</td>
                  <td className="px-4 py-3 text-sm">{groupName(q.group_id)}</td>
                  <td className="px-4 py-3 text-sm">{nameFor(q.author_id)}</td>
                  <td className="px-4 py-3 text-sm">{qc}</td>
                  <td className="px-4 py-3 text-sm">{ac}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => del("quizzes", q.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          const el = child as React.ReactElement<any>;
          const cells = React.Children.toArray(el.props.children);
          return (
            <div className="rounded-2xl border border-border/70 bg-card/70 p-4 space-y-2">
              {headers.map((h, i) => (
                <div key={h} className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">{h}</span>
                  <span className="text-sm text-right">{cells[i] ?? "—"}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/70">
      <table className="w-full text-left">
        <thead className="bg-secondary/40">
          <tr>{headers.map((h) => <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
