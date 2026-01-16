/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Suggestion } from "@/lib/types"

let lastCalendarProps: Record<string, unknown> | null = null
let lastScheduleDialogProps: Record<string, unknown> | null = null

const handleTimeSlotClick = vi.fn()
const handleExternalDrop = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/app/dashboard/layout", () => ({
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

const scheduleDialogSuggestion: Suggestion = {
  id: "s1",
  content: "Schedule me",
  rationale: "rationale",
  duration: 15,
  category: "break",
  status: "pending",
  createdAt: "2026-01-16T00:00:00.000Z",
}

vi.mock("@/hooks/use-suggestion-workflow", () => ({
  useSuggestionWorkflow: () => ({
    selectedSuggestion: null,
    scheduleDialogSuggestion,
    pendingDragActive: true,
    droppedSuggestion: {
      suggestion: scheduleDialogSuggestion,
      dateISO: "2026-01-20",
      hour: 14,
      minute: 15,
    },
    handlers: {
      handleSuggestionClick: vi.fn(),
      handleScheduleFromDialog: vi.fn(),
      handleExternalDrop,
      handleTimeSlotClick,
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
    FullCalendarView: (props: Record<string, unknown>) => {
      lastCalendarProps = props
      return React.createElement("div", { "data-testid": "calendar" })
    },
  }
})

vi.mock("@/components/dashboard/suggestions", async () => {
  const React = await import("react")
  return {
    SuggestionDetailDialog: () => React.createElement("div", null),
    ScheduleTimeDialog: (props: Record<string, unknown>) => {
      lastScheduleDialogProps = props
      return React.createElement("div", { "data-testid": "schedule-dialog" })
    },
  }
})

vi.mock("@/components/achievements", async () => {
  const React = await import("react")
  return {
    DailyAchievementCard: () => React.createElement("div", null),
    CelebrationToastQueue: () => null,
  }
})

describe("UnifiedDashboard scheduling wiring", () => {
  beforeEach(() => {
    lastCalendarProps = null
    lastScheduleDialogProps = null
    vi.clearAllMocks()
  })

  it("wires FullCalendar interactions and passes drop defaults to ScheduleTimeDialog", async () => {
    const { UnifiedDashboard } = await import("@/components/dashboard/unified-dashboard")

    render(<UnifiedDashboard />)

    expect(lastCalendarProps).not.toBeNull()
    expect(lastCalendarProps?.onTimeSlotClick).toEqual(expect.any(Function))
    expect(lastCalendarProps?.onExternalDrop).toEqual(expect.any(Function))
    expect(lastCalendarProps?.pendingDragActive).toBe(true)

    expect(lastScheduleDialogProps).not.toBeNull()
    expect(lastScheduleDialogProps?.defaultDateISO).toBe("2026-01-20")
    expect(lastScheduleDialogProps?.defaultHour).toBe(14)
    expect(lastScheduleDialogProps?.defaultMinute).toBe(15)
  })
})

