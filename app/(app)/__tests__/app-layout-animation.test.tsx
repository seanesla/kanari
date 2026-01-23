/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import AppLayout from "../layout"
import { useDashboardAnimation } from "@/lib/dashboard-animation-context"

// Make pathname dynamic inside mocks
let currentPath = "/overview"

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}))

// Provide minimal stubs for layout dependencies
vi.mock("@/hooks/use-onboarding", () => ({
  useOnboardingGuard: () => ({ isReady: true }),
}))

vi.mock("@/lib/scene-context", () => ({
  useSceneMode: () => ({ setMode: vi.fn() }),
}))

function TestPage() {
  const { shouldAnimate } = useDashboardAnimation()
  return <div data-testid="flag">{shouldAnimate ? "true" : "false"}</div>
}

describe("Dashboard animation flag", () => {
  beforeEach(() => {
    currentPath = "/overview"
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("is enabled on initial dashboard load and then disables after the delay", () => {
    render(
      <AppLayout>
        <TestPage />
      </AppLayout>
    )

    expect(screen.getByTestId("flag").textContent).toBe("true")

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByTestId("flag").textContent).toBe("false")
  })

  it("stays disabled when navigating between dashboard pages", () => {
    const { rerender } = render(
      <AppLayout>
        <TestPage />
      </AppLayout>
    )

    // Allow the initial animation window to expire
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByTestId("flag").textContent).toBe("false")

    // Simulate navigation to a different dashboard route
    currentPath = "/analytics"
    rerender(
      <AppLayout>
        <TestPage />
      </AppLayout>
    )

    expect(screen.getByTestId("flag").textContent).toBe("false")
  })
})
