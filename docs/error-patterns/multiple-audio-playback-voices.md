# Multiple Audio Playback Voices Bug

## Problem

When a new check-in begins and AI starts talking, multiple voices play simultaneously, and text messages get interfered with. This causes audio overlap and a poor user experience.

## Root Causes

The bug was caused by **three independent issues** in `/hooks/use-audio-playback.ts`:

### Issue #1: Missing AudioContext Validation

**Location:** `useAudioPlayback` hook, `queueAudio()` function (lines 308-340)

**Problem:**
- Audio chunks were queued without verifying the AudioContext was still open
- If a check-in closed and opened rapidly (React StrictMode, fast clicks), an old AudioContext could close while new audio chunks were being queued
- These audio chunks would queue silently into a closed context, then when a new AudioContext was created, both old and new audio would play

**Symptom:**
```
Old AudioContext (closed) ← stale audio chunks queue here silently
↓
New AudioContext (open) ← new audio chunks queue here
↓ (both play!)
Speaker: Double voices
```

**Fix:** Added validation before queueing:
```typescript
if (!audioContext || (audioContext.state as string) === "closed") {
  console.warn("[useAudioPlayback] AudioContext closed, cannot queue audio")
  return
}
```

### Issue #2: Stale Callback Execution Across Multiple Hook Instances

**Location:** `useAudioPlayback` hook, worklet message handler (lines 262-305)

**Problem:**
- When React renders multiple times (StrictMode, rapid dialog open/close), multiple `useAudioPlayback` instances are created
- Each creates its own AudioContext and worklet message handler
- If an old instance's worklet received messages (from buffered audio still playing), it would call old callbacks
- Meanwhile, a new instance's callbacks were also firing
- Result: Multiple state transitions, multiple playback callbacks, multiple voices

**Symptom:**
```
Instance #1 (old):
  audioContext.destination → Audio output
  worklet.onmessage → onPlaybackStart() [OLD CALLBACK]
  ↓
Instance #2 (new):
  audioContext.destination → Same output
  worklet.onmessage → onPlaybackStart() [NEW CALLBACK]
  ↓
Both instances' audio plays simultaneously
```

**Fix:** Added instance lifecycle tracking:
```typescript
// Track instance lifecycle to prevent stale callbacks
const instanceRef = useRef<object>({})

// In worklet message handler:
const currentInstance = instanceRef.current
workletNode.port.onmessage = (event) => {
  // Only process messages if this instance is still active
  if (instanceRef.current !== currentInstance) {
    return  // Ignore stale messages
  }
  // ... process message
}

// In cleanup:
cleanup() {
  // Invalidate this instance so stale worklet messages are ignored
  instanceRef.current = {}
}
```

### Issue #3: Incomplete Audio Queue Clearing on Barge-in

**Location:** `useAudioPlayback` hook, `clearQueue()` function (lines 353-367)

**Problem:**
- When user barges in (interrupts AI), `clearQueue()` was called to stop playback
- However, the `isPlayingRef` flag was only set to false *after* sending the "clear" message to worklet
- If worklet was slow to process the clear message, buffered audio could trigger `onPlaybackStart` before the flag was set
- This caused state to transition back to "assistant_speaking" even though user was now speaking

**Symptom:**
```
User: "interrupts"
  ↓
clearQueue() called
  worklet.postMessage({ type: "clear" }) ← async command
  ↓ (race condition)
worklet.onmessage("queueStatus") ← from buffered audio
  → isPlayingRef.current still true!
  → onPlaybackStart() fires
  → state → "assistant_speaking"
  ↓
Conflict: User speaking but AI state active
```

**Fix:** Set flag **immediately** before async worklet command:
```typescript
clearQueue() {
  const worklet = workletNodeRef.current
  if (!worklet) return

  // Immediately set playing to false BEFORE async worklet message
  // This prevents onPlaybackStart from being called by buffered audio
  isPlayingRef.current = false

  // Send clear command to the worklet
  worklet.port.postMessage({ type: "clear" })
}
```

## How These Issues Combined

In the worst case, all three issues occurred together:

1. **Rapid open/close** → Multiple hook instances created (Issue #2)
2. **Old AudioContext closes** → But old audio chunks already queued (Issue #1)
3. **User interrupts** → But `isPlayingRef` not immediately cleared (Issue #3)
4. **Result** → Multiple voices, state confusion, text interference

## Testing

Added three new test cases to verify the fixes:

1. **`prevents multiple onPlaybackStart callbacks when audio queue receives updates rapidly`**
   - Verifies that only one `onPlaybackStart` is called even with multiple queue status messages
   - Tests Issue #2 prevention

2. **`does not queue audio when AudioContext is closed`**
   - Verifies audio doesn't queue into closed contexts
   - Tests Issue #1 prevention

3. **`clears all queued audio on barge-in and prevents overlap`**
   - Verifies barge-in immediately stops playback without race conditions
   - Tests Issue #3 prevention

All tests pass. Run with:
```bash
pnpm test:run -- hooks/__tests__/use-audio-playback.test.ts
```

## Files Modified

- `/hooks/use-audio-playback.ts` - Applied all three fixes
- `/hooks/__tests__/use-audio-playback.test.ts` - Added test cases

## Related Documentation

- AudioContext state management: https://webaudio.github.io/web-audio-api/#dom-audiocontextstate
- React StrictMode: https://react.dev/reference/react/StrictMode
- Web Audio API worklets: https://webaudio.github.io/web-audio-api/#audioworklet

## How to Detect Similar Issues

1. **Multiple voices at once** → Check for multiple hook instances, missing context validation
2. **State transitions out of sync with audio** → Check callback refs and instance lifecycle
3. **Race conditions during rapid state changes** → Check for async operations that should be atomic

Use the following debug patterns:

```typescript
// Track instance creation
console.log("[useAudioPlayback] New instance created")

// Verify AudioContext state before operations
console.log(`[useAudioPlayback] AudioContext state: ${audioContext.state}`)

// Verify callback execution
console.log("[useAudioPlayback] onPlaybackStart called")

// Verify barge-in timing
console.log("[useAudioPlayback] clearQueue called, isPlayingRef set to false")
```
