# Dashboard animation flag not resetting on route change

## What it looks like
- After refreshing while on a `/dashboard` route, navigating to other dashboard pages shows no fade/slide entry animations.
- Animations still appear when arriving from landing or onboarding, then moving quickly within the dashboard.

## Why it happens
- The `/dashboard` App Router layout persists across all nested pages.
- The animation flag (`shouldAnimate`) was only set to `true` on the first mount, then flipped to `false` after 150 ms.
- Subsequent in-dashboard navigations reuse the same layout instance, so pages mount while `shouldAnimate` remains `false`, skipping their entry animations.

## How to detect automatically
- Unit test that renders the dashboard layout, advances time past the initial animation window, then simulates a new dashboard pathname and asserts the animation flag resets to `true` before timing out again.
- File: `app/dashboard/__tests__/dashboard-animation.test.tsx` covers this scenario.

## Fix pattern
- Reset per-route ephemeral UI state by remounting a keyed provider on `usePathname()` so each dashboard page gets a fresh initial animation window.

## Related code
- `app/dashboard/layout.tsx` (animation provider keyed by pathname)
- `app/dashboard/__tests__/dashboard-animation.test.tsx` (regression test)
