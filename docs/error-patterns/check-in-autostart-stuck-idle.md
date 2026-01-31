# Error Pattern: Check-in Auto-Start Gets Stuck on “Starting your check-in…”

## What it looks like

- The check-in drawer shows: **“Starting your check-in…”**
- Nothing else happens (no init phases, no error).
- The Start button can appear disabled, so the user can’t recover without refresh.

## Why it happens

Two related issues can combine:

1) **StrictMode effect replay timing (dev):**
   - During StrictMode “probe” cycles, cleanup can mark internal refs as unmounted/aborted.
   - If auto-start is triggered from a `useLayoutEffect` in a parent component, it can run before a child `useEffect` re-establishes “mounted” flags.
   - `startSession()` may abort *before dispatching* `START_INITIALIZING`, so React never re-renders into an initializing state.

2) **UI gated only by `autoStart` prop:**
   - If the auto-start attempt aborts early, the UI may still treat the session as “auto-starting” and keep the Start button disabled.

## How to detect it automatically

- Component test for the check-in drawer content with `autoStart={true}`:
  - mock `useCheckIn()` to stay in `state: "idle"`
  - mock `startSession()` to reject immediately
  - expected: the Start button becomes enabled (auto-start doesn’t lock the UI)

## Fix / Prevention

- Reset “mounted/unmounted” refs in a **child `useLayoutEffect`**, not only `useEffect`, when parent code can trigger auto-start from layout effects.
- Track auto-start attempts with React state so the UI can re-render even when the underlying session state never advances.

