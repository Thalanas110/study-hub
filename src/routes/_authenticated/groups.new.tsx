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
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-4xl font-bold">Host a study group</h1>
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
    </main>
  );
}
