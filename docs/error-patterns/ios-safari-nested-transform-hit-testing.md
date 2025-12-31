# iOS Safari hit-testing issues with nested transforms in onboarding panels

## What the error looks like
- On iPhone Safari, tapping a text input inside the onboarding 3D panel doesn’t focus.
- Users can sometimes focus only by tapping slightly below the visible input.
- Triggering the system paste UI can be unstable (in some cases, Safari may crash).

## Why it happens
The onboarding UI is rendered inside `@react-three/drei`’s `Html` with `transform`, which uses a `matrix3d(...)` CSS transform to match 3D perspective.

iOS Safari has long-standing bugs with pointer hit-testing and text selection when interactive elements are nested under multiple CSS transforms (even “no-op” transforms like `scale(1)`). In our case, the panel wrapper applied `transform: scale(1)` even when active.

## Fix
Avoid applying a no-op transform on the active panel wrapper.

In `components/onboarding/floating-panel.tsx`, set:
- active: `transform: none`
- inactive: `transform: scale(0.95)`

This preserves the floating panel effect while reducing nested-transform depth for the interactive step.

## How to detect it automatically
- Unit test: render `FloatingPanel` and assert the active wrapper’s inline style uses `transform: none` (not `scale(1)`).
- Code scan: look for patterns like `transform: isActive ? "scale(1)" : ...` around interactive onboarding UI.
