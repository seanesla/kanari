# Error Pattern: StrictMode Effect Cleanup Leaves “Unmounted” Refs Stuck

## What it looks like

- In development (React StrictMode enabled), clicking **Start** logs something like:
  - `[useCheckIn] startSession invoked`
  - `[useCheckIn] Session initialization aborted (StrictMode cleanup)`
- It happens repeatedly (not just once) because initialization aborts immediately every time.

You may also see related symptoms:
- Gemini `connect()` silently “does nothing” (returns early)
- Audio playback initialization aborts without creating an `AudioContext`

## Why it happens

React StrictMode (dev) intentionally:
- runs effect cleanups, then
- re-runs effects

…and it can do this while preserving hook refs/state for that component instance.

If a hook uses a ref like `mountedRef` / `unmountedRef` and sets it **only in cleanup**:

- `mountedRef.current = false` (or `unmountedRef.current = true`) in the cleanup
- but never resets it on the subsequent effect run

…then the ref stays “stuck” and all later async work treats the component as unmounted forever.

## How to detect it automatically

- Code search: any hook that does `mountedRef.current = false` in a `useEffect` cleanup should also set `mountedRef.current = true` in the effect body.
- Grep for patterns like:
  - `const mountedRef = useRef(true)` + cleanup sets `mountedRef.current = false`
  - `const unmountedRef = useRef(false)` + cleanup sets `unmountedRef.current = true`

## Fix / Prevention

Always set the flag in the effect body as well:

- `useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])`

Apply the same idea for `unmountedRef` (reset to `false` on (re)mount).

