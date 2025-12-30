# Playback chunk drop (AI voice skips words)

## What it looks like
- AI speech stutters or drops syllables mid-sentence (e.g., “i wa- le- ri- no-”).
- DevTools shows `queueFull`/`queuePressure` messages from `playback.worklet.js`.
- Longer replies (>6s) are more likely to skip words when the browser is busy or throttled.

## Why it happens
- Gemini streams audio faster than real-time. The original playback worklet capped the buffer at 150 chunks (~6.4s). When the queue hit that cap, new chunks were **rejected**, creating 40–50ms holes in the waveform that manifest as missing words.
- This was easiest to trigger on long answers or when the AudioContext briefly stalled (tab in background, CPU spikes), letting the incoming audio outrun playback.

## How to detect automatically
- Unit test: `lib/audio/__tests__/playback.worklet.test.ts` pushes ~8.5s of chunks and asserts none are dropped.
- Runtime signal: watch for `queuePressure` messages or `droppedChunks > 0` emitted by `playback.worklet.js`. Any non-zero drop count is a regression.
- QA cue: if the spoken reply feels like it “teleports” mid-word, check the console for backpressure warnings.

## Fix / mitigation
- Increased buffering headroom: soft limit 600 chunks (~26s) and hard limit 2000 (~85s). Soft limit only warns; hard limit trims **oldest** audio as a last resort.
- New backpressure notification (`queuePressure`) replaces silent dropping; normal operation keeps every chunk so speech stays intact. Expect slightly more latency on extremely long replies instead of missing words.
- If `droppedChunks` ever increments, either raise the hard limit or throttle upstream generation before playback.
