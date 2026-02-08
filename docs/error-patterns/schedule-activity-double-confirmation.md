# schedule_activity double confirmation in chat

## What the error looks like

During check-in scheduling, the assistant appears to reply twice for the same action:

- model says it scheduled the activity
- app adds another "Done — scheduled ..." message right after

This can feel like duplicated assistant output even when only one activity was scheduled.

## Why it happens

- The prompt instructs Gemini to confirm after calling `schedule_activity`.
- The client also injected its own confirmation message in the schedule widget handler.
- Both paths were valid independently, but together produced duplicate confirmations.

## How to detect it automatically

- Hook-level regression test:
  - emit an assistant scheduling confirmation transcript
  - emit `schedule_activity` widget
  - assert only one assistant message containing "scheduled" remains

See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Do not inject an extra app-generated chat confirmation for Gemini-triggered `schedule_activity`.
- Keep the schedule widget confirmation card as the durable UI confirmation.
- Keep fallback-only confirmation messaging for the client fallback scheduling path.

## References

- `hooks/use-check-in-widgets.ts`
- `lib/gemini/live-prompts.ts`
- `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
