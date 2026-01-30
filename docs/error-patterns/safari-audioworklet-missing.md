## Error: `audioContext.audioWorklet.addModule` is undefined (Safari/iOS)

### What it looks like

- Runtime crash on starting recording / check-in:
  - `TypeError: undefined is not an object (evaluating 'audioContext.audioWorklet.addModule')`
  - Often surfaced as a generic “Connection Error” because the check-in flow fails during audio init.

### Why it happens

- Some Safari/iOS builds (and some restricted contexts) don’t expose `AudioWorklet` / `AudioWorkletNode`.
- In addition, when served from non-secure origins, Safari may restrict advanced Web Audio features.
- Code that assumes `audioContext.audioWorklet.addModule` exists will crash before it can recover.

### How to detect it automatically

- Search for unguarded worklet loading:
  - `rg -n "audioWorklet\\.addModule" hooks lib components`
- Ensure each call site checks for support:
  - `typeof AudioWorkletNode !== "undefined"`
  - `typeof audioContext.audioWorklet?.addModule === "function"`

### Fix / mitigation

- Add a runtime fallback to `ScriptProcessorNode` (deprecated but widely supported) for **capture/recording**.
- Add a buffered `AudioBufferSourceNode` scheduler fallback for **playback** when worklets aren’t available.
- Prefer running on HTTPS for real devices (especially iOS Safari) to avoid secure-context restrictions.

