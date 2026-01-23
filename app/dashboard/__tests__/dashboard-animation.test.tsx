/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import DashboardLayout, { useDashboardAnimation } from "../layout"

// Make pathname dynamic inside mocks
let currentPath = "/dashboard"

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
    currentPath = "/dashboard"
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("is enabled on initial dashboard load and then disables after the delay", () => {
    render(
      <DashboardLayout>
        <TestPage />
      </DashboardLayout>
    )

    expect(screen.getByTestId("flag").textContent).toBe("true")

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByTestId("flag").textContent).toBe("false")
  })

  it("stays disabled when navigating between dashboard pages", () => {
    const { rerender } = render(
      <DashboardLayout>
        <TestPage />
      </DashboardLayout>
    )

    // Allow the initial animation window to expire
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByTestId("flag").textContent).toBe("false")

    // Simulate navigation to a different dashboard route
    currentPath = "/dashboard/analytics"
    rerender(
      <DashboardLayout>
        <TestPage />
      </DashboardLayout>
    )

    expect(screen.getByTestId("flag").textContent).toBe("false")
  })
})
