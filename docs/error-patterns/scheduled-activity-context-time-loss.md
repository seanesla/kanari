# Scheduled activity context time loss + tool arg normalization drift

## What the error looks like

Two user-visible symptoms can appear together:

1. **Schedule succeeds, then AI asks for time again**
   - User asks: "Schedule X at 9pm for 30 minutes."
   - Kanari shows a scheduled confirmation.
   - Immediately after, the AI asks a clarifying time question anyway.

2. **New chat cannot recall exact scheduled time**
   - User returns in a new check-in and asks: "Do I have anything at 9pm?"
   - AI says no, even though the activity exists in IndexedDB.

## Why it happens

There are two related causes:

1. **Tool arg normalization drift**
   - Gemini may emit `schedule_activity.time` in AM/PM form (e.g. `"9:00 PM"`).
   - If validation is strict `HH:MM` only, the tool call gets rejected as `invalid_args`.
   - Meanwhile, the client fallback scheduler may still create the event from user text.
   - Result: model flow and app state diverge, producing contradictory follow-up questions.

2. **Follow-up context dropped schedule time**
   - Follow-up prompt context listed recent suggestions without `scheduledFor` time.
   - The model knew an item existed, but not *when*.
   - In supportive mode, follow-up context could be omitted entirely, worsening recall.

## How to detect it automatically

- **Schema test**
  - `ScheduleActivityArgsSchema` accepts AM/PM strings and normalizes to `HH:MM`.
  - See: `lib/gemini/__tests__/schemas.test.ts`

- **Live client test**
  - Simulate a `schedule_activity` tool call with `time: "9:00 PM"` and assert:
    - widget event is emitted,
    - normalized time is `"21:00"`,
    - tool response is acknowledged (not `invalid_args`).
  - See: `lib/gemini/__tests__/live-client.test.ts`

- **Prompt test**
  - `buildCheckInSystemInstruction()` includes `Scheduled for:` in recent suggestion lines.
  - Ensure this remains true in supportive mode for factual schedule recall.
  - See: `lib/gemini/__tests__/live-prompts.test.ts`

## Fix / prevention

- Normalize schedule tool time input at schema boundary (accept `HH:MM` and AM/PM variants).
- Include scheduled timestamps in follow-up context (`Scheduled for: ...`).
- Keep recent scheduled suggestion context available in supportive mode, but avoid commitment pressure.

## References

- `lib/gemini/schemas.ts`
- `lib/gemini/live-client.ts`
- `hooks/use-check-in-session.ts`
- `lib/gemini/live-prompts.ts`
