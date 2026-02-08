# schedule_activity title/duration override miss

## What the error looks like

During a check-in, the user asks for a specific event with a long duration, for example:

- "Please schedule watching the Super Bowl with my dad at 9:07 PM for five hours."

But the saved calendar item can drift to model defaults, such as:

- title saved as "Check-in"
- duration saved as 30 minutes

## Why it happens

There were two gaps in the tool-args correction path:

1. **Title override was too narrow**
   - We only replaced obviously generic titles (e.g. "Scheduled activity").
   - If the model emitted "Check-in" for a non-check-in request, that mismatched title was trusted.

2. **Duration extraction did not cover spoken-number wording**
   - `extractDurationMinutesFromText()` only handled numeric tokens (e.g. `5 hours`).
   - Common transcript wording like `five hours` was ignored, so model defaults stayed in place.

## How to detect it automatically

- **Tool regression test (mismatched title + spoken duration)**
  - Simulate user text with a specific activity and `five hours`.
  - Simulate `schedule_activity` tool args with `title: "Check-in"` and `duration: 30`.
  - Assert persisted suggestion and widget args keep user activity wording and duration `300`.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

- **Fallback regression test (spoken duration)**
  - Simulate client-side auto-scheduling from user text using `five hours`.
  - Assert scheduled duration is `300` and title remains specific.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

- **Duration parser test**
  - Assert `extractDurationMinutesFromText("for five hours") === 300`.
  - See: `lib/scheduling/__tests__/duration.test.ts`

## Fix / prevention

- Treat `Check-in` as a placeholder title when the user did **not** ask for a check-in.
- Parse spoken-number durations (`one` through `twelve`) for minutes/hours.
- Allow explicit durations up to 12 hours (720 minutes) so legitimate long activities are preserved.
- Continue preferring explicit user-provided title/time/duration over drifted tool args.

## References

- `hooks/use-check-in-widgets.ts`
- `lib/scheduling/duration.ts`
- `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
- `lib/scheduling/__tests__/duration.test.ts`
