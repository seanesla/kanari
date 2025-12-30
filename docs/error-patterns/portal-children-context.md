# Portal Children Context Loss

## The Error

```
Error: useSceneMode must be used within a SceneProvider
```

Or more generally: any "X must be used within Y Provider" error when using React Three Fiber with Drei's `Html` component.

## Why It Happens

Drei's `Html` component creates a **React DOM portal** to render HTML content in 3D space. DOM portals are rendered OUTSIDE the normal React component tree, which means React context doesn't flow into them automatically.

```
React Tree (context flows):
├── SceneProvider ✓
│   └── Canvas (R3F reconciler - context preserved in modern versions)
│       └── FloatingPanel ✓ (can use useSceneMode)
│           └── Html (creates DOM portal) ✗
│               └── StepWelcome ✗ (useSceneMode FAILS - outside context)
```

## What Breaks Context

| Component | Context Flow | Notes |
|-----------|--------------|-------|
| R3F `Canvas` | ✓ Preserved | Modern @react-three/fiber preserves context |
| Drei `Html` | ✗ Broken | Creates DOM portal outside R3F tree |
| Drei `Float`, `Environment`, etc. | ✓ Preserved | Stay inside R3F tree |
| React `createPortal` | ✗ Broken | Same issue as Html |

## How To Detect It

1. **Error message**: "X must be used within XProvider" thrown from inside Html content
2. **Location**: Component using context hook is rendered inside `<Html>` from Drei
3. **Pattern**: Parent has Canvas with context bridge, but Html portal bypasses it

## The Fix

Use `useContextBridge` from `@react-three/drei` to manually pass context INTO the Html portal:

```tsx
// floating-panel.tsx
import { Html, Float, useContextBridge } from "@react-three/drei"
import { useSceneMode, SceneContext } from "@/lib/scene-context"

export function FloatingPanel({ children, isActive }: Props) {
  const { accentColor } = useSceneMode()

  // Create bridge for Html portal (separate from Canvas bridge)
  const ContextBridge = useContextBridge(SceneContext)

  return (
    <Float>
      <Html>
        {/* ContextBridge passes context INTO the Html portal */}
        <ContextBridge>
          {children}  {/* Children can now use useSceneMode() */}
        </ContextBridge>
      </Html>
    </Float>
  )
}
```

## Key Insight: Two Bridges Needed

When using Html inside Canvas, you need **two** context bridges:

1. **Canvas bridge** (in parent): Passes context from DOM → R3F reconciler
2. **Html bridge** (in Html): Passes context from R3F → DOM portal

```tsx
// onboarding-3d-scene.tsx - Bridge #1
const ContextBridge = useContextBridge(SceneContext)
return (
  <Canvas>
    <ContextBridge>        {/* Bridge context INTO Canvas */}
      <FloatingPanel>...</FloatingPanel>
    </ContextBridge>
  </Canvas>
)

// floating-panel.tsx - Bridge #2
const ContextBridge = useContextBridge(SceneContext)
return (
  <Html>
    <ContextBridge>        {/* Bridge context INTO Html portal */}
      {children}
    </ContextBridge>
  </Html>
)
```

## Automated Detection

### ESLint Rule (TODO)
Create a custom ESLint rule that warns when:
- Component uses `<Html>` from `@react-three/drei`
- Children of Html use any context hook
- No `useContextBridge` is present in the component

### Test Pattern
```tsx
// Test that context works inside Html portals
it("context flows into Html portal with ContextBridge", () => {
  render(
    <SceneProvider>
      <Canvas>
        <FloatingPanel>
          <ChildUsingContext />  {/* Should not throw */}
        </FloatingPanel>
      </Canvas>
    </SceneProvider>
  )
})
```

## Related Files

- `lib/__tests__/scene-context.test.tsx` - Test reproducing the pattern
- `components/onboarding/floating-panel.tsx` - Example fix with ContextBridge
- `components/onboarding/onboarding-3d-scene.tsx` - Canvas-level context bridge

## References

- [Drei useContextBridge docs](https://github.com/pmndrs/drei#usecontextbridge)
- [React Portals and Context](https://react.dev/reference/react-dom/createPortal#caveats)
