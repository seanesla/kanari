# Achievements can be completed by clicking (manual completion bypass)

## What it looks like
- Daily challenges (e.g. “Do a daily check-in”) can be completed instantly by clicking the achievement card or a “Mark complete” button.
- Users gain points / streak progress without actually doing the underlying in-app action.

## Why it happens
- UI code directly invoked `useAchievements().completeAchievement(...)` from click handlers.
- This bypassed the intended model: challenges should be *auto-tracked* and completed only when the relevant measurable action happens (check-ins, suggestions completed, suggestions scheduled).

## How to detect automatically
- UI regression tests that render the Achievements views and assert:
  - No “Mark complete” controls are present for challenges.
  - Clicking an achievement routes the user to the relevant feature instead of completing it.
  - Files:
    - `app/dashboard/achievements/__tests__/achievements-page.test.tsx`
    - `components/dashboard/__tests__/unified-dashboard-achievements.test.tsx`
- Static scan for direct UI calls to `completeAchievement(` outside `hooks/use-achievements.ts`.

## Fix pattern
- Do not expose “manual complete” affordances in the UI for trackable challenges.
- Route users to the feature that satisfies the challenge (e.g. check-in flow, suggestions board).
- Keep completion logic centralized in `use-achievements` via tracking + underlying data changes.

## Related code
- `hooks/use-achievements.ts` (auto-tracked completion)
- `app/dashboard/achievements/page.tsx` (challenge CTAs instead of manual completion)
- `components/dashboard/unified-dashboard.tsx` (preview routes to features; no manual completion)

