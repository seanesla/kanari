# Check-in Session Initialization Continues After Unmount

## What it looks like
- You open the AI chat/check-in and quickly close it (or switch tabs), but:
  - The mic permission prompt still appears after closing
  - The first AI message sounds like multiple overlapping voices
  - The first assistant transcript bubble is jumbled (interleaved chunks)
  - CPU spikes, and live transcription feels delayed (“takes forever”)

This is most noticeable in:
- React StrictMode dev (double-mount/unmount)
- Rapid open/close of the CheckIn dialog/drawer
- Rapid tab switching in the dashboard AI chat drawer

## Why it happens
`startSession()` in `hooks/use-check-in-session.ts` performs async preflight work:
- context fingerprinting
- fetching historical context
- optional context-summary fetch

If the component unmounts during that preflight, the old `startSession()` call can
continue running and later:
- initialize audio playback (`AudioContext` + worklet)
- initialize audio capture (`getUserMedia` + worklet)
- connect to Gemini Live

Those side effects after unmount can create “ghost” sessions and overlapping
AudioContexts, producing multi-voice audio and transcript interference.

## Fix strategy
1. Treat `startSession()` as **cancelable** work:
   - Track a run ID and abort flag in refs.
   - After every awaited step, verify the run is still “active”.
2. Abort on unmount and on `cancelSession()`:
   - Prevent playback/capture/connect from starting after teardown.
3. Avoid dispatching state updates after unmount.
4. Guard conversation kick-off:
   - Only send `[START_CONVERSATION]` once per session.

## Implementation
- `hooks/use-check-in-session.ts`
  - Added `startSessionRunIdRef`, `startSessionAbortRef`, `unmountedRef`
  - Added `ensureActive()` checks after awaited preflight steps
  - Set abort flag on `cancelSession()`
  - Added `startConversationSentRef` to prevent duplicate `[START_CONVERSATION]`

## How to detect it automatically
- Regression test: `hooks/__tests__/use-check-in-session-abort.test.ts`
  - Starts `startSession()`, unmounts while preflight is pending
  - Asserts playback/capture/connect are NOT invoked after unmount

## Related
- `docs/error-patterns/multiple-audio-playback-voices.md` (symptom overlap: multi-voice playback)
- `docs/error-patterns/transcript-stream-duplication.md` (jumbled assistant transcript patterns)

