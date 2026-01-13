# FullCalendar drag/drop schedules to the wrong time (timezone shift)

## What the error looks like

On the dashboard calendar, you drag a scheduled item to a specific time slot, but after dropping:

- The event jumps to a different time/day than where it was dropped.

## Why it happens

FullCalendar’s `eventDrop` callback provides:

- `event.start` (a `Date`), and
- `event.startStr` (an ISO string).

Depending on configuration/runtime, `startStr` may be a **floating** datetime (no `Z`/offset). If the app converts `event.start` via `toISOString()` and stores that as an instant, the stored value can be shifted by the environment timezone instead of the app-selected timezone.

## How to detect it automatically

Component-level test:

- Simulate an `eventDrop` where `startStr` is floating (no offset) and `start` represents an offset-shifted instant.
- Assert the persisted `scheduledFor` matches the floating `startStr` interpreted in the app’s timezone.

See: `components/dashboard/calendar/__tests__/fullcalendar-view.test.tsx`

## Fix / prevention

- Prefer `event.startStr` for drag/drop rescheduling.
  - If `startStr` includes `Z` or a numeric offset, treat it as an instant.
  - If it has **no** offset, interpret it as a `Temporal.PlainDateTime` in the app-selected timezone and convert to an instant.
- Fall back to `event.start` only when `startStr` is unavailable/unparseable.

## References

- `components/dashboard/calendar/fullcalendar-view.tsx`

