# Internal navigation: avoid `window.location.href`

## What the error looks like

- A stateful UI flow (demo tours, multi-step onboarding, overlays) resets when moving to another page.
- The app “jumps” between pages but loses context/state, or buttons appear to “disable” after navigation.

## Why it happens

`window.location.href = "/some-route"` triggers a full page reload.

In Next.js App Router, a full reload remounts providers and resets in-memory state (e.g. guided tours, overlays, React context), so any “continue after navigating” logic breaks.

## How to fix

- Use client-side navigation:
  - `router.push("/some-route")` (or `useTransitionRouter().push(...)` when using `next-view-transitions`)
- Keep navigation logic in a component/hook that can access the router, instead of embedding `window.location` inside plain objects.

## How to detect automatically

- Search for:
  - `window.location.href = "/`
  - `location.assign("/`
  - `location.replace("/`

For in-app navigation, these should almost always be replaced by router navigation.

