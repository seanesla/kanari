// @vitest-environment jsdom

import React, { useMemo, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"

// The production FloatingGeometry is a react-three-fiber tree.
// For this test we only care about React hook ordering, so we mock Drei/Fiber
// components to simple React components that don't require a Canvas/WebGL context.
vi.mock("@react-three/drei", async () => {
  return {
    AdaptiveDpr: () => null,
    Sparkles: () => null,
    Float: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock("@react-three/fiber", async () => {
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => <div data-mock-canvas>{children}</div>,
    useFrame: () => {},
  }
})

import { SceneContext } from "@/lib/scene-context"
import type { GraphicsQuality } from "@/lib/types"
import { FloatingGeometry } from "../floating-orbs"

type SceneContextValue = NonNullable<React.ContextType<typeof SceneContext>>

function SceneHarness() {
  const [quality, setQuality] = useState<GraphicsQuality>("medium")

  const sceneValue = useMemo(
    () =>
      ({
        mode: "dashboard",
        setMode: () => {},
        scrollProgressRef: { current: 0 },
        resetToLanding: () => {},
        isLoading: false,
        setIsLoading: () => {},
        accentColor: "#ffffff",
        previewAccentColor: () => {},
        setAccentColor: () => {},
        graphicsQuality: quality,
        previewGraphicsQuality: () => {},
        setGraphicsQuality: () => {},
        selectedSansFont: "test-sans",
        previewSansFont: () => {},
        setSansFont: () => {},
        selectedSerifFont: "test-serif",
        previewSerifFont: () => {},
        setSerifFont: () => {},
        resetFontsToDefault: () => {},
      }) satisfies SceneContextValue,
    [quality]
  )

  return (
    <SceneContext.Provider value={sceneValue}>
      <button onClick={() => setQuality("medium")}>medium</button>
      <button onClick={() => setQuality("low")}>low</button>
      <FloatingGeometry accentColor="#ff0000" />
    </SceneContext.Provider>
  )
}

describe("FloatingGeometry", () => {
  it("does not violate hook ordering when floating geometry toggles", () => {
    const originalError = console.error
    const originalWarn = console.warn

    // Rendering R3F intrinsic elements with the DOM renderer triggers noisy React warnings
    // (e.g. <octahedronGeometry /> casing / unknown props). Silence those for this test.
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const first = args[0]
      if (
        typeof first === "string" &&
        (first.includes("is using incorrect casing") ||
          first.includes("The tag <") ||
          first.includes("React does not recognize") ||
          first.includes("non-boolean attribute"))
      ) {
        return
      }
      originalError(...(args as Parameters<typeof console.error>))
    })

    const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      originalWarn(...(args as Parameters<typeof console.warn>))
    })

    const { getByText } = render(<SceneHarness />)

    // This toggle used to trigger:
    // "Rendered fewer hooks than expected" due to an early return before a later hook.
    fireEvent.click(getByText("low"))
    fireEvent.click(getByText("medium"))

    expect(true).toBe(true)

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })
})
