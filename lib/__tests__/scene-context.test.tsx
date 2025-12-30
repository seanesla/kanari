/**
 * Scene Context Tests
 *
 * @vitest-environment jsdom
 *
 * Tests the "Portal Children Evaluation Timing" bug pattern.
 *
 * THE BUG: React evaluates JSX children at the CALL SITE, not the RENDER SITE.
 * When children use context hooks, the provider must exist at evaluation time.
 *
 * Example of the bug:
 * ```tsx
 * // Children are EVALUATED here (hooks run)
 * <Wrapper>
 *   <ChildThatUsesContext />  // useSceneMode() runs NOW, before Wrapper renders
 * </Wrapper>
 *
 * // Inside Wrapper, even if we have:
 * function Wrapper({ children }) {
 *   return <SomeProvider>{children}</SomeProvider>  // Too late - hooks already ran
 * }
 * ```
 *
 * THE FIX: Provider must wrap the call site, not just the render site.
 *
 * Related: docs/error-patterns/portal-children-context.md
 */

import { describe, it, expect, vi } from "vitest"
import React from "react"
import { renderHook, render } from "@testing-library/react"
import { SceneProvider, useSceneMode, SceneContext } from "../scene-context"

// Mock IndexedDB for SceneProvider
vi.mock("@/lib/storage/db", () => ({
  db: {
    settings: {
      get: vi.fn(() => Promise.resolve(null)),
      update: vi.fn(() => Promise.resolve(0)),
      put: vi.fn(() => Promise.resolve("default")),
    },
  },
}))

describe("useSceneMode context hook", () => {
  describe("Bug Pattern: Portal Children Evaluation Timing", () => {
    it("throws when called outside SceneProvider", () => {
      // This is the core bug: hooks run at call site
      // If no provider exists at call site, it throws
      expect(() => {
        renderHook(() => useSceneMode())
      }).toThrow("useSceneMode must be used within a SceneProvider")
    })

    it("works when called inside SceneProvider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SceneProvider>{children}</SceneProvider>
      )

      const { result } = renderHook(() => useSceneMode(), { wrapper })

      expect(result.current.accentColor).toBeDefined()
      expect(result.current.setAccentColor).toBeInstanceOf(Function)
    })

    it("demonstrates why children-as-props fails with context", () => {
      /**
       * This test demonstrates the fundamental issue:
       *
       * When you write:
       *   <Parent><Child /></Parent>
       *
       * React creates lazy component references, but when Parent RENDERS,
       * it renders {children} which triggers Child's hooks.
       *
       * If Parent has a Provider internally, the child hooks run inside it - GOOD.
       * But if Parent has something that breaks the React tree (like Canvas),
       * context won't flow through properly without useContextBridge.
       */

      // Component that uses context
      function ChildUsingContext() {
        const context = useSceneMode()
        return <div>{context.accentColor}</div>
      }

      // Wrapper WITHOUT provider - child will fail when rendered
      function WrapperWithoutProvider({
        children,
      }: {
        children: React.ReactNode
      }) {
        return <div>{children}</div>
      }

      // Rendering throws because ChildUsingContext uses context but no provider exists
      expect(() => {
        render(
          <WrapperWithoutProvider>
            <ChildUsingContext />
          </WrapperWithoutProvider>
        )
      }).toThrow("useSceneMode must be used within a SceneProvider")
    })

    it("demonstrates the fix: provider at call site", () => {
      function ChildUsingContext() {
        const context = useSceneMode()
        return <div data-testid="child">{context.accentColor}</div>
      }

      function SomeWrapper({
        children,
      }: {
        children: React.ReactNode
      }) {
        return <div>{children}</div>
      }

      // THE FIX: Provider wraps the render tree
      expect(() => {
        render(
          <SceneProvider>
            <SomeWrapper>
              <ChildUsingContext />
            </SomeWrapper>
          </SceneProvider>
        )
      }).not.toThrow()
    })
  })

  describe("SceneContext export", () => {
    it("exports SceneContext for useContextBridge", () => {
      // Required for Drei's useContextBridge to work
      // useContextBridge(SceneContext) needs the context object
      expect(SceneContext).toBeDefined()
      expect(SceneContext.Provider).toBeDefined()
    })
  })
})
