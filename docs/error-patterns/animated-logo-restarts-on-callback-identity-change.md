# Error Pattern: Animation Restarts When Callback Prop Identity Changes

## What it looks like

- A “startup” SVG/logo animation finishes (stroke draw → fill), then briefly resets/unfills and may start over.
- It often happens right after the animation completes, when the parent sets state (e.g. to prewarm a canvas) but keeps the overlay visible for a short transition.

## Why it happens

If an animation sequence is started inside a `useEffect` that depends on a callback prop (like `onComplete`):

- the parent re-renders (creating a new callback function identity)
- the child effect re-runs because `onComplete` changed
- the animation controller is driven back to its initial variant/state (e.g. “drawing” sets fill opacity back to `0`)

This produces a visible “unfill” flash even though the overlay is still visible.

## How to detect it automatically

- Code search for effects that “kick off” an animation sequence and include a callback prop in the dependency list:
  - `useEffect(() => { startAnimation(); onComplete?.() }, [onComplete, ...])`
- Particularly suspicious when the effect drives variants that reset visible state (`opacity: 0`, `fillOpacity: 0`, `pathLength: 0`).

## Fix / Prevention

- Start the animation sequence exactly once per mount:
  - guard with a `useRef` flag (e.g. `hasStartedRef`)
- Keep callback freshness without re-triggering the animation:
  - store `onComplete` in a ref (`onCompleteRef`) and update it in a separate effect

This prevents “callback identity churn” from restarting animations during state transitions.

