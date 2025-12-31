# iOS Safari input hitbox/paste crash in Drei Html transform

## What the error looks like
- On iPhone/iPad Safari, tapping text inputs inside the onboarding 3D panels does not focus.
- Users must tap below the visible field to focus it (hitbox offset).
- Triggering the iOS paste prompt can crash Safari while the 3D scene is active.

## Why it happens
`@react-three/drei`'s `Html` with `transform` enabled renders DOM inside a matrix3d transform that follows the 3D scene. iOS Safari has long-standing hit-testing and selection bugs for transformed DOM (especially matrix3d + scale) layered over WebGL canvases. The DOM visually moves, but touch hitboxes and selection UI do not align, which can also destabilize the paste overlay.

## How to detect it automatically
- Unit test: Mock `@react-three/drei`'s `Html` and assert `transform` is **disabled** when the user agent is iOS (or iPadOS via `MacIntel` + `maxTouchPoints > 1`).
- Static scan: Grep for `<Html transform` in components that render interactive inputs. If found, verify there is an iOS fallback path that disables `transform`.

## Notes
- The onboarding 3D panels are the primary place where inputs live inside `Html`.
- The safe fallback is to disable `transform` on iOS (keep the 3D scene, but render DOM without matrix3d transforms).
- When disabling `transform`, ensure the panel remains usable (e.g., disable `distanceFactor` scaling and re-center the panel wrapper with `translate(-50%, -50%)`).
