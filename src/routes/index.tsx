import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Sparkles, Users, NotebookPen, MessageCircle, Brain } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studyhive — collaborative study groups, notes & quizzes" },
      { name: "description", content: "Join or host study groups. Share notes, build quizzes, and chat in real time with classmates." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 md:px-6">
        <section className="pt-20 pb-24 md:pt-32 md:pb-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> A calmer place to study together
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-7xl">
            Study groups that actually <span className="text-primary">help you learn</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Host a group around any subject, or join an existing one. Share notes, quiz each other, and keep the conversation going — all in one quiet, focused space.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to={user ? "/groups" : "/login"} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lifted transition hover:opacity-90">
              {user ? "Browse groups" : "Sign in to start"}
            </Link>
            <Link to={user ? "/groups/new" : "/login"} className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary">
              Host a study group
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 md:grid-cols-2 lg:grid-cols-4">
          {[
            { i: Users, t: "Join or host", d: "Be a member of many groups, host your own — no permissions required." },
            { i: NotebookPen, t: "Shared notes", d: "Pin cheat sheets, summaries, and breakthroughs where the whole group can find them." },
            { i: Brain, t: "Group quizzes", d: "Build multiple-choice quizzes for your group to test what stuck." },
            { i: MessageCircle, t: "Group chat", d: "Quick check-ins, study sessions, and victory laps in a focused chat." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="group rounded-2xl border border-border/70 bg-card/70 p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lifted">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>

      </main>
    </div>
  );
}
