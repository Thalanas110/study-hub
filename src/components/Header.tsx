import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { BookOpenCheck, LogOut, ShieldCheck } from "lucide-react";

export function Header() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const { confirmAsync, confirmDialogProps } = useConfirmDialog();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <ConfirmDialog {...confirmDialogProps} />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground"><BookOpenCheck className="h-4 w-4" /></span>
          studyhive
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/groups" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground">My groups</Link>
              <Link to="/groups/new" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground">Host a group</Link>
              {isAdmin && (
                <Link to="/admin" className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20">
                  <ShieldCheck className="h-4 w-4" /> Admin
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={async () => {
                const ok = await confirmAsync({ title: "Sign out", description: "Are you sure you want to sign out?", actionLabel: "Sign out", variant: "default" });
                if (!ok) return;
                await signOut();
                navigate({ to: "/" });
              }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link to="/login" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-soft">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
