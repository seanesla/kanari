# Voice transcript utterance boundary missing

## What it looks like

- Multiple user replies in AI chat (voice) show up as a single orange bubble.
- Session history shows fewer user messages than expected (e.g., 2 user turns become 1 user message).
- New user utterances appear appended onto the previous user message content.

## Why it happens

- `hooks/use-check-in.ts` streams voice transcripts via `onUserTranscript` and updates a single in-flight user message using `lastUserMessageIdRef`.
- The hook resets `userTranscriptRef` and `lastUserMessageIdRef` on `onUserSpeechStart` (VAD speech-start).
- In some Gemini Live event orderings, `onUserSpeechStart` is never emitted, so the next user turn keeps updating the previous message ID and transcript buffer, causing cross-turn concatenation.

## How to detect it automatically

- Add a test that simulates:
  1. `onUserTranscript("first turn", false)` (no `onUserSpeechStart`)
  2. `onTurnComplete()` (assistant finishes replying)
  3. `onUserTranscript("second turn", false)`
- Assert there are **two** user messages in the conversation, not one message with concatenated content.

## Fix

- Treat the end of the assistant turn (returning to `listening`) as a boundary for the next user utterance.
- On the next `onUserTranscript` chunk after that boundary, reset:
  - `userTranscriptRef`
  - `lastUserMessageIdRef`
  - `audioChunksRef` (to avoid mixing audio across utterances)
- Use a transcript merge helper (e.g., prefix-based cumulative detection) instead of naïve string concatenation to handle delta vs cumulative updates.

## References

- `hooks/use-check-in.ts`
- `hooks/__tests__/use-check-in-audio.test.ts`

