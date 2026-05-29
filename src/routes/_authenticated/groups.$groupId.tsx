import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Crown, Users, Plus, Send, Trash2, NotebookPen, Brain, MessageCircle, LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupPage,
});

type Profile = { user_id: string; display_name: string };
type GroupTab = "notes" | "quizzes" | "chat" | "members";

function GroupPage() {
  const { groupId } = Route.useParams();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<GroupTab>("notes");
  const isMobile = useIsMobile();

  const { data: group, isLoading, isError } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_groups")
        .select("*")
        .eq("id", groupId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members", groupId],
    enabled: !!group,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, role, joined_at")
        .eq("group_id", groupId);
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      const map = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));
      return (data ?? []).map((m) => ({ ...m, display_name: map.get(m.user_id) ?? "Anonymous" }));
    },
  });

  const isMember = !!members?.some((m) => m.user_id === user?.id);
  const isHost = group?.host_id === user?.id;
  const canAccess = isMember || isHost || isAdmin;
  const hostName = members?.find((m) => m.user_id === group?.host_id)?.display_name;
  const createdOn = group?.created_at ? new Date(group.created_at).toLocaleDateString() : "";

  const { confirmAsync: confirmLeave, confirmDialogProps: leaveDialogProps } = useConfirmDialog();

  const join = async () => {
    if (!user) return;
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
    if (error) toast.error(error.message);
    else { toast.success("Welcome!"); qc.invalidateQueries({ queryKey: ["members", groupId] }); qc.invalidateQueries({ queryKey: ["groups"] }); }
  };

  const leave = async () => {
    if (!user) return;
    const ok = await confirmLeave({ title: "Leave group", description: "Are you sure you want to leave this group? You can rejoin later.", actionLabel: "Leave" });
    if (!ok) return;
    const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Left the group."); qc.invalidateQueries({ queryKey: ["members", groupId] }); }
  };

  if (isLoading) return <LoadingScreen />;
  if (isError || !group) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-8 shadow-soft">
          <h1 className="font-display text-2xl font-semibold">Group not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This group does not exist or you do not have access.</p>
          <div className="mt-4">
            <Button onClick={() => navigate({ to: "/groups" })}>Back to your groups</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <ConfirmDialog {...leaveDialogProps} />
      <div className="rounded-3xl border border-border/70 bg-card/80 p-4 md:p-8 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{group.topic}</span>
            <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">{group.name}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{group.description || "No description yet."}</p>
            <p className="mt-3 text-xs text-muted-foreground">Hosted by {hostName ?? "-"} · Created {createdOn || "-"}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {members?.length ?? 0} members</span>
              {isHost && <span className="inline-flex items-center gap-1.5 text-primary"><Crown className="h-4 w-4" /> You host this group</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {!canAccess && <Button onClick={join}>Join group</Button>}
            {canAccess && !isHost && !isAdmin && (
              <Button variant="outline" onClick={leave}><LogOut className="h-4 w-4" /> Leave</Button>
            )}
            <Link to="/groups" className="inline-flex items-center rounded-full border border-border bg-background px-4 py-2 text-sm">All groups</Link>
          </div>
        </div>
      </div>

      {!canAccess ? (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Join to unlock the group</h2>
            <p className="mt-2 text-sm text-muted-foreground">Members can post notes, build quizzes, and chat in real time.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={join}>Join group</Button>
              <Button variant="outline" onClick={() => navigate({ to: "/groups" })}>Browse other groups</Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <PreviewCard icon={NotebookPen} title="Shared notes" description="Summaries, study plans, and key takeaways stay in one place." />
            <PreviewCard icon={Brain} title="Group quizzes" description="Quick checks to see what stuck and what needs review." />
            <PreviewCard icon={MessageCircle} title="Focused chat" description="Ask questions, coordinate sessions, and keep momentum." />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Members</h3>
              <span className="text-xs text-muted-foreground">{members?.length ?? 0} total</span>
            </div>
            <div className="mt-4">
              {members?.length ? (
                <MembersTab members={members} hostId={group.host_id} />
              ) : (
                <p className="text-sm text-muted-foreground">No members yet. Be the first to join.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button variant="outline" onClick={() => setTab("notes")}><NotebookPen className="h-4 w-4" /> Start a note</Button>
            <Button variant="outline" onClick={() => setTab("quizzes")}><Brain className="h-4 w-4" /> Create a quiz</Button>
            <Button variant="outline" onClick={() => setTab("chat")}><MessageCircle className="h-4 w-4" /> Open chat</Button>
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as GroupTab)}>
          {isMobile ? (
            <Select value={tab} onValueChange={(value) => setTab(value as GroupTab)}>
              <SelectTrigger className="w-full bg-card/70">
                <SelectValue placeholder="Select tab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notes"><span className="flex items-center gap-2"><NotebookPen className="h-4 w-4" /> Notes</span></SelectItem>
                <SelectItem value="quizzes"><span className="flex items-center gap-2"><Brain className="h-4 w-4" /> Quizzes</span></SelectItem>
                <SelectItem value="chat"><span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Chat</span></SelectItem>
                <SelectItem value="members"><span className="flex items-center gap-2"><Users className="h-4 w-4" /> Members</span></SelectItem>
              </SelectContent>
            </Select>
          ) : (
          <TabsList className="bg-card/70">
            <TabsTrigger value="notes"><NotebookPen className="mr-2 h-4 w-4" /> Notes</TabsTrigger>
            <TabsTrigger value="quizzes"><Brain className="mr-2 h-4 w-4" /> Quizzes</TabsTrigger>
            <TabsTrigger value="chat"><MessageCircle className="mr-2 h-4 w-4" /> Chat</TabsTrigger>
            <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" /> Members</TabsTrigger>
          </TabsList>
          )}

          <TabsContent value="notes" className="mt-6">
            <NotesTab groupId={groupId} userId={user!.id} />
          </TabsContent>
          <TabsContent value="quizzes" className="mt-6">
            <QuizzesTab groupId={groupId} userId={user!.id} />
          </TabsContent>
          <TabsContent value="chat" className="mt-6">
            <ChatTab groupId={groupId} userId={user!.id} members={members ?? []} />
          </TabsContent>
          <TabsContent value="members" className="mt-6">
            <MembersTab members={members ?? []} hostId={group.host_id} />
          </TabsContent>
          </Tabs>
        </div>
      )}
    </main>
  );
}

