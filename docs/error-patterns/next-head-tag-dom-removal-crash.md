# Next Head Tag DOM Removal Crash

## The Error

In Safari you may see a crash like:

```
TypeError: null is not an object (evaluating '(t=t.stateNode).parentNode.removeChild')
```

This often shows up during client-side navigation / unmounts.

## Why It Happens

Next.js (React) owns and updates certain `<head>` tags (like the favicon link created via `metadata.icons`).

If app code manually removes one of those tags (for example by doing `document.querySelectorAll('link[rel="icon"]').forEach(el => el.remove())`), React can later try to remove/unmount the same DOM node. At that point the node's `parentNode` is already `null`, so React crashes when it calls `parentNode.removeChild(node)`.

## How To Detect It

- Search for direct DOM removal in `document.head`:
  - `.remove()`
  - `parentNode.removeChild(...)`
- Pay extra attention to favicon helpers that try to "replace" icons by deleting existing ones.

## The Fix

- Never remove Next/React-managed head tags.
- For dynamic favicons:
  - Create your own `link[rel="icon"]` with a marker attribute like `data-dynamic-favicon="true"`.
  - Insert it before existing static icon links (or update `href` attributes in-place), but don't delete the static ones.

## Related Files

- `lib/favicon-utils.ts`
- `lib/__tests__/favicon-utils.test.ts`
