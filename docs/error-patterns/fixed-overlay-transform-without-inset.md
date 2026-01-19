# Fixed overlays positioned by transform must be anchored

## What the error looks like

- Tour tooltips / spotlights render off-screen (or not at all).
- Overlays “work sometimes” depending on scroll position or DOM placement.
- Highlight rectangles/tooltip positions are wildly incorrect even though computed coordinates look right.

## Why it happens

Framer Motion’s `x`/`y` props apply a **CSS transform** (translate), not `left`/`top`.

If a `position: fixed` overlay does **not** explicitly set `top: 0` and `left: 0` (or another known anchor), its “static position” depends on where it sits in the DOM. Translating from that unknown origin makes viewport-relative coordinates meaningless, often pushing overlays off-screen.

## How to fix

- When using viewport coordinates via `x`/`y`, always anchor fixed overlays:
  - Tailwind: add `left-0 top-0` to the fixed layer
  - Or set `style={{ left: 0, top: 0 }}`
- If you actually want absolute positioning, consider using `left`/`top` instead of `x`/`y`.

## How to detect automatically

- Search for a combination of:
  - `className="fixed ..."` (or `position: fixed`)
  - `animate={{ x: ..., y: ... }}` / `style={{ x: ..., y: ... }}` / any viewport-coordinate based transform positioning

Flag any fixed overlay layer that uses `x`/`y` transforms without an explicit anchor (`left-0 top-0`, `inset-0`, etc.).

