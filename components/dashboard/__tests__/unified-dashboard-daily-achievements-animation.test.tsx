/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { UnifiedDashboard } from "@/components/dashboard/unified-dashboard"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/app/dashboard/layout", () => ({
  useDashboardAnimation: () => ({ shouldAnimate: true }),
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

vi.mock("@/hooks/use-achievements", () => ({
  useAchievements: () => ({
    achievementsToday: [],
    progress: { level: 1, levelTitle: "Grounded Beginner", totalPoints: 0 },
    dayCompletion: {
      recommendedActionsCompleted: 0,
      recommendedActionsRequired: 2,
      isComplete: false,
      completedCount: 0,
      totalCount: 0,
      completeAllDailyAchievements: false,
    },
    loading: false,
    celebrationQueue: [],
    milestoneCelebrationQueue: [],
    markAchievementSeen: vi.fn(),
    markMilestoneSeen: vi.fn(),
  }),
}))

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

vi.mock("@/components/achievements", async () => {
  const React = await import("react")
  return {
    DailyAchievementCard: ({ achievement }: { achievement: { title: string } }) => React.createElement("div", null, achievement.title),
    CelebrationToastQueue: () => null,
  }
})

describe("UnifiedDashboard daily achievements entry animation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("fades/slides in after the initial animation delay", () => {
    render(<UnifiedDashboard />)

    const block = screen.getByTestId("dashboard-daily-achievements")
    expect(block).toHaveClass("opacity-0")

    act(() => {
      vi.advanceTimersByTime(120)
    })

    expect(block).toHaveClass("opacity-100")
  })
})

