# Audio player seek resets/stops playback

## What it looks like

- While listening to a saved check-in recording, clicking the timeline/progress bar to seek
  causes playback to jump back to the start, stop, or otherwise “break”.

## Why it happens

- `AudioBufferSourceNode` fires `onended` when `stop()` is called — **even for manual stops** (pause/seek/restart).
- If the `onended` handler resets playback state (e.g., `pauseOffset = 0`) it races with seek/restart logic and
  the next `start(0, offset)` can be invoked with `offset = 0` unintentionally.

## How to detect it automatically

- Component test:
  - Start playback.
  - Click the progress bar at 50%.
  - Assert the new source starts at `duration * 0.5`, not `0`.

## Fix

- When stopping a source node manually:
  - clear `source.onended` before calling `stop()`
  - clear the stored source ref so stale `onended` callbacks can’t mutate state
- In `onended`, ignore events from stale sources by checking identity against the current ref.

## References

- `components/dashboard/audio-player.tsx`
- Regression test: `components/dashboard/__tests__/audio-player.test.tsx`

