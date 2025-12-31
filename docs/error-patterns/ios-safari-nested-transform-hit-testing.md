# iOS Safari hit-testing issues with nested transforms in onboarding panels

## What the error looks like
- On iPhone Safari, tapping a text input inside the onboarding 3D panel doesn’t focus.
- Users can sometimes focus only by tapping slightly below the visible input.
- Triggering the system paste UI can be unstable (in some cases, Safari may crash).

## Why it happens
The onboarding UI is rendered inside `@react-three/drei`’s `Html` with `transform`, which uses a `matrix3d(...)` CSS transform to match 3D perspective.

iOS Safari has long-standing bugs with pointer hit-testing and text selection when interactive elements are nested under multiple CSS transforms (especially CSS3D `matrix3d(...)`). In our case, the active onboarding panel contained interactive inputs inside the `matrix3d(...)` transform tree.

## Fix
Prefer rendering the active, interactive panel without CSS3D transforms.

In `components/onboarding/floating-panel.tsx`, set:
- `Html` should use `transform={false}` when the panel is active (and keep `transform={true}` for inactive panels so they still look like they live in 3D space).
- active wrapper: `transform: none` (avoid `scale(1)`)
- inactive wrapper: `transform: scale(0.95)`

This keeps the “floating panel” aesthetic while making hit-testing and paste/selection UI more reliable on mobile browsers.

## How to detect it automatically
- Unit test: render `FloatingPanel` and assert:
  - the active panel passes `transform={false}` to `Html`
  - the active wrapper’s inline style uses `transform: none` (not `scale(1)`)
- Code scan: look for inputs rendered inside CSS3D `matrix3d(...)` trees and patterns like `transform: isActive ? "scale(1)" : ...`.
