# recurring schedule creates per-occurrence confirmation spam

## What the error looks like

During a recurring schedule request (for example, weekdays until a future date), the chat tool rail shows one "Scheduled activity" confirmation card per occurrence.

This forces users to dismiss many cards one-by-one with repeated X clicks.

## Why it happens

- Recurring scheduling expands into many individual occurrences.
- The recurring loop reused `scheduleSingleActivity`.
- `scheduleSingleActivity` emitted a `schedule_activity` widget as a side effect for every successful/failed occurrence.

The scheduling persistence logic was correct, but the UI feedback was still shaped like a single-event flow.

## How to detect it automatically

- Hook regression test:
  - trigger `schedule_recurring_activity` with `count > 1`
  - assert `schedule_activity` widget count is `0`
  - assert exactly one `schedule_recurring_summary` widget exists
  - assert assistant aggregate message still reports scheduled/failed/duplicate counts

See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Separate persistence from per-occurrence UI side effects.
- Keep per-occurrence saves and calendar sync, but suppress per-occurrence confirmation cards for recurring runs.
- Emit one `schedule_recurring_summary` widget that tracks progress/results for the whole batch.
- Keep the aggregate assistant summary message for transcript continuity.

## References

- `hooks/use-check-in-widgets.ts`
- `components/check-in/widgets/schedule-recurring-summary.tsx`
- `components/check-in/check-in-dialog.tsx`
- `components/dashboard/check-in-ai-chat.tsx`
