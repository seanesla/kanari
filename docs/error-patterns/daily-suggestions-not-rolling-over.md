# Daily Suggestions Do Not Roll Over (Duplicates Build Up)

## What the error looks like

- The Kanban board shows the same (or similar) suggestions repeated across days.
- The calendar renders stacked duplicate events at the same time slot.
- “Yesterday’s” uncompleted suggestions remain visible today instead of being replaced.

## Why it happens

- Suggestions are persisted in IndexedDB and treated as global.
- Without a day-boundary cleanup, pending/scheduled-but-uncompleted items carry forward forever.
- During calendar rendering, duplicated underlying data results in duplicated UI.

## How we detect it automatically

- A pure rollover function computes which suggestions are expired based on the user’s time zone.
- Unit tests cover:
  - Pending suggestions created before today are expired.
  - Scheduled suggestions scheduled before today are expired.
  - Time zone boundaries are respected.

See: `lib/suggestions/__tests__/rollover.test.ts`

## Fix

- On a daily boundary (checked at least once per minute while the app is open):
  - Delete uncompleted suggestions from previous days.
  - Delete any recovery blocks linked to those suggestions.
  - Optionally auto-generate a new set for today if none exist (based on latest check-in metrics).

Relevant code:
- `hooks/use-suggestions.ts`
- `lib/suggestions/rollover.ts`

## Notes

- Calendar views defensively de-duplicate events by `event.id` to avoid stacked duplicates
  if upstream data is duplicated.

Relevant code:
- `components/dashboard/calendar/fullcalendar-view.tsx`
