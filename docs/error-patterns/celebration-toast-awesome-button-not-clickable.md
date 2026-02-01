# Celebration toast: “Awesome!” button not clickable

## What it looks like

- After completing an achievement, a celebration modal appears.
- The “Awesome!” button looks enabled, but clicks don’t register (or only dismiss when clicking the backdrop).

## Why it happens

If the overlay/backdrop click-capture relies on `pointer-events: none` on a full-screen container (with `pointer-events: auto` on descendants), some browser/layout combinations can cause descendant buttons to not receive pointer events reliably.

## How to detect it automatically

- Render `CelebrationToast` in a jsdom test and assert clicking the “Awesome!” button calls `onOpenChange(false)` and `onDismiss()`.

## Fix

- Make the full-screen overlay explicitly clickable (`onClick={dismiss}`), and stop propagation on the toast card itself.
- Keep the backdrop purely visual (no click handler needed).

Related implementation: `components/achievements/achievement-toast.tsx`.

