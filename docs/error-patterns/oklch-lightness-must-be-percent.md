# Error Pattern: OKLCH Lightness Without `%` (iOS Safari renders near-black)

## What it looks like

- On iOS Safari (and some WebKit builds), text and UI colors look nearly black on a dark background.
- Accent colors may look “off” or extremely dim.
- The same page looks correct on desktop Chrome/Edge.

## Why it happens

In CSS, `oklch()` lightness is specified as a **percentage** (e.g. `93%`), not a 0–1 float (e.g. `0.93`).

If we emit values like `oklch(0.93 0.01 60)`, some browsers interpret `0.93` as **0.93%** lightness, which is almost black.

In this repo, this can be triggered by:

- Static tokens in `app/globals.css`.
- Runtime theming via `updateCSSVariables()` (used by `components/color-sync.tsx`).

## How to detect it automatically

- Unit test the generated OKLCH strings to ensure the first component includes `%`.
  - See: `lib/__tests__/color-utils.test.ts`
- Grep for `oklch(0.` style literals in CSS sources.

## How we fix it in this repo

- Always emit percent lightness in OKLCH strings:
  - `oklch(93% 0.01 60)` (good)
  - `oklch(0.93 0.01 60)` (bad / can be interpreted as 0.93%)

