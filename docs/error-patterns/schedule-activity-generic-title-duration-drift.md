# schedule_activity generic title + duration drift

## What the error looks like

During a check-in, the user asks for a specific activity with a specific duration, for example:

- "Schedule cooking chicken noodle soup today at 10:00 PM for 30 minutes."

But the scheduled result can become generic, such as:

- title shown as "Rest activity" or "Scheduled activity"
- duration saved as a default value (often 20 minutes) instead of the user's explicit duration

## Why it happens

Two paths could lose user detail:

1. **Fallback title inference was too generic**
   - The fallback scheduler inferred only a few keyword-based titles.
   - Free-form activities often fell back to "Scheduled activity".

2. **Tool path trusted generic model args**
   - `schedule_activity` handling corrected time from user text, but not title/duration.
   - If model args were generic (e.g., "Rest activity", `duration: 20`), those values were persisted.

## How to detect it automatically

- **Scheduling inference test**
  - Assert free-form text preserves specific activity wording.
  - See: `lib/scheduling/__tests__/infer.test.ts`

- **Widget/tool regression test**
  - Simulate a user message with explicit activity + duration, then a generic `schedule_activity` tool call.
  - Assert saved suggestion and widget args use the user-specific activity and duration.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

- **Fallback regression test**
  - Simulate fallback auto-scheduling from free-form text.
  - Assert the scheduled suggestion keeps specific activity text and explicit duration.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Improve free-form title extraction to keep user activity phrases after "schedule ...".
- In `schedule_activity` tool handling, replace generic titles with user-inferred titles when available.
- If the user explicitly states duration (e.g., "for 30 minutes"), use that duration over generic tool defaults.

## References

- `lib/scheduling/infer.ts`
- `hooks/use-check-in-widgets.ts`
- `lib/scheduling/__tests__/infer.test.ts`
- `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
