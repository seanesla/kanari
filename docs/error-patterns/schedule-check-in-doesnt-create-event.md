# "Schedule a check-in" doesn’t create a calendar event

## What the error looks like

In an AI voice check-in, the user says something like:

- “Schedule a check-in **today at 10:00 PM**.”

But:

- No scheduled event appears at 10:00 PM.
- The Overview calendar only shows the **current** check-in session marker (e.g., around “now”), which can be mistaken for the scheduled item.
- The user feels like the conversation “stopped” because there’s no clear confirmation and nothing appears on the calendar.

## Why it happens

- The app relies on Gemini Live function calling (`schedule_activity`) to create scheduled items.
- Models sometimes do not call the tool for “check-in” phrasing, or may not provide enough structured data for the tool call.
- Separately, the Overview calendar renders **completed check-in sessions** as events at their `startedAt` time, which can be confused with a “scheduled check-in”.

## How to detect it automatically

- Unit test: send a user message like “Schedule a check-in today at 10:00 PM.” and assert that:
  - a `schedule_activity` widget is created, and
  - the scheduled instant matches the user’s explicit time.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Add a conservative client-side fallback:
  - Only auto-schedule when the user provides an **explicit** date (e.g., “today/tomorrow” or `YYYY-MM-DD`) and an **explicit** time (AM/PM or 24h).
  - Give Gemini a short window to call `schedule_activity` first to avoid double scheduling.
- Make completed check-in markers visually/textually distinct from scheduled items (e.g., prefix with `✓ Check-in`).

