# Non-Audio Runtime Model Drift

## What it looks like

A non-audio runtime endpoint quietly uses a Gemini 2.5 non-audio model (for example `gemini-2.5-flash-preview-*`) even though the app standard is Gemini 3 Flash for non-audio runtime tasks.

Symptoms:
- Runtime behavior does not match architecture claims ("Gemini 3 for non-audio runtime").
- Model usage drifts over time because one-off route handlers hardcode model IDs.

## Why it happens

Direct endpoint strings are easy to copy between routes. During fast iteration, an endpoint can keep an older model ID while the rest of the app migrates.

## How to detect it automatically

Code checks:
- Grep runtime code for non-audio 2.5 IDs such as `gemini-2.5-flash-preview`.
- Exclude known audio-only / offline exceptions:
  - `gemini-2.5-flash-native-audio-preview-*` (Gemini Live audio)
  - `gemini-2.5-flash-preview-tts` (offline voice sample script)

Behavior checks (tests):
- `app/api/gemini/summarize-thinking/__tests__/route.test.ts` asserts the summarize-thinking runtime route calls:
  - `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`
