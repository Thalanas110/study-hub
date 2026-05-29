# Responsive Design Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Studyhive app fully responsive across mobile phones, tablets, and desktops of all window sizes.

**Architecture:** Tailwind-only responsive fixes using existing shadcn/ui components. All changes are className-level modifications plus one new `Sheet`-based mobile nav. No new abstractions, no CSS media queries.

**Tech Stack:** React 19, TanStack Router, Tailwind CSS v4, shadcn/ui (New York style)

---

## File Map

| File | Changes |
|------|---------|
| `src/components/Header.tsx` | Mobile nav with Sheet drawer |
| `src/routes/_authenticated/admin.tsx` | Responsive table, tab scroll, padding |
| `src/routes/_authenticated/groups.$groupId.tsx` | Chat height, quiz dialogs, grids, padding, typography |
| `src/routes/index.tsx` | Heading size, padding |
| `src/routes/login.tsx` | Heading size, padding |
| `src/routes/_authenticated/groups.index.tsx` | Heading size, padding |
| `src/routes/_authenticated/groups.new.tsx` | Padding adjustments |

---

### Task 1: Mobile Navigation Header

**Files:**
- Modify: `src/components/Header.tsx`

**Dependencies:** `useIsMobile()` hook (already exists at `src/hooks/use-mobile.tsx`), shadcn/ui `Sheet` component (already installed at `src/components/ui/sheet.tsx`)

- [ ] **Step 1: Read current Header to confirm structure**

Read `src/components/Header.tsx` — confirm the nav is a `<nav className="flex items-center gap-2">` with inline links.

- [ ] **Step 2: Add imports for Sheet, Menu icon, and useIsMobile**

Add these imports to `src/components/Header.tsx`:

```tsx
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
```

- [ ] **Step 3: Add useIsMobile hook call inside Header component**

Inside the `Header` function, add:

```tsx
const isMobile = useIsMobile();
```

- [ ] **Step 4: Replace the nav section with responsive version**

Replace the `<nav className="flex items-center gap-2">` block (lines 22-44) with:

```tsx
{isMobile ? (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="ghost" size="icon" className="h-10 w-10">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>
    </SheetTrigger>
    <SheetContent side="right" className="w-72">
      <SheetHeader>
        <SheetTitle>Menu</SheetTitle>
      </SheetHeader>
      <nav className="mt-6 flex flex-col gap-2">
        {user ? (
          <>
            <Link to="/groups" className="rounded-xl px-4 py-3 text-sm font-medium text-foreground/80 hover:bg-secondary/50 hover:text-foreground">My groups</Link>
            <Link to="/groups/new" className="rounded-xl px-4 py-3 text-sm font-medium text-foreground/80 hover:bg-secondary/50 hover:text-foreground">Host a group</Link>
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10">
                <ShieldCheck className="h-4 w-4" /> Admin
              </Link>
            )}
            <div className="my-2 border-t border-border/60" />
            <button onClick={async () => {
              const ok = await confirmAsync({ title: "Sign out", description: "Are you sure you want to sign out?", actionLabel: "Sign out", variant: "default" });
              if (!ok) return;
              await signOut();
              navigate({ to: "/" });
            }} className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </>
        ) : (
          <Link to="/login" className="rounded-full bg-primary px-5 py-2.5 text-center text-sm font-medium text-primary-foreground shadow-soft">Sign in</Link>
        )}
      </nav>
    </SheetContent>
  </Sheet>
) : (
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
)}
```

- [ ] **Step 5: Verify dev server runs without errors**

