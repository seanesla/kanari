# Floating UI tooltip animates from the top-left corner (transform override)

## What the error looks like

When opening a Floating UI popover/tooltip (e.g. the Overview calendar “Check-in” popup), the UI:

- Briefly renders the popup at the page origin (top-left), then
- Jumps/slides to the correct anchor position.

This looks like the popup “flies in” from the corner even though it should appear directly next to the clicked item.

## Why it happens

Floating UI positions elements by writing `transform: translate(x, y)` (via `floatingStyles`).

If the popup also uses an “enter” animation that animates `transform` (e.g. Tailwind’s `animate-in` + `zoom-in-*` from `tailwindcss-animate`), the animation’s keyframes temporarily override the `transform` from `floatingStyles`.

Result: during the animation, the element’s transform is effectively “reset” (often to translate(0,0)), so it appears in the top-left corner, then snaps to the correct position when the animation completes and the inline transform takes over again.

## How to detect it automatically

- Look for a floating element that applies both:
  - `style={floatingStyles}` (or otherwise sets `transform: translate(...)`), and
  - an enter animation that animates `transform` (e.g. `animate-in`, `zoom-in-*`, `slide-in-*`).

Component-level test:

- Render the tooltip with `open=true`.
- Assert it is not visible initially, then becomes visible once positioned.

See: `components/dashboard/calendar/__tests__/check-in-tooltip.test.tsx`

## Fix / prevention

- Keep positioning on an outer wrapper element and run the enter animation on an inner wrapper:
  - Outer: `ref={refs.setFloating}` + `style={floatingStyles}`
  - Inner: the existing popup UI + `animate-in` / `fade-in-*` / `zoom-in-*`
- Optionally hide the outer wrapper until `isPositioned === true` to avoid any first-paint flicker.

## References

- `components/dashboard/calendar/check-in-tooltip.tsx`
- `components/dashboard/calendar/__tests__/check-in-tooltip.test.tsx`
