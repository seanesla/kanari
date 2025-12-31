# `Float` orbiting when children are positioned far from origin

## What the error looks like
- Motion feels fine near the origin, but gets dramatically worse for objects positioned far away.
- In onboarding, later panels sway more and can drift off-screen as you advance through steps.

## Why it happens
`@react-three/drei`’s `Float` applies small rotations/vertical offsets to **its own inner group**.

If you put a large `position={[x,y,z]}` *inside* the `Float` (instead of on `Float` itself), those rotations happen around the **world origin** (the `Float`’s pivot), so the child position vector effectively “orbits” around the origin:

- small angle × large distance = large lateral displacement

The farther the child is from the origin, the larger the visible sway.

## Fix
Anchor `Float` at the intended location so it rotates around the local pivot:

- Prefer ` <Float position={pos}> … </Float> `
- Or: `<group position={pos}><Float> … </Float></group>`

## How to detect it automatically
- Code scan: flag patterns like:
  - `<Float> <mesh position={[...large]} /> </Float>`
  - `<Float> <group position={[...large]}> … </group> </Float>`
- Unit test: assert the component passes `position` to `Float` (not to a nested wrapper under `Float`) when the goal is “float in place”.

