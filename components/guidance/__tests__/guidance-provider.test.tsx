// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { GuidanceProvider, useGuidance } from "../guidance-provider"
import { FIRST_TIME_STEPS, DEMO_STEPS } from "../guidance-steps"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockPathname = "/overview"
let mockUseLiveQueryReturn: unknown = undefined
let mockIsDemoWorkspace = false
const mockPatchSettings = vi.fn()
const mockRouterPush = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown, deps: unknown[], fallback: unknown) => {
    // Return the test-controlled value instead of actually querying IndexedDB
    if (mockUseLiveQueryReturn !== undefined) return mockUseLiveQueryReturn
    return fallback
  },
}))

vi.mock("@/lib/storage/db", () => ({
  db: { settings: { get: vi.fn(), update: vi.fn() } },
}))

vi.mock("@/lib/settings/patch-settings", () => ({
  patchSettings: (...args: unknown[]) => mockPatchSettings(...args),
}))

vi.mock("@/lib/workspace", () => ({
  isDemoWorkspace: () => mockIsDemoWorkspace,
}))

// ---------------------------------------------------------------------------
// Helper: renders a consumer that exposes context value via data attributes
// ---------------------------------------------------------------------------

function GuidanceConsumer() {
  const ctx = useGuidance()
  return (
    <div data-guidance-allow>
      <span data-testid="active-guide">{ctx.activeGuide ?? "none"}</span>
      <span data-testid="step-index">{ctx.currentStepIndex}</span>
      <span data-testid="total-steps">{ctx.totalSteps}</span>
      <span data-testid="step-title">{ctx.currentStep?.title ?? "none"}</span>
      <span data-testid="skipped-steps">{ctx.skippedStepIds.join(",")}</span>
      <button data-testid="next" onClick={ctx.next}>Next</button>
      <button data-testid="prev" onClick={ctx.prev}>Prev</button>
      <button data-testid="skip" onClick={ctx.skip}>Skip</button>
      <button data-testid="exit" onClick={ctx.exitGuide}>Exit</button>
      <button data-testid="start-ft" onClick={() => ctx.startGuide("first-time")}>Start FT</button>
      <button data-testid="start-demo" onClick={() => ctx.startGuide("demo")}>Start Demo</button>
    </div>
  )
}

function seedDemoStepTargets() {
  const ids = [
    "demo-metrics-header",
    "demo-suggestions-kanban",
    "demo-burnout-prediction",
    "demo-new-checkin-button",
  ]

  for (const id of ids) {
    const el = document.createElement("div")
    el.setAttribute("data-demo-id", id)
    document.body.appendChild(el)
  }
}

function renderWithProvider() {
  return render(
    <GuidanceProvider>
      <GuidanceConsumer />
    </GuidanceProvider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPathname = "/overview"
  mockUseLiveQueryReturn = undefined
  mockIsDemoWorkspace = false
  mockPatchSettings.mockReset()
  mockRouterPush.mockReset()
  window.localStorage.clear()
})

