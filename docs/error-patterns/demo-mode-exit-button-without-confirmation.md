# Demo mode exit actions must be confirmed

## What the error looks like

- User clicks a demo exit control (for example, the navbar "Exit" button).
- App immediately switches workspace from demo to real and reloads.
- User can lose demo context unexpectedly from an accidental click.

## Why it happens

Demo exit code calls `setWorkspace("real")` + reload directly, without a confirmation step.

Because the action is immediate and reversible only by re-entering demo mode, accidental clicks feel like data loss or reset bugs.

## How to fix

- Add an explicit confirmation dialog before any direct demo-exit action.
- On cancel: keep user in demo mode and do nothing.
- On confirm: run the existing exit path (`setWorkspace("real")` and reload/navigation cleanup).

## How to detect automatically

- Search for direct exit calls:
  - `setWorkspace("real")`
  - `stopDemo()`
- Flag UI event handlers that call them without an intermediate confirmation dialog.
- Add tests that assert:
  - first click opens warning
  - cancel does not exit
  - confirm exits
