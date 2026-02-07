# Error Pattern: Settings Grid Orphan Cell from Mixed Column Spans

## What it looks like

- On desktop, the Settings page shows a large empty block on the right side.
- The gap appears beside one card (for example, Time Zone/Account) and directly above a full-width card (for example, Gemini API).
- The page feels visually "broken" even though all sections are present.

## Why it happens

This happens when a two-column CSS grid mixes:

1. cards that span both columns (`md:col-span-2`), and
2. an odd number of one-column cards between those full-width cards.

The odd card count leaves one empty grid cell. The next full-width card cannot fit that partially occupied row, so it moves to the next row and the empty area remains visible.

## How to detect it automatically

- Code review heuristic: In `md:grid-cols-2` layouts, check for mixed one-column and `md:col-span-2` cards.
- Count heuristic: If there are full-width cards with an odd number of single-column cards between them, expect an orphan cell.
- Test heuristic: Add a layout regression test that asserts cards intended to share a row are wrapped in a full-width container (`md:col-span-2`) with an internal split layout.

## How we fix it in this repo

- Keep the top-level settings grid as two columns.
- Ensure the number of single-column cards between full-width cards is even.
- If a feature removal makes that count odd, promote one nearby card to `md:col-span-2` (for example, the Graphics card) to consume the row.
- For grouped content (Time Zone + Account), use an internal responsive two-column grid inside a full-width deck when needed.
