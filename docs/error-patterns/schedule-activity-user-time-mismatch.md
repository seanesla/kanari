# schedule_activity user time mismatch (AM/PM + minute rounding)

## What the error looks like

During a conversational check-in, the user says something time-specific like:

- "Schedule me an appointment at **9:30 PM**"

But the AI-triggered widget/tool call (`schedule_activity`) results in:

- An event scheduled at **09:30** (AM/PM flipped), or
- An event scheduled at **21:00** (minutes rounded to the hour),
- And the confirmation widget may show a different time than the calendar entry.

## Why it happens

- The `schedule_activity.time` parameter is strictly `HH:MM` **24h**.
- Models sometimes:
  - lose the meridiem when converting "9:30 PM" → `09:30`, or
  - round minutes "9:30 PM" → `21:00`.
- If the app blindly trusts `schedule_activity` args, the event will be created at the wrong instant.

## How to detect it automatically

- Unit tests should simulate:
  1) a user message containing an explicit AM/PM time, and
  2) a `schedule_activity` tool call with a mismatched `time`.
- Assert the scheduled instant (and widget args) reflect the user’s explicit time.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Prefer the user’s **explicit** time from the most recent user message when it is unambiguous:
  - Only override when AM/PM is present (or a 24h time with hour ≥ 13).
  - Do **not** override ambiguous phrases like "at 9:30" (no AM/PM).
- Keep UI consistent: if the app corrects the time, store the corrected `args.time` in the widget state so the confirmation matches the calendar.
- Strengthen the Live system prompt to explicitly require:
  - no minute rounding, and
  - precise AM/PM → 24h conversion.

