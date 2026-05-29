import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups/new")({
  head: () => ({ meta: [{ title: "Host a study group — Studyhive" }] }),
  component: NewGroup,
});

function NewGroup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("study_groups")
      .insert({ host_id: user.id, name, topic: topic || "General", description })
      .select("id")
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Group created!");
    navigate({ to: "/groups/$groupId", params: { groupId: data.id } });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Host a study group</h1>
          <p className="mt-1 text-muted-foreground">You'll automatically be the host. Members can join freely.</p>

          <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-border/70 bg-card/80 p-8 shadow-soft">
            <div className="space-y-2">
              <Label htmlFor="name">Group name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Discrete Math Study Crew" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Mathematics" maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What will you study together? When do you meet?" maxLength={500} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Create group"}</Button>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-5">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{topic || "General"}</span>
              <h3 className="mt-4 font-display text-xl font-semibold">{name || "Your group name"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {description || "Write a short description so people know what they are joining."}
              </p>
              <p className="mt-4 text-xs text-muted-foreground">Hosted by you</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strong groups share</p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>Clear focus and a short, welcoming description.</li>
              <li>A cadence for meetups or async check-ins.</li>
              <li>A first note or quiz to get people talking.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
