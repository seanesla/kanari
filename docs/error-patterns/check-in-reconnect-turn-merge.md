# Check-in reconnect merges turns / restarts greeting

## What it looks like

- The assistant stops speaking mid-sentence.
- The next assistant transcript gets glued onto the previous bubble (e.g. `"...mightHey"` with no spacing).
- The user says something short like "what?" and it gets appended to their previous message bubble instead of creating a new one.
- After the drop, the model may restart with an intro/greeting ("Hey, it's Kanari...") and can get the time-of-day wrong.

## Why it happens

1. **No `onTurnComplete` event**
   - If the WebSocket drops (or Safari kills the socket), the Live API never emits `onTurnComplete`.
   - `useCheckInMessages` relies on `onTurnComplete` to reset its per-turn refs (`lastAssistantMessageIdRef`, `currentTranscriptRef`, etc.).
   - Without the reset, the next transcript event updates the last streaming message instead of starting a new one.

2. **Reconnect creates a brand new Live session**
   - `gemini.connect()` always creates a new session; the model has no memory of prior turns.
   - Without a recap, the model can behave like it is starting fresh (re-introduce itself, generic greeting, wrong time-of-day).

## How to detect it automatically

- Hook test:
  1. Emit a streaming assistant transcript (`onModelTranscript`).
  2. Emit `onDisconnected("network lost")`.
  3. After reconnect, emit another `onModelTranscript`.
  4. Assert **two assistant messages** exist (not one concatenated message).
  - Regression test lives in `hooks/__tests__/use-check-in-session.test.ts` ("does not merge assistant transcripts across reconnects").

## Fix

- On disconnect, force a turn reset:
  - finalize any streaming assistant message
  - clear per-turn transcript refs so the next connection starts a new bubble
  - mark a "pending utterance reset" so the next user transcript can't append to the previous user message

- On reconnect success, send a short recap to the model:
  - include current local time string and the last few messages
  - instruct the model to continue without re-introducing itself

## References

- `hooks/check-in/messages/use-check-in-messages.ts` (`handleConnectionInterrupted`)
- `hooks/use-check-in.ts` (disconnect recovery wiring)
- `hooks/use-check-in-session.ts` (reconnect recap)
