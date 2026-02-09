# Mobile report right-edge clipping (check-in details/summary)

## What it looks like

- On mobile, parts of the post-check-in report appear cut off on the right.
- Users commonly notice the fatigue section, pipeline row, or table "Notes" column being truncated.
- The content does not always provide an obvious horizontal scroll affordance.

## Why it happens

This is usually a combination of two layout choices:

1. **Animated wrappers using `overflow-hidden`**
   - Great for height animations, but they also clip horizontal overflow.
2. **Table/cell nowrap defaults and long inline chips**
   - `whitespace-nowrap` can force content wider than small viewports.
   - If an ancestor clips overflow, the right side disappears instead of wrapping.

## How to detect it automatically

- Add a regression test for `VoiceBiomarkerReport` expanded mode that checks mobile-safe classes:
  - vertical-only clipping wrapper (not full-axis clipping)
  - table wrappers with `overflow-x-auto`
  - mobile wrapping (`[&_th]:whitespace-normal`, `[&_td]:whitespace-normal`)
- Add a layout test for detail containers ensuring key wrappers include `min-w-0`.

## Fix / prevention

- Use `min-w-0` on flex/grid children that must shrink within mobile containers.
- For animated sections, clip **vertical** overflow only during height transitions.
- For dense tables in mobile contexts:
  - keep wrappers horizontally scrollable (`overflow-x-auto`)
  - allow wrapping on small screens; re-enable nowrap on larger breakpoints.
- Ensure long inline badge/chip content can wrap (`max-w-full`, `flex-wrap`, overflow-wrap).
