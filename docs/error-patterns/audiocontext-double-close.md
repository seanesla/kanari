# AudioContext Double-Close Error

## What the Error Looks Like

```
InvalidStateError: Cannot close a closed AudioContext.
```

In the console, you'll see a stack trace pointing to `audioContext.close()` being called on an already-closed context.

## Why It Happens

This error occurs due to **race conditions during async cleanup**, especially in React StrictMode:

1. **React StrictMode double-mounting**: In development, React mounts components twice to detect side effects
2. **First mount** starts async initialization (creates AudioContext)
3. **React unmounts first instance** (calls cleanup, closes AudioContext)
4. **Second mount** starts new initialization
5. **First mount's async code completes** and tries to close the already-closed AudioContext

The race condition happens because:
- AudioContext is created synchronously but stored in a ref
- Cleanup may run while async operations (like `getUserMedia`, `audioWorklet.addModule`) are still pending
- When those async operations complete, they try to close a context that cleanup already closed

## How to Detect It

Search for `AudioContext.close()` calls without a state check:

```bash
# Find potential issues
grep -rn "\.close()" --include="*.ts" --include="*.tsx" | grep -i audio
```

Look for patterns like:
```typescript
// BAD - no state check
audioContext.close()

// BAD - checks existence but not state
if (audioContextRef.current) {
  audioContextRef.current.close()
}
```

## The Fix Pattern

Always check `audioContext.state !== "closed"` before calling `.close()`:

```typescript
// GOOD - checks state before closing
if (audioContext.state !== "closed") {
  audioContext.close()
}

// GOOD - for refs, check both existence and state
if (audioContextRef.current && audioContextRef.current.state !== "closed") {
  audioContextRef.current.close()
}
audioContextRef.current = null  // Always clear ref
```

## Files Where This Pattern Was Applied

- `hooks/use-check-in.ts` (lines 792, 814, 908)
- `hooks/use-audio-playback.ts` (line 378)
- `components/dashboard/audio-player.tsx` (line 91)
- `lib/audio/recorder.ts` (lines 133, 180)

## Related Patterns

The same issue can occur with other Web APIs that have state and can only be closed once:
- `MediaRecorder.stop()`
- `WebSocket.close()`
- `EventSource.close()`

Consider checking state before calling these methods if you have async cleanup logic.
