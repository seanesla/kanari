# Check-in Silence Produces Fake Biomarkers

## What it looks like

- You start a new AI check-in and end it immediately (or you never speak).
- The synthesis screen still shows stress/fatigue numbers (often extreme fatigue, e.g. `fatigue=100`) even though there was no real speech.

## Why it happens

- `hooks/use-check-in-audio.ts` captures microphone audio continuously and stores it in a session buffer.
- `hooks/use-check-in-session.ts` used to compute session-level stress/fatigue metrics whenever any session audio existed.
- Silence (or mic noise) produces features like `speechRate=0`, `pauseRatio~1`, and `rms` near zero. The heuristic scorer in `lib/ml/inference.ts` interprets this as high fatigue.
- Older VAD behavior returned the entire audio as a "speech segment" when no speech was detected, making `speechDuration` look non-zero.

## How to detect it automatically

- Repro test (hook): `hooks/__tests__/use-check-in-session-no-speech.test.ts`
  - Start a session
  - Feed silent PCM into the capture worklet
  - End the session
  - Assert `session.acousticMetrics` is missing

- Audio pipeline test: `lib/audio/__tests__/processor.test.ts`
  - Mock VAD to return `[]`
  - Assert `speechDuration` is `0`

## Fix

- `lib/audio/vad.ts`
  - Return `[]` when no speech segments are detected.
  - Let Silero VAD errors propagate so `segmentSpeech()` can fall back to `SimpleVAD`.

- `lib/audio/processor.ts`
  - When VAD returns no segments, set `metadata.speechDuration = 0` and extract features from an empty buffer.

- `hooks/use-check-in-session.ts`
  - Gate session-level biomarker computation behind `speechDuration >= VALIDATION.MIN_SPEECH_SECONDS`.
  - Also require `validateAudioData(...)` to avoid scoring pure silence.

- `components/check-in/synthesis-screen.tsx`
  - If `session.acousticMetrics` is missing, render an "insufficient speech" message instead of showing bars.
