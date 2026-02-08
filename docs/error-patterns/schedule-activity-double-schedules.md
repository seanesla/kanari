# schedule_activity double-schedules (duplicate calendar events)

## What the error looks like

During a check-in, the user says something like:

- “Schedule an appointment today at 10:00 PM.”

But the app creates **two** scheduled events (often identical) in the calendar.

## Why it happens

There are two common sources of duplication:

1) **Client fallback + late tool call**
   - The client-side fallback auto-schedules when the user provides an explicit date/time.
   - If Gemini later emits `schedule_activity` (after the fallback window), both paths create events.

2) **Duplicate tool calls**
   - Some model responses emit `schedule_activity` more than once for the same request.

Without an idempotency/deduplication layer, both cases create multiple suggestions and therefore multiple calendar boxes.

## How to detect it automatically

Hook-level tests:

- Trigger the fallback first, then emit a late `schedule_activity` and assert only one calendar sync occurs.
- Emit two identical `schedule_activity` widget events and assert only one calendar sync occurs.

See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Maintain a per-session dedupe set keyed by the scheduled instant plus normalized activity title (`scheduledFor + title`).
- When a schedule attempt arrives (fallback/manual/tool), skip it if an identical instant/title pair was already handled in the current session.
- This preserves idempotency for duplicate tool calls while still allowing intentionally different activities at the same time.
- Clear the dedupe map when the check-in session changes.

## References

- `hooks/use-check-in-widgets.ts`
