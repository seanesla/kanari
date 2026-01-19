# Demo highlight selects hidden element

## What the error looks like
- The demo spotlight frames the wrong card or section.
- The tooltip arrow points to a duplicate element that is hidden or off-screen.
- The highlight can appear to drift to an unexpected area after a layout change.

## Why it happens
- `querySelector` returns the first matching `[data-demo-id]` element.
- Responsive layouts can render multiple candidates (mobile + desktop) where one is hidden.
- The demo spotlight uses the first match, even when it is `display: none` or visually hidden.

## How to detect it automatically
- In tests, create two elements with the same `data-demo-id` (one hidden, one visible).
- Assert that the demo selector returns the visible element.
- Flag any direct `[data-demo-id]` query that does not filter by visibility.