/* ---------------- NOTES ---------------- */
function NotesTab({ groupId, userId }: { groupId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const { confirmAsync: confirmDeleteNote, confirmDialogProps: deleteNoteDialogProps } = useConfirmDialog();

  const { data: notes } = useQuery({
    queryKey: ["notes", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, content, author_id, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profs } = useAuthorProfiles(notes?.map((n) => n.author_id) ?? []);

  const create = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("notes").insert({ group_id: groupId, author_id: userId, title, content });
    if (error) toast.error(error.message);
    else {
      setTitle(""); setContent(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["notes", groupId] });
    }
  };

  const del = async (id: string) => {
    const ok = await confirmDeleteNote({ title: "Delete note", description: "This note will be permanently removed.", actionLabel: "Delete" });
    if (!ok) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["notes", groupId] });
  };

  return (
    <div>
      <ConfirmDialog {...deleteNoteDialogProps} />
      <div className="flex justify-between">
        <h2 className="font-display text-xl font-semibold">Shared notes</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> New note</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New note</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Write your notes here…" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <DialogFooter><Button onClick={create}>Post note</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {notes?.map((n) => (
          <article key={n.id} className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-semibold">{n.title}</h3>
              {n.author_id === userId && (
                <button onClick={() => del(n.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{n.content}</p>
            <p className="mt-4 text-xs text-muted-foreground">By {profs?.[n.author_id] ?? "—"} · {new Date(n.created_at).toLocaleDateString()}</p>
          </article>
        ))}
        {notes?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-sm text-muted-foreground md:col-span-2">
            <p>No notes yet. Capture your first summary or study plan.</p>
            <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>Create first note</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- QUIZZES ---------------- */
function QuizzesTab({ groupId, userId }: { groupId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<string | null>(null);

  const { data: quizzes } = useQuery({
    queryKey: ["quizzes", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, author_id, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profs } = useAuthorProfiles(quizzes?.map((q) => q.author_id) ?? []);

  return (
    <div>
      <div className="flex justify-between">
        <h2 className="font-display text-xl font-semibold">Quizzes</h2>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New quiz</Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {quizzes?.map((q) => (
          <div key={q.id} className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft">
            <h3 className="font-display text-lg font-semibold">{q.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{q.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">By {profs?.[q.author_id] ?? "—"}</p>
            <Button className="mt-4" size="sm" onClick={() => setActiveQuiz(q.id)}>Take quiz</Button>
          </div>
        ))}
        {quizzes?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-sm text-muted-foreground md:col-span-2">
            <p>No quizzes yet. Add a quick check-in to keep everyone sharp.</p>
            <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>Create first quiz</Button>
          </div>
        )}
      </div>

      {activeQuiz && <QuizPlayer quizId={activeQuiz} userId={userId} onClose={() => setActiveQuiz(null)} />}
      {open && <QuizBuilder groupId={groupId} userId={userId} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["quizzes", groupId] }); }} />}
    </div>
  );
}

function QuizBuilder({ groupId, userId, onClose }: { groupId: string; userId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  type Q = { question: string; options: string[]; correct_index: number };
  const [questions, setQuestions] = useState<Q[]>([{ question: "", options: ["", "", "", ""], correct_index: 0 }]);

  const submit = async () => {
    if (!title.trim()) { toast.error("Add a title"); return; }
    const valid = questions.filter((q) => q.question.trim() && q.options.every((o) => o.trim()));
    if (valid.length === 0) { toast.error("Add at least one complete question"); return; }
    const { data: quiz, error } = await supabase.from("quizzes")
      .insert({ group_id: groupId, author_id: userId, title, description })
      .select("id").single();
    if (error || !quiz) { toast.error(error?.message ?? "Failed"); return; }
    const rows = valid.map((q, i) => ({ quiz_id: quiz.id, position: i, question: q.question, options: q.options, correct_index: q.correct_index }));
    const { error: qErr } = await supabase.from("quiz_questions").insert(rows);
    if (qErr) toast.error(qErr.message);
    else { toast.success("Quiz published!"); onClose(); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader><DialogTitle>Create a quiz</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-border/70 bg-secondary/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Question {qi + 1}</Label>
                {questions.length > 1 && <button onClick={() => setQuestions(questions.filter((_, i) => i !== qi))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
              </div>
              <Input value={q.question} onChange={(e) => { const c = [...questions]; c[qi].question = e.target.value; setQuestions(c); }} placeholder="What's the question?" />
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${qi}`} checked={q.correct_index === oi} onChange={() => { const c = [...questions]; c[qi].correct_index = oi; setQuestions(c); }} />
                    <Input value={opt} onChange={(e) => { const c = [...questions]; c[qi].options[oi] = e.target.value; setQuestions(c); }} placeholder={`Option ${oi + 1}`} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setQuestions([...questions, { question: "", options: ["", "", "", ""], correct_index: 0 }])}><Plus className="h-4 w-4" /> Add question</Button>
        </div>
        <DialogFooter><Button onClick={submit}>Publish quiz</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuizPlayer({ quizId, userId, onClose }: { quizId: string; userId: string; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const { data: questions } = useQuery({
    queryKey: ["questions", quizId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!questions) return;
    let score = 0;
    questions.forEach((q) => { if (answers[q.id] === q.correct_index) score++; });
    setResult({ score, total: questions.length });
    await supabase.from("quiz_attempts").insert({ quiz_id: quizId, user_id: userId, score, total: questions.length });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader><DialogTitle>Quiz</DialogTitle></DialogHeader>
        {result ? (
          <div className="py-8 text-center">
            <p className="font-display text-5xl font-bold text-primary">{result.score} / {result.total}</p>
            <p className="mt-3 text-muted-foreground">{result.score === result.total ? "Perfect score! 🌿" : "Nice work — review and try again."}</p>
            <Button className="mt-6" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              {questions?.map((q: any, i: number) => (
                <div key={q.id} className="rounded-xl border border-border/70 bg-secondary/30 p-4">
                  <p className="font-medium">{i + 1}. {q.question}</p>
                  <div className="mt-3 space-y-2">
                    {(q.options as string[]).map((opt, oi) => (
                      <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition ${answers[q.id] === oi ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-secondary"}`}>
                        <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter><Button onClick={submit} disabled={!questions || Object.keys(answers).length !== questions.length}>Submit answers</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- CHAT ---------------- */
function ChatTab({ groupId, userId, members }: { groupId: string; userId: string; members: any[] }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, user_id, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc]);

  const nameMap = new Map(members.map((m) => [m.user_id, m.display_name]));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({ group_id: groupId, user_id: userId, content });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["messages", groupId] });
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 shadow-soft">
      <div ref={scrollRef} className="h-[50vh] md:h-[480px] overflow-y-auto p-4 md:p-6 space-y-4">
        {messages?.map((m) => {
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {!mine && <p className="text-xs font-semibold opacity-80">{nameMap.get(m.user_id) ?? "—"}</p>}
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                <p className="mt-1 text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        {messages?.length === 0 && <p className="text-center text-muted-foreground">No messages yet — say hi!</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-border/70 p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the group…" maxLength={1000} />
        <Button type="submit"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

/* ---------------- MEMBERS ---------------- */
function MembersTab({ members, hostId }: { members: any[]; hostId: string }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {members.length === 0 ? (
        <li className="rounded-xl border border-dashed border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
          No members yet.
        </li>
      ) : (
        members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between rounded-xl border border-border/70 bg-card/80 p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 md:h-10 md:w-10 place-items-center rounded-full bg-primary/15 font-display font-semibold text-primary">
                {m.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="font-medium">{m.display_name}</p>
                <p className="text-xs text-muted-foreground">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
              </div>
            </div>
            {m.user_id === hostId && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"><Crown className="h-3 w-3" /> Host</span>}
          </li>
        ))
      )}
    </ul>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/* ---------------- HELPERS ---------------- */
function useAuthorProfiles(ids: string[]) {
  const unique = Array.from(new Set(ids)).sort();
  return useQuery({
    queryKey: ["author-profiles", unique.join(",")],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", unique);
      return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.display_name])) as Record<string, string>;
    },
  });
}
