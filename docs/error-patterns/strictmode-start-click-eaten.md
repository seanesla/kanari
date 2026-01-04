# Error Pattern: StrictMode “Start” Click Gets Eaten

## What it looks like

- In development (React StrictMode enabled), clicking **Start** sometimes logs:
  - `[useCheckIn] startSession invoked`
  - `[useCheckIn] Session initialization aborted (StrictMode cleanup)`
- The UI appears to “do nothing” (or briefly shows “Setting up…” then returns to idle), and the user has to click again.

## Why it happens

React StrictMode intentionally mounts, unmounts, and re-mounts components in development to surface side effects.

If the user clicks a **Start** button during the first mount (before the StrictMode probe completes), async initialization begins and then gets aborted by the forced unmount. The click happened, but the component instance that handled it is torn down immediately afterward.

## How to detect automatically

- Run the UI in development with StrictMode enabled and attempt to click **Start** immediately after the component appears.
- Add a unit test for a “readiness gate” hook that:
  - returns `false` on the first dev mount
  - becomes `true` on the second mount (StrictMode probe)
  - falls back to `true` after a short timeout if StrictMode is disabled in dev

## Fix / Prevention

- Gate user-interaction buttons behind a “StrictMode-ready” signal in dev so the first mount is non-interactive.
- Use the shared hook `hooks/use-strict-mode-ready.ts` (linked in its docstring).

