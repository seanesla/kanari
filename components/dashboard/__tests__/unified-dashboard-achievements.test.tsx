/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { UnifiedDashboard } from "@/components/dashboard/unified-dashboard"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/dashboard-animation-context", () => ({
  useDashboardAnimation: () => ({ shouldAnimate: false }),
}))

vi.mock("@/hooks/use-responsive", () => ({
  useResponsive: () => ({ isMobile: false }),
}))

vi.mock("@/hooks/use-storage", () => ({
  useTrendData: () => [],
  useRecordings: () => [],
  useCheckInSessions: () => [],
  useRecoveryBlockActions: () => ({ addRecoveryBlock: vi.fn(async () => {}) }),
  useRecoveryBlocks: () => [],
}))

vi.mock("@/hooks/use-local-calendar", () => ({
  useLocalCalendar: () => ({
    isConnected: false,
    scheduleEvent: vi.fn(async () => null),
  }),
}))

vi.mock("@/hooks/use-suggestions", () => ({
  useSuggestions: () => ({
    suggestions: [],
    loading: false,
    regenerateWithDiff: vi.fn(async () => {}),
    scheduleSuggestion: vi.fn(async () => true),
    dismissSuggestion: vi.fn(async () => true),
    completeSuggestion: vi.fn(async () => true),
  }),
  featuresToVoicePatterns: () => ({}),
  computeHistoricalContext: () => ({}),
}))

vi.mock("@/hooks/use-suggestion-workflow", () => ({
  useSuggestionWorkflow: () => ({
    selectedSuggestion: null,
    scheduleDialogSuggestion: null,
    handlers: {
      handleSuggestionClick: vi.fn(),
      handleScheduleFromDialog: vi.fn(),
      handleExternalDrop: vi.fn(),
      handleTimeSlotClick: vi.fn(),
      handleScheduleConfirm: vi.fn(async () => true),
      handleDismiss: vi.fn(async () => true),
      handleComplete: vi.fn(async () => true),
      handleCompleteWithFeedback: vi.fn(async () => true),
      handleEventClick: vi.fn(),
      handleDragStart: vi.fn(),
      handleDragEnd: vi.fn(),
      closeDialogs: vi.fn(),
    },
  }),
}))

const completeAchievement = vi.fn()

vi.mock("@/hooks/use-achievements", () => ({
  useAchievements: () => ({
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
    progress: { level: 1, levelTitle: "Grounded Beginner", totalPoints: 0 },
    dayCompletion: {
      recommendedActionsCompleted: 0,
      recommendedActionsRequired: 2,
      isComplete: false,
      completedCount: 0,
      totalCount: 1,
      completeAllDailyAchievements: false,
    },
    loading: false,
    completeAchievement,
    celebrationQueue: [],
    milestoneCelebrationQueue: [],
    markAchievementSeen: vi.fn(),
    markMilestoneSeen: vi.fn(),
  }),
}))

vi.mock("@/components/achievements", async () => {
  const React = await import("react")
  return {
    DailyAchievementCard: ({
      achievement,
      onClick,
    }: {
      achievement: { title: string }
      onClick?: () => void
    }) =>
      React.createElement(
        "button",
        { type: "button", onClick, "aria-label": achievement.title },
        achievement.title
      ),
    CelebrationToastQueue: () => null,
  }
})

vi.mock("@/components/dashboard/collapsible-section", async () => {
  const React = await import("react")
  return {
    CollapsibleSection: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  }
})

vi.mock("@/components/dashboard/metrics-header-bar", async () => {
  const React = await import("react")
  return {
    MetricsHeaderBar: () => React.createElement("div", null, "Metrics"),
  }
})

vi.mock("@/components/dashboard/overview-analytics-section", async () => {
  const React = await import("react")
  return {
    OverviewAnalyticsSection: () => React.createElement("div", null, "Analytics"),
  }
})

vi.mock("@/components/dashboard/insights-panel", async () => {
  const React = await import("react")
  return {
    InsightsPanel: () => React.createElement("div", null, "Insights"),
  }
})

vi.mock("@/components/dashboard/journal-entries-panel", async () => {
  const React = await import("react")
  return {
    JournalEntriesPanel: () => React.createElement("div", null, "Journal"),
  }
})

vi.mock("@/components/dashboard/suggestions/kanban-board", async () => {
  const React = await import("react")
  return {
    KanbanBoard: () => React.createElement("div", null, "Kanban"),
  }
})

vi.mock("@/components/dashboard/calendar", async () => {
  const React = await import("react")
  return {
    FullCalendarView: () => React.createElement("div", null, "Calendar"),
  }
})

vi.mock("@/components/dashboard/suggestions", async () => {
  const React = await import("react")
  return {
    SuggestionDetailDialog: () => React.createElement("div", null),
    ScheduleTimeDialog: () => React.createElement("div", null),
  }
})

describe("UnifiedDashboard achievements preview", () => {
  it("routes to the relevant feature instead of completing the achievement directly", () => {
    render(<UnifiedDashboard />)

    fireEvent.click(screen.getByRole("button", { name: "Daily Check-in" }))

    expect(completeAchievement).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith("/check-ins?newCheckIn=true")
  })
})
