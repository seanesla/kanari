# Route transition overlay lingers after navigation

## What the error looks like

- Navigating between route groups (e.g. landing `/` <-> app `/overview`) triggers the route transition.
- The transition itself plays, but the screen stays dimmed for several seconds (~4-5s) after the new page has already loaded.

## Why it happens

The route transition state machine needs to schedule an “exit” (hide) when the new route arrives.

This bug happens when a single field (`toPathname`) is used for two different meanings:

1. The *intended* navigation target (set immediately when the click starts)
2. A *marker* meaning “we already handled arrival for this pathname” (used to avoid rescheduling)

If arrival is to the exact intended pathname (the common case), the “already handled arrival” guard incorrectly fires, so the hide is never scheduled. The overlay stays visible until a long fail-safe timeout hides it.

## How to detect it automatically

- Unit test: start a managed transition via `begin("/overview")`, then simulate the pathname changing to `/overview`, and assert the overlay becomes not-visible within a short window (well under the fail-safe timeout).
- See: `lib/__tests__/route-transition-context.test.tsx`

## Fix

- Keep `toPathname` for diagnostics/intended target.
- Track “arrival already handled” in a separate field (e.g. `arrivalPathname`).
