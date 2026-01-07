# Error Pattern: `mute_audio_response` still shows assistant text

## What it looks like

- The user message shows a **“skipped”** indicator (the model called `mute_audio_response`).
- Despite that, the UI still displays an assistant message like **“Let me check”** (or any other text).

This breaks the intended behavior: when silence is chosen, the assistant must produce *no output at all*.

## Why it happens

The Live client’s “silence mode” was originally implemented to suppress **audio chunks only**.

However, Gemini Live can still emit:

- `modelTurn.parts[].text` (text parts)
- `outputTranscription.text` (derived transcript)

If these aren’t suppressed, the check-in UI receives transcript events and renders an assistant bubble even though the turn is meant to be silent.

In rarer cases, some transcript text may arrive **before** the `mute_audio_response` tool call is processed, so the UI may already have a streaming assistant message that needs to be removed when silence is chosen.

## How to detect it automatically

- Unit test: trigger `mute_audio_response`, then deliver a server message containing `modelTurn.parts[].text` and/or `outputTranscription.text`.
  - Expected: **no** `onModelTranscript` (and no “thinking” text) is emitted for that turn.
- Hook-level test: add an assistant transcript message, then trigger `onSilenceChosen`.
  - Expected: assistant message is removed and the user message is marked `silenceTriggered`.

## Fix / Prevention

- In `lib/gemini/live-client.ts`, suppress **text + audio** while `silenceMode` is active.
- In `hooks/check-in/messages/use-check-in-messages.ts`, when `onSilenceChosen` fires:
  - remove any streaming assistant message already created for the current turn
  - ignore any further assistant output until `onTurnComplete`