describe("GuidanceProvider", () => {
  describe("auto-start: first-time guide", () => {
    it("auto-starts when onboarding complete + guide not completed + real workspace + /overview", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }
      mockIsDemoWorkspace = false
      mockPathname = "/overview"

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("first-time")
      expect(screen.getByTestId("step-title").textContent).toBe(FIRST_TIME_STEPS[0].title)
    })

    it("does NOT auto-start when guide already completed", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: true,
      }
      mockIsDemoWorkspace = false

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("none")
    })

    it("does NOT auto-start when onboarding not completed", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: false,
        hasCompletedFirstTimeGuide: false,
      }

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("none")
    })

    it("does NOT auto-start on non-overview routes", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }
      mockPathname = "/settings"

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("none")
    })
  })

  describe("auto-start: demo guide", () => {
    it("auto-starts in demo workspace when onboarding complete + /overview", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }
      mockIsDemoWorkspace = true
      mockPathname = "/overview"

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("demo")
      expect(screen.getByTestId("step-title").textContent).toBe(DEMO_STEPS[0].title)
    })

    it("resumes demo guide from saved progress", () => {
      window.localStorage.setItem(
        "kanari_demo_guide_progress_v1",
        JSON.stringify({
          version: 1,
          stepIndex: 2,
          skippedStepIds: ["demo-metrics"],
        })
      )

      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }
      mockIsDemoWorkspace = true
      mockPathname = "/overview"

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("demo")
      expect(screen.getByTestId("step-index").textContent).toBe("2")
    })

    it("auto-navigates to step route when demo step requires another page", () => {
      seedDemoStepTargets()

      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }
      mockIsDemoWorkspace = true
      mockPathname = "/overview"

      renderWithProvider()

      const checkInStepIndex = DEMO_STEPS.findIndex((s) => s.id === "demo-checkins")
      expect(checkInStepIndex).toBeGreaterThan(0)

      for (let i = 0; i < checkInStepIndex; i++) {
        act(() => {
          screen.getByTestId("next").click()
        })
      }

      expect(mockRouterPush).toHaveBeenCalledWith("/check-ins")
    })

    it("does not block next on the check-in demo step", () => {
      seedDemoStepTargets()

      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }
      mockIsDemoWorkspace = true
      mockPathname = "/overview"

      renderWithProvider()

      const checkInStepIndex = DEMO_STEPS.findIndex((s) => s.id === "demo-checkins")
      expect(checkInStepIndex).toBeGreaterThan(0)

      for (let i = 0; i < checkInStepIndex; i++) {
        act(() => {
          screen.getByTestId("next").click()
        })
      }

      expect(screen.getByTestId("step-title").textContent).toBe(
        DEMO_STEPS[checkInStepIndex]?.title
      )

      // Next should move forward immediately without requiring New Check-in view.
      act(() => {
        screen.getByTestId("next").click()
      })
      expect(screen.getByTestId("step-index").textContent).toBe(String(checkInStepIndex + 1))
    })
  })

  describe("navigation", () => {
    it("does not force route navigation for first-time guide", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: true,
      }
      mockIsDemoWorkspace = false
      mockPathname = "/settings"

      renderWithProvider()

      act(() => {
        screen.getByTestId("start-ft").click()
      })

      act(() => {
        screen.getByTestId("next").click()
      })

      expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it("next() advances through steps", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }

      renderWithProvider()

      expect(screen.getByTestId("step-index").textContent).toBe("0")

      act(() => {
        screen.getByTestId("next").click()
      })

      expect(screen.getByTestId("step-index").textContent).toBe("1")
      expect(screen.getByTestId("step-title").textContent).toBe(FIRST_TIME_STEPS[1].title)
    })

    it("prev() goes back a step", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }

      renderWithProvider()

      // Go forward then back
      act(() => {
        screen.getByTestId("next").click()
      })
      expect(screen.getByTestId("step-index").textContent).toBe("1")

      act(() => {
        screen.getByTestId("prev").click()
      })
      expect(screen.getByTestId("step-index").textContent).toBe("0")
    })

    it("prev() does not go below step 0", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }

      renderWithProvider()

      act(() => {
        screen.getByTestId("prev").click()
      })
      expect(screen.getByTestId("step-index").textContent).toBe("0")
    })

    it("next() on last step completes the guide", async () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }

      renderWithProvider()

      // Advance to last step
      for (let i = 0; i < FIRST_TIME_STEPS.length - 1; i++) {
        act(() => {
          screen.getByTestId("next").click()
        })
      }

      expect(screen.getByTestId("step-index").textContent).toBe(
        String(FIRST_TIME_STEPS.length - 1)
      )

      // Click next on last step -> completes
      await act(async () => {
        screen.getByTestId("next").click()
      })

      expect(screen.getByTestId("active-guide").textContent).toBe("none")
    })
  })

  describe("skip", () => {
    it("skip() closes the guide and persists completion for first-time", async () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: false,
      }

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("first-time")

      await act(async () => {
        screen.getByTestId("skip").click()
      })

      expect(screen.getByTestId("active-guide").textContent).toBe("none")
      expect(mockPatchSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          hasCompletedFirstTimeGuide: true,
          firstTimeGuideCompletedAt: expect.any(String),
        })
      )
    })

    it("skip() advances demo guide without persisting to settings", async () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
      }
      mockIsDemoWorkspace = true

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("demo")
      expect(screen.getByTestId("step-index").textContent).toBe("0")

      await act(async () => {
        screen.getByTestId("skip").click()
      })

      expect(screen.getByTestId("active-guide").textContent).toBe("demo")
      expect(screen.getByTestId("step-index").textContent).toBe("1")
      expect(screen.getByTestId("skipped-steps").textContent).toContain("demo-intro")
      // patchSettings should NOT be called for demo guide
      expect(mockPatchSettings).not.toHaveBeenCalled()
    })
  })

  describe("exitGuide", () => {
    it("exitGuide() closes the demo guide immediately", async () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
      }
      mockIsDemoWorkspace = true

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("demo")

      await act(async () => {
        screen.getByTestId("exit").click()
      })

      expect(screen.getByTestId("active-guide").textContent).toBe("none")
      expect(mockPatchSettings).not.toHaveBeenCalled()
    })
  })

  describe("manual replay via startGuide", () => {
    it("startGuide('first-time') starts the first-time guide", () => {
      // No auto-start (guide already completed)
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: true,
      }

      renderWithProvider()

      expect(screen.getByTestId("active-guide").textContent).toBe("none")

      act(() => {
        screen.getByTestId("start-ft").click()
      })

      expect(screen.getByTestId("active-guide").textContent).toBe("first-time")
      expect(screen.getByTestId("step-index").textContent).toBe("0")
    })

    it("startGuide('demo') starts the demo guide", () => {
      mockUseLiveQueryReturn = {
        hasCompletedOnboarding: true,
        hasCompletedFirstTimeGuide: true,
      }

      renderWithProvider()

      act(() => {
        screen.getByTestId("start-demo").click()
      })

      expect(screen.getByTestId("active-guide").textContent).toBe("demo")
      expect(screen.getByTestId("total-steps").textContent).toBe(String(DEMO_STEPS.length))
    })
  })
})
