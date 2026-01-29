# Error Pattern: Undefined Hook Dependency Identifier (`getSnapshot`)

## What it looks like

- Runtime error on device / browser console similar to:
  - `Can't find variable: getSnapshot`
- Often points to a hook file and a dependency array line, e.g.:
  - `}, [getSnapshot])`

## Why it happens

This happens when a refactor removes or moves a helper (like `getSnapshot`) but leaves a reference behind:

- In a `useEffect`/`useMemo`/`useCallback` dependency array (`[getSnapshot]`).
- In an event handler (`onChange` calling `getSnapshot()`).

In this repo, Next.js is configured with `ignoreBuildErrors: true`, so TypeScript can fail to catch this at build time and the bug ships to production.

## How to detect it automatically

- Add a regression test that imports the hook and renders it (to fail fast on `ReferenceError`/`Can't find variable`).
  - See: `hooks/__tests__/use-mobile.test.tsx`
- Prefer hooks built around `useSyncExternalStore` when modeling “window state” (viewport, media queries) so the snapshot function is explicitly defined and used consistently.

