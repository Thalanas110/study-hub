# Responsive Design Overhaul — Studyhive

## Problem Statement

The app has basic Tailwind responsive prefixes (`md:`, `lg:`) on grids and text, but several areas break or feel awkward on smaller screens. The header has no mobile menu, admin tables overflow on phones, the chat has a fixed height, and touch targets are undersized for mobile.

## Approach

**Tailwind-only fixes** — all responsive behavior stays in Tailwind classes. No new component abstraction layer, no CSS media queries. Use existing shadcn/ui `Sheet` component for the mobile nav. Minimal new code, consistent with existing patterns.

## Design

### 1. Mobile Navigation (Header)

**File:** `src/components/Header.tsx`

- Wire up the existing `useIsMobile()` hook from `src/hooks/use-mobile.tsx`
- **Desktop (md+):** Current nav stays as-is
- **Mobile (<md):** Show a hamburger `Menu` icon button that opens a shadcn/ui `Sheet` (slide-in drawer from right)
- Sheet content: same nav links stacked vertically, sign-out button at bottom
- Use `useIsMobile()` to conditionally render hamburger vs. inline nav

### 2. Admin Tables → Stacked Cards on Mobile

**File:** `src/routes/_authenticated/admin.tsx`

- Replace the generic `Table` component with a responsive version
- **Desktop (md+):** Current `<table>` layout
- **Mobile (<md):** Each row renders as a card with label-value pairs stacked vertically
- Implementation: The `Table` wrapper checks viewport via `useIsMobile()` and renders either `<table>` or a `<div>` grid of cards
- Each card shows column headers as muted labels above their values

### 3. Chat Height

**File:** `src/routes/_authenticated/groups.$groupId.tsx` (ChatTab)

- Change `h-[480px]` to responsive: `h-[50vh] md:h-[480px]`
- This gives the chat 50% of viewport height on mobile, fixed height on desktop

### 4. Quiz Dialogs

**File:** `src/routes/_authenticated/groups.$groupId.tsx` (QuizBuilder, QuizPlayer)

- Add `w-[calc(100vw-2rem)] max-w-2xl` to `DialogContent` so dialogs don't overflow on small screens
- Reduce inner padding on mobile: `p-4 md:p-6`

### 5. Grid & Typography Adjustments

| Location | Current | Change |
|----------|---------|--------|
| Landing heading | `text-5xl md:text-7xl` | `text-4xl md:text-7xl` |
| Group detail heading | `text-4xl font-bold` | `text-3xl md:text-4xl font-bold` |
| Quick action buttons | `sm:grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| Group detail card | `p-8` | `p-4 md:p-8` |
| Main content areas | `px-6` | `px-4 md:px-6` |
| Groups list heading | `text-4xl` | `text-3xl md:text-4xl` |
| Login heading | `text-3xl` | `text-2xl md:text-3xl` |

### 6. Touch Targets & Spacing

- All interactive elements: ensure `min-h-10 min-w-10` for touch targets
- Admin tab bar: add `overflow-x-auto` for horizontal scroll on mobile
- Group detail member badges: reduce avatar size on mobile (`h-8 w-8 md:h-10 md:w-10`)

## Files to Modify

1. `src/components/Header.tsx` — mobile nav with Sheet
2. `src/routes/_authenticated/admin.tsx` — responsive Table, tab scroll, padding
3. `src/routes/_authenticated/groups.$groupId.tsx` — chat height, quiz dialogs, grids, padding, typography
4. `src/routes/index.tsx` — heading size, padding
5. `src/routes/login.tsx` — heading size, padding
6. `src/routes/_authenticated/groups.index.tsx` — heading size, padding
7. `src/routes/_authenticated/groups.new.tsx` — padding (verify stacking)

## Out of Scope

- New CSS media queries (all Tailwind)
- Dark mode responsive variants
- New reusable component abstractions
- Animation/transition changes