Run: `npm run dev` (or the project's dev command)
Expected: App loads, header shows hamburger on mobile viewport, Sheet opens with nav links

- [ ] **Step 6: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add mobile navigation with Sheet drawer"
```

---

### Task 2: Responsive Admin Table

**Files:**
- Modify: `src/routes/_authenticated/admin.tsx` (Table component at bottom of file, lines 244-255)

- [ ] **Step 1: Add useIsMobile import**

Add to the imports at top of `src/routes/_authenticated/admin.tsx`:

```tsx
import { useIsMobile } from "@/hooks/use-mobile";
```

- [ ] **Step 2: Rewrite Table component to be responsive**

Replace the `Table` function (lines 244-255) with:

```tsx
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          const cells = React.Children.toArray(child.props.children);
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
```

- [ ] **Step 3: Add admin tab bar horizontal scroll**

Find the admin tab bar div (line 117):

```tsx
<div className="mt-6 flex flex-wrap gap-2 border-b border-border/60">
```

Change to:

```tsx
<div className="mt-6 flex gap-2 overflow-x-auto border-b border-border/60 scrollbar-none">
```

- [ ] **Step 4: Adjust admin padding for mobile**

Find the outer div (line 107):

```tsx
<div className="mx-auto max-w-6xl px-6 py-10">
```

Change to:

```tsx
<div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
```

- [ ] **Step 5: Adjust admin heading for mobile**

Find the heading (line 112):

```tsx
<h1 className="font-display text-3xl font-bold">Admin console</h1>
```

Change to:

```tsx
<h1 className="font-display text-2xl font-bold md:text-3xl">Admin console</h1>
```

- [ ] **Step 6: Verify admin page**

Run dev server, navigate to `/admin` on mobile viewport. Tables should render as stacked cards. Tab bar should scroll horizontally.

- [ ] **Step 7: Commit**

```bash
git add src/routes/_authenticated/admin.tsx
git commit -m "feat: make admin tables responsive with mobile card layout"
```

---

### Task 3: Chat Height & Quiz Dialogs

**Files:**
- Modify: `src/routes/_authenticated/groups.$groupId.tsx`

- [ ] **Step 1: Fix ChatTab height**

Find the chat scroll area div (line 472):

```tsx
<div ref={scrollRef} className="h-[480px] overflow-y-auto p-6 space-y-4">
```

Change to:

```tsx
<div ref={scrollRef} className="h-[50vh] md:h-[480px] overflow-y-auto p-4 md:p-6 space-y-4">
```

- [ ] **Step 2: Fix QuizBuilder dialog sizing**

Find the QuizBuilder DialogContent (line 349):

```tsx
<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
```

Change to:

```tsx
<DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto p-4 md:p-6">
```

- [ ] **Step 3: Fix QuizPlayer dialog sizing**

Find the QuizPlayer DialogContent (line 402):

```tsx
<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
```

Change to:

```tsx
<DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto p-4 md:p-6">
```

- [ ] **Step 4: Fix group detail card padding**

Find the main group card div (line 105):

```tsx
<div className="rounded-3xl border border-border/70 bg-card/80 p-8 shadow-soft">
```

Change to:

```tsx
<div className="rounded-3xl border border-border/70 bg-card/80 p-4 md:p-8 shadow-soft">
```

- [ ] **Step 5: Fix group detail heading size**

Find the heading (line 109):

```tsx
<h1 className="mt-3 font-display text-4xl font-bold">{group.name}</h1>
```

Change to:

```tsx
<h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">{group.name}</h1>
```

- [ ] **Step 6: Fix quick action buttons grid**

Find the quick action buttons div (line 160):

```tsx
<div className="grid gap-3 sm:grid-cols-3">
```

Change to:

```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
```

- [ ] **Step 7: Fix group detail page padding**

Find the main element (line 103):

```tsx
<main className="mx-auto max-w-6xl px-6 py-10">
```

Change to:

```tsx
<main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
```

- [ ] **Step 8: Verify group detail page**

Run dev server, navigate to a group page on mobile. Chat should fill 50% viewport height, dialogs should not overflow, cards should have less padding, heading should be smaller.

- [ ] **Step 9: Commit**

```bash
git add src/routes/_authenticated/groups.$groupId.tsx
git commit -m "feat: make group detail page responsive — chat, dialogs, grids, typography"
```

---

### Task 4: Landing Page & Login Page

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/login.tsx`

- [ ] **Step 1: Fix landing page heading**

In `src/routes/index.tsx`, find the heading (line 26):

```tsx
<h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight md:text-7xl">
```

Change to:

```tsx
<h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-7xl">
```

- [ ] **Step 2: Fix landing page padding**

Find the main element (line 21):

```tsx
<main className="mx-auto max-w-6xl px-6">
```

Change to:

```tsx
<main className="mx-auto max-w-6xl px-4 md:px-6">
```

- [ ] **Step 3: Fix login page heading**

In `src/routes/login.tsx`, find the heading (line 55):

```tsx
<h1 className="font-display text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
```

Change to:

```tsx
<h1 className="font-display text-2xl font-bold md:text-3xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
```

- [ ] **Step 4: Fix login page form padding**

Find the form wrapper div (line 52):

```tsx
<div className="flex items-center justify-center p-6 md:p-12">
```

Change to:

```tsx
<div className="flex items-center justify-center p-4 md:p-12">
```

- [ ] **Step 5: Verify landing and login pages**

Run dev server. Landing page heading should be smaller on mobile. Login page should have tighter padding and smaller heading on mobile.

- [ ] **Step 6: Commit**

```bash
git add src/routes/index.tsx src/routes/login.tsx
git commit -m "feat: adjust landing and login page typography and padding for mobile"
```

---

### Task 5: Groups List & New Group Page

**Files:**
- Modify: `src/routes/_authenticated/groups.index.tsx`
- Modify: `src/routes/_authenticated/groups.new.tsx`

- [ ] **Step 1: Fix groups list heading**

In `src/routes/_authenticated/groups.index.tsx`, find the heading (line 38):

```tsx
<h1 className="font-display text-4xl font-bold">Your groups</h1>
```

Change to:

```tsx
<h1 className="font-display text-3xl font-bold md:text-4xl">Your groups</h1>
```

- [ ] **Step 2: Fix groups list padding**

Find the main element (line 35):

```tsx
<main className="mx-auto max-w-6xl px-6 py-12">
```

Change to:

```tsx
<main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
```

- [ ] **Step 3: Fix new group page heading**

In `src/routes/_authenticated/groups.new.tsx`, find the heading (line 43):

```tsx
<h1 className="font-display text-4xl font-bold">Host a study group</h1>
```

Change to:

```tsx
<h1 className="font-display text-3xl font-bold md:text-4xl">Host a study group</h1>
```

- [ ] **Step 4: Fix new group page padding**

Find the main element (line 40):

```tsx
<main className="mx-auto max-w-5xl px-6 py-12">
```

Change to:

```tsx
<main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
```

- [ ] **Step 5: Verify groups list and new group pages**

Run dev server. Headings should be smaller on mobile. Padding should be tighter. Grids should stack properly.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authenticated/groups.index.tsx src/routes/_authenticated/groups.new.tsx
git commit -m "feat: adjust groups list and new group page typography and padding for mobile"
```

---

### Task 6: Touch Targets & Final Polish

**Files:**
- Modify: `src/routes/_authenticated/groups.$groupId.tsx` (member avatars)
- Modify: `src/components/Header.tsx` (verify touch targets)

- [ ] **Step 1: Reduce member avatar size on mobile**

In `src/routes/_authenticated/groups.$groupId.tsx`, find the member avatar div in `MembersTab` (line 507):

```tsx
<div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-display font-semibold text-primary">
```

Change to:

```tsx
<div className="grid h-8 w-8 md:h-10 md:w-10 place-items-center rounded-full bg-primary/15 font-display font-semibold text-primary">
```

- [ ] **Step 2: Verify all interactive elements have adequate touch targets**

Manually verify in browser dev tools that all buttons, links, and interactive elements are at least 40x40px on mobile. The hamburger menu button already has `h-10 w-10`. Check that:
- Sign-in button on login page is full-width (already `w-full`)
- "Host a group" CTA on landing page has adequate padding (already `px-6 py-3`)
- Tab triggers in group detail have enough padding
- Quick action buttons are large enough

- [ ] **Step 3: Run full responsive audit**

Open Chrome DevTools, toggle device toolbar, and check these viewports:
- iPhone SE (375px)
- iPhone 14 Pro (393px)
- iPad Mini (768px)
- iPad Pro (1024px)
- Desktop (1280px+)

Verify:
- [ ] Header: hamburger on mobile, inline nav on desktop
- [ ] Landing page: heading readable, CTAs accessible
- [ ] Login page: form fits, heading scales
- [ ] Groups list: cards stack on mobile, 2-col on tablet, 3-col on desktop
- [ ] Group detail: card padding adapts, tabs scrollable, chat fills viewport
- [ ] Admin: tables become cards on mobile, tabs scroll
- [ ] Dialogs: quiz builder/player don't overflow

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authenticated/groups.$groupId.tsx
git commit -m "feat: adjust touch targets and member avatar sizes for mobile"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: No build errors

- [ ] **Step 2: Lint check**

Run: `npm run lint` (if configured)
Expected: No lint errors

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit` (if configured)
Expected: No type errors

- [ ] **Step 4: Full manual responsive test**

Test every page at mobile (375px), tablet (768px), and desktop (1280px) widths. Document any remaining issues.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: responsive design polish and final adjustments"
```
