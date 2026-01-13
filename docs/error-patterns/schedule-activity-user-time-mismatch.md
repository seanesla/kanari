# schedule_activity user time mismatch (AM/PM + minute rounding)

## What the error looks like

During a conversational check-in, the user says something time-specific like:

- "Schedule me an appointment at **9:30 PM**"

But the AI-triggered widget/tool call (`schedule_activity`) results in:

- An event scheduled at **09:30** (AM/PM flipped), or
- An event scheduled at **21:00** (minutes rounded to the hour),
- Or the tool args contain a non-24h string like **"10:00 PM"**, causing the widget to fail with **"Invalid date/time"**,
- And the confirmation widget may show a different time than the calendar entry.

## Why it happens

- The `schedule_activity.time` parameter is strictly `HH:MM` **24h**.
- Models sometimes:
  - lose the meridiem when converting "9:30 PM" → `09:30`, or
  - round minutes "9:30 PM" → `21:00`.
- Some model variants violate the schema entirely and emit `time` with AM/PM (e.g. `"10:00 PM"`), which breaks naive `HH:MM` parsing.
- If the app blindly trusts `schedule_activity` args, the event will be created at the wrong instant.

## How to detect it automatically

- Unit tests should simulate:
  1) a user message containing an explicit AM/PM time, and
  2) a `schedule_activity` tool call with a mismatched `time`.
- Add a regression test where the tool emits `"10:00 PM"` and assert we still schedule successfully.
- Assert the scheduled instant (and widget args) reflect the user’s explicit time.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Prefer the user’s **explicit** time from the most recent user message when it is unambiguous:
  - Only override when AM/PM is present (or a 24h time with hour ≥ 13).
  - Do **not** override ambiguous phrases like "at 9:30" (no AM/PM).
- Normalize tool `time` strings when possible:
  - Accept `"10:00 PM"`, `"10pm"`, etc and convert to `HH:MM` before scheduling.
- Keep UI consistent: if the app corrects the time, store the corrected `args.time` in the widget state so the confirmation matches the calendar.
- Strengthen the Live system prompt to explicitly require:
  - no minute rounding, and
  - precise AM/PM → 24h conversion.
