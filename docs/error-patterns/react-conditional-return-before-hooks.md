# Error Pattern: Conditional Return Before Hooks ("Rendered fewer hooks than expected")

## What it looks like

- Browser console error:
  - `Rendered fewer hooks than expected. This may be caused by an accidental early return statement.`
- Often triggered after toggling a setting / mode that changes which parts of a component render.

## Why it happens

React hooks must run in the same order on every render of a given component.

This error happens when a component sometimes exits early (e.g. `if (!enabled) return null`) before it reaches later hook calls (like `useMemo`, `useEffect`, etc.). If `enabled` flips between renders, the component will run a different number of hooks and React will throw.

Common variants:

- `if (!featureFlag) return null` placed above `useMemo`/`useEffect`.
- Hooks called inside `if (...) { ... }`, loops, or after an early return.

## How to detect it automatically

- ESLint: ensure `react-hooks/rules-of-hooks` is enabled (it should flag hooks called conditionally).
- Regression test: render the component and flip the condition (e.g. switch from "medium" to "low") and assert it does not throw.
- Manual scan: look for `return null` (or any early return) above hook calls inside a component.

## Fix

- Move *all* hooks to the top of the component so they always run.
- Keep early returns, but only after all hooks have run.
- If you want to avoid work, move the condition inside the hook callback (e.g. return an empty array from `useMemo`) rather than skipping the hook entirely.
