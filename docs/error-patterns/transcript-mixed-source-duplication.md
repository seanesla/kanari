# Transcript mixed-source duplication

## What the error looks like

During a single assistant turn, one chat bubble repeats a long sentence fragment, for example:

- first transcript stream emits: `Updated! A 10-minute meditation ...`
- second stream emits: `10-minute meditation ...` in the same turn
- final bubble shows both back-to-back as duplicated text

## Why it happens

- Gemini can emit assistant transcript from two sources in the same turn:
  - `modelTurn.parts[].text`
  - `outputTranscription`
- If both are forwarded to the UI, near-identical content can be appended twice.

## How to detect it automatically

- Add a unit test for `GeminiLiveClient` that simulates:
  1) `outputTranscription` first
  2) `modelTurn.parts[].text` second in the same turn
- Assert only one transcript source is forwarded for that turn.

See: `lib/gemini/__tests__/live-client.test.ts`

## Fix / prevention

- Lock each assistant turn to a single transcript source.
- If the turn starts with `outputTranscription`, ignore later `modelTurn.parts[].text` for that turn.
- Reset the source lock on interruption and turn completion.

## References

- `lib/gemini/live-client.ts`
- `lib/gemini/__tests__/live-client.test.ts`
