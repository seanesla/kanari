# Voice transcript message commit happens too late

## What it looks like

- After the user finishes speaking, their message *does not* appear in the chat immediately.
- The UI may show “Thinking…” with no visible user message.
- The user message only appears when the assistant begins speaking (first audio chunk), which feels laggy and confusing.

## Why it happens

- The app only “commits” the user’s voice transcript into the `messages[]` array as a fallback during the model’s first audio chunk.
- In some event orderings, speech-end fires before the final transcript chunks arrive; the transcript preview disappears when state transitions to `processing`, leaving no visible text until assistant audio starts.

## How to detect it automatically

- Add a unit/integration test harness that simulates the event order:
  1. `onUserSpeechStart`
  2. `onUserSpeechEnd` (before transcript fully populated)
  3. transcript chunks arriving while `processing`
  4. model audio starting
- Assert a user message bubble exists before any assistant audio events.
- UI-level regression: ensure `ConversationView` does not render both a streaming user message bubble and a separate transcript preview bubble (see `components/check-in/__tests__/conversation-view.test.tsx`).

## Fix

- Create a user message bubble as soon as transcript chunks arrive (update in place).
- Finalize the user message at speech end (or at latest when model audio starts), instead of waiting to create it on model audio.

## References

- `hooks/use-check-in.ts`
- `components/check-in/conversation-view.tsx`

