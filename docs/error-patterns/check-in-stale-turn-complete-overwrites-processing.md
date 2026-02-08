# Stale `turnComplete` overwrites processing state during scheduling

## What the error looks like

During a check-in where the user asks Kanari to schedule something:

- The UI briefly says `Thinking...`, then flips back to `Ready` too early.
- The user can keep talking/typing while Kanari is still processing the scheduling request.
- In some sessions, status can flicker (`Ready`/`Connecting`) and assistant text can feel duplicated or stitched together.

## Why it happens

- Gemini can emit `turnComplete` for the previous turn slightly after the user already sent a new turn.
- The old `turnComplete` event incorrectly forced state back to `listening`, even though the new turn was still pending.
- While state looked idle/ready, the app allowed additional mic and text input, which could interleave turns and cause unstable behavior during tool calls (like `schedule_activity`).

## How to detect it automatically

- Hook test: send assistant transcript, send a new user message, then immediately fire `onTurnComplete`.
- Expected: state remains `processing` until the new turn starts returning model output.
- See: `hooks/__tests__/use-check-in-messages.test.ts`

Also verify mic gating while processing:

- Hook test: when state is `processing`, captured mic chunks should not call `gemini.sendAudio`.
- See: `hooks/__tests__/use-check-in-messages.test.ts`

## Fix / prevention

- Track pending user turns and ignore very-early `turnComplete` events that arrive before any output for that new turn.
- Block mic streaming while the model is `processing` (and while schedule persistence is in-flight).
- Keep reconnects from forcing full-screen `connecting` UI, so transient reconnects do not look like a refresh.
- Show explicit in-flight scheduling UI (`Scheduling...`) on schedule widgets.

## References

- `hooks/check-in/messages/use-check-in-messages.ts`
- `hooks/use-check-in.ts`
- `hooks/use-check-in-session.ts`
- `hooks/use-check-in-widgets.ts`
- `components/check-in/widgets/schedule-confirmation.tsx`
