# Transcript replayed-subset duplication

## What the error looks like

An assistant message suddenly repeats a long clause in the same bubble, for example:

- initial: "Got it, I've scheduled ... how are you feeling about the plan?"
- then appended replay: "I've scheduled ... how are you feeling about the plan?"

The result looks like one sentence duplicated back-to-back.

## Why it happens

- Some streaming transcript sources replay a long subset that already exists in the current transcript.
- The merge logic can treat it as a new delta and append it.
- This duplicates text even though the incoming chunk was not new content.

## How to detect it automatically

- Unit test `mergeTranscriptUpdate(previous, incomingSubset)` where `incomingSubset` is already contained in `previous`.
- Hook test with two assistant transcript events in that order.
- Assert final assistant content equals the original message (no duplicate append).

See:

- `lib/gemini/__tests__/transcript-merge.test.ts`
- `hooks/__tests__/use-check-in-messages.test.ts`

## Fix / prevention

- Detect long replayed subsets already present in the normalized transcript and ignore them.
- Keep existing overlap/replacement logic for real corrections and restarts.

## References

- `lib/gemini/transcript-merge.ts`
- `lib/gemini/__tests__/transcript-merge.test.ts`
- `hooks/check-in/messages/use-check-in-messages.ts`
- `hooks/__tests__/use-check-in-messages.test.ts`
