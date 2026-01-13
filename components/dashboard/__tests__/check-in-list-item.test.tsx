// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { HistoryItem } from "@/lib/types"

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({ timeZone: "UTC" }),
}))

// CheckInListItem uses SidebarMenuButton which depends on SidebarProvider context.
// For this unit test, a lightweight mock is enough.
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe("CheckInListItem", () => {
  it("renders stress/fatigue bands (low/medium/high) instead of numeric scores", async () => {
    const { CheckInListItem } = await import("../check-in-list-item")

    const item: HistoryItem = {
      id: "s1",
      type: "ai_chat",
      timestamp: "2026-01-09T10:00:00Z",
      session: {
        id: "s1",
        startedAt: "2026-01-09T10:00:00Z",
        messages: [],
        acousticMetrics: {
          stressScore: 42,
          fatigueScore: 70,
          stressLevel: "moderate",
          fatigueLevel: "tired",
          confidence: 0.8,
          analyzedAt: "2026-01-09T10:01:00Z",
          features: {
            mfcc: [],
            spectralCentroid: 0,
            spectralFlux: 0,
            spectralRolloff: 0,
            rms: 0,
            zcr: 0,
            speechRate: 0,
            pauseRatio: 0,
            pauseCount: 0,
            avgPauseDuration: 0,
            pitchMean: 0,
            pitchStdDev: 0,
            pitchRange: 0,
          },
        },
      },
    }

    render(<CheckInListItem item={item} isSelected={false} onSelect={() => {}} />)

    expect(screen.getByText("Stress: medium • Fatigue: high")).toBeInTheDocument()
  })
})

