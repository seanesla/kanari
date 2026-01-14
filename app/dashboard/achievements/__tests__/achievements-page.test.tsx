/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import AchievementsPage from "@/app/dashboard/achievements/page"

vi.mock("@/app/dashboard/layout", () => ({
  useDashboardAnimation: () => ({ shouldAnimate: false }),
}))

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({
    timeZone: "UTC",
    setTimeZone: vi.fn(),
    availableTimeZones: ["UTC"],
    isLoading: false,
  }),
}))

vi.mock("@/hooks/use-storage", () => ({
  useRecordings: () => [],
  useAllSuggestions: () => [],
  useCheckInSessions: () => [],
}))

vi.mock("@/components/achievements", async () => {
  const React = await import("react")
  return {
    DailyAchievementCard: ({ achievement }: { achievement: { title: string } }) =>
      React.createElement("div", null, achievement.title),
    CelebrationToastQueue: () => null,
  }
})

vi.mock("@/hooks/use-achievements", () => ({
  useAchievements: () => ({
    loading: false,
    error: null,
    progress: {
      id: "default",
      totalPoints: 120,
      level: 2,
      levelTitle: "Steady Builder",
      currentDailyCompletionStreak: 1,
      longestDailyCompletionStreak: 1,
      lastCompletedDateISO: null,
      lastGeneratedDateISO: "2026-01-14",
    },
    todayISO: "2026-01-14",
    todayCounts: { checkInsToday: 0, suggestionsCompletedToday: 0, suggestionsScheduledToday: 0 },
    achievementsToday: [
      {
        id: "a1",
        dateISO: "2026-01-14",
        sourceDateISO: "2026-01-14",
        type: "challenge",
        category: "consistency",
        title: "Daily Check-in",
        description: "Do a daily check-in today.",
        points: 20,
        createdAt: "2026-01-14T00:00:00.000Z",
        completed: false,
        carriedOver: false,
        seen: true,
        tracking: { key: "do_check_in", target: 1 },
      },
    ],
    history: [],
    milestoneBadges: [],
    celebrationQueue: [],
    milestoneCelebrationQueue: [],
    dayCompletion: {
      completeAllDailyAchievements: false,
      recommendedActionsCompleted: 0,
      recommendedActionsRequired: 2,
      isComplete: false,
      completedCount: 0,
      totalCount: 1,
    },
    ensureToday: vi.fn(),
    markAchievementSeen: vi.fn(),
    markMilestoneSeen: vi.fn(),
  }),
}))

describe("AchievementsPage", () => {
  it("does not allow manually completing challenges; instead it links to the relevant feature", () => {
    render(<AchievementsPage />)

    // Challenges should not be completable by clicking a "Mark complete" button.
    expect(screen.queryByRole("button", { name: /mark complete/i })).not.toBeInTheDocument()

    // The UI should route users to the relevant feature (check-in) to complete it.
    const cta = screen.getByRole("link", { name: /start check-in/i })
    expect(cta).toHaveAttribute("href", "/dashboard/history?newCheckIn=true")
  })
})
