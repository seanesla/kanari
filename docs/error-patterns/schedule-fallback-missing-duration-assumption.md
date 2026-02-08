# Schedule fallback assumes missing duration

## What the error looks like

The user asks to schedule something with date/time but without duration, for example:

- "Schedule it for 11:00 PM tonight."

The app still creates a calendar event by guessing a duration (for example 20 or 30 minutes).

## Why it happens

- The client-side fallback scheduling path was designed to recover when Gemini does not call `schedule_activity`.
- That fallback inferred duration defaults from text even when the user did not provide one.
- This violates "do not assume scheduling details" behavior.

## How to detect it automatically

- Hook regression test:
  - send a schedule request with explicit date/time but no duration
  - advance fallback timer
  - assert no schedule widget/event is created

See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Require explicit duration before client fallback is allowed to auto-schedule.
- If duration is missing, skip fallback scheduling and let Gemini ask a clarifying question.
- Prompt instructions must also require duration clarification before `schedule_activity`.

## References

- `hooks/use-check-in-widgets.ts`
- `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
- `lib/gemini/live-prompts.ts`
