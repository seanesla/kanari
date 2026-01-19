# Safari view transition timeout

## What the error looks like

Safari can throw runtime errors when view transitions are triggered during navigation:

```
TypeError: null is not an object (evaluating '(t=t.stateNode).parentNode.removeChild')
Unhandled Promise Rejection: TimeoutError: View transition update callback timed out.
```

You may also see a highlighted element in DevTools like:

```
<div data-nextjs-dialog-backdrop="true"></div>
<div aria-hidden="true" class="fixed inset-0 ..."></div>
```

## Why it happens

Safari's `document.startViewTransition` implementation is unstable when portals, overlays, or rapid DOM removals happen during route transitions (for example, the onboarding scene, demo overlay, or dialog backdrops). The browser tries to clean up a node that has already been removed, and the transition callback times out.

## How to detect it automatically

- Reproduce on Safari by navigating between routes while an overlay is mounted (dialogs, demo overlays, onboarding scene panels).
- Watch for the view transition timeout error and `parentNode.removeChild` crashes in the console.

## How we fix it

We replace `document.startViewTransition` with a Safari-safe shim that runs the callback immediately and resolves the transition promises without waiting on the native implementation. This avoids unstable cleanup paths while keeping normal transitions in other browsers.

## Related code

- `lib/utils.ts` (`applySafariViewTransitionFix`, `isSafariUserAgent`)
- `components/providers/index.tsx` (calls `applySafariViewTransitionFix` on mount)
