# Dashboard section missing entry animation (does not use `visible` state)

## What it looks like
- On the Overview page (`/dashboard`), most sections fade/slide in on navigation, but a specific block appears instantly with no entry animation.
- Example: the “Today’s Achievements” block renders immediately while the header and main panels animate in.

## Why it happens
- The dashboard uses a shared `visible` flag (driven by `useDashboardAnimation()`) to apply consistent mount animations.
- A section that isn’t wrapped with the `visible ? "opacity-100 …" : "opacity-0 …"` classes will never participate in the entry animation.

## How to detect automatically
- UI unit test with fake timers:
  - Render `UnifiedDashboard` with `shouldAnimate: true`.
  - Assert the section starts with `opacity-0`, then becomes `opacity-100` after the initial timeout.
  - File: `components/dashboard/__tests__/unified-dashboard-daily-achievements-animation.test.tsx`

## Fix pattern
- Wrap the section with a container that:
  - Uses the shared `visible` state for `opacity/translate` classes.
  - Has a consistent transition (`transition-all duration-1000`) and an appropriate delay so sections cascade.

## Related code
- `components/dashboard/unified-dashboard.tsx` (entry animation wrappers)
- `components/dashboard/__tests__/unified-dashboard-daily-achievements-animation.test.tsx` (regression test)

