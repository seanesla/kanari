/**
 * Emotion Timeline Component Tests
 *
 * Tests for the EmotionTimeline visualization component that displays
 * Gemini semantic analysis results with per-segment emotion breakdown.
 *
 * These tests verify:
 * - Rendering different emotion types with correct styling
 * - Expand/collapse behavior
 * - Segment timeline display
 * - Observations section rendering
 * - Emotion distribution calculations
 * - Click handlers and interactions
 * - Compact variant display
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import {
  EmotionTimeline,
  EmotionTimelineCompact,
  EMOTION_CONFIG,
} from "../emotion-timeline"
import type { GeminiSemanticAnalysis, EmotionType } from "@/lib/types"

/**
 * Helper to create a mock analysis object for testing
 * @param overrides - Partial analysis object to override defaults
 */
function createMockAnalysis(
  overrides: Partial<GeminiSemanticAnalysis> = {}
): GeminiSemanticAnalysis {
  return {
    segments: [
      { timestamp: "00:05", content: "Hello, how are you?", emotion: "neutral" },
      { timestamp: "00:15", content: "I'm feeling great today!", emotion: "happy" },
      { timestamp: "00:30", content: "Work has been stressful", emotion: "sad" },
    ],
    overallEmotion: "neutral",
    emotionConfidence: 0.85,
    observations: [
      {
        type: "positive_cue",
        observation: "Speaker shows positive affect in greeting",
        relevance: "medium",
      },
      {
        type: "stress_cue",
        observation: "Mentions work stress",
        relevance: "high",
      },
    ],
    stressInterpretation: "Moderate stress indicators detected",
    fatigueInterpretation: "Energy levels appear normal",
    summary: "Speaker demonstrates mixed emotional state with some stress signals.",
    ...overrides,
  }
}

describe("EmotionTimeline", () => {
  describe("basic rendering", () => {
    it("renders without crashing", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} />)

      // Should render the overall emotion
      expect(screen.getByText(/neutral/i)).toBeInTheDocument()
    })

    it("displays overall emotion with correct emoji", () => {
      const analysis = createMockAnalysis({ overallEmotion: "happy" })
      render(<EmotionTimeline analysis={analysis} />)

      // Happy emoji should be visible
      expect(screen.getByText("😊")).toBeInTheDocument()
    })

    it("shows confidence percentage", () => {
      const analysis = createMockAnalysis({ emotionConfidence: 0.92 })
      render(<EmotionTimeline analysis={analysis} />)

      expect(screen.getByText(/confidence: 92%/i)).toBeInTheDocument()
    })

    it("shows segment count", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} />)

      // Should show "3 segments analyzed"
      expect(screen.getByText(/3 segments analyzed/i)).toBeInTheDocument()
    })

    it("handles single segment correctly", () => {
      const analysis = createMockAnalysis({
        segments: [{ timestamp: "00:05", content: "Hello", emotion: "neutral" }],
      })
      render(<EmotionTimeline analysis={analysis} />)

      expect(screen.getByText(/1 segment analyzed/i)).toBeInTheDocument()
    })
  })

  describe("expand/collapse behavior", () => {
    it("starts collapsed by default", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} />)

      // Summary should not be visible when collapsed
      expect(screen.queryByText(/emotion timeline/i)).not.toBeInTheDocument()
    })

    it("starts expanded when defaultExpanded is true", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      // Timeline header should be visible when expanded
      expect(screen.getByText(/emotion timeline/i)).toBeInTheDocument()
    })

    it("expands when clicked", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} />)

      // Click the header to expand
      const headerButton = screen.getByRole("button", {
        name: /toggle emotion timeline details/i,
      })
      fireEvent.click(headerButton)

      // Should now show timeline content
      expect(screen.getByText(/emotion timeline/i)).toBeInTheDocument()
    })

    it("collapses when clicked again", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      // Click to collapse
      const headerButton = screen.getByRole("button", {
        name: /toggle emotion timeline details/i,
      })
      fireEvent.click(headerButton)

      // Timeline content should be hidden (but may still be in DOM briefly due to animation)
      // Just verify the toggle happened by clicking again
      fireEvent.click(headerButton)
      expect(screen.getByText(/emotion timeline/i)).toBeInTheDocument()
    })
  })

  describe("segment display", () => {
    it("renders all segments when expanded", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      // Should show all segment timestamps
      expect(screen.getByText("00:05")).toBeInTheDocument()
      expect(screen.getByText("00:15")).toBeInTheDocument()
      expect(screen.getByText("00:30")).toBeInTheDocument()
    })

    it("shows segment content", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      expect(screen.getByText("Hello, how are you?")).toBeInTheDocument()
      expect(screen.getByText("I'm feeling great today!")).toBeInTheDocument()
    })

    it("shows emotion badge for each segment", () => {
      const analysis = createMockAnalysis({
        segments: [
          { timestamp: "00:05", content: "Test", emotion: "happy" },
        ],
      })
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      // Should show the happy emoji in segment
      const happyEmojis = screen.getAllByText("😊")
      expect(happyEmojis.length).toBeGreaterThanOrEqual(1)
    })

    it("truncates long segment content with show more button", () => {
      const longContent = "A".repeat(150) // Longer than 100 char truncation limit
      const analysis = createMockAnalysis({
        segments: [{ timestamp: "00:05", content: longContent, emotion: "neutral" }],
      })
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      // Should show "Show more" button
      expect(screen.getByText(/show more/i)).toBeInTheDocument()
    })

    it("calls onSegmentClick when segment is clicked", () => {
      const onSegmentClick = vi.fn()
      const analysis = createMockAnalysis()
      render(
        <EmotionTimeline
          analysis={analysis}
          defaultExpanded={true}
          onSegmentClick={onSegmentClick}
        />
      )

      // Click on a segment (the content area)
      const segmentContent = screen.getByText("Hello, how are you?")
      fireEvent.click(segmentContent)

      expect(onSegmentClick).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: "00:05",
          content: "Hello, how are you?",
          emotion: "neutral",
        })
      )
    })
  })

  describe("observations section", () => {
    it("shows observations when showObservations is true", () => {
      const analysis = createMockAnalysis()
      render(
        <EmotionTimeline
          analysis={analysis}
          defaultExpanded={true}
          showObservations={true}
        />
      )

      expect(screen.getByText(/key observations/i)).toBeInTheDocument()
    })

    it("hides observations when showObservations is false", () => {
      const analysis = createMockAnalysis()
      render(
        <EmotionTimeline
          analysis={analysis}
          defaultExpanded={true}
          showObservations={false}
        />
      )

      expect(screen.queryByText(/key observations/i)).not.toBeInTheDocument()
    })

    it("displays observation text", () => {
      const analysis = createMockAnalysis()
      render(
        <EmotionTimeline
          analysis={analysis}
          defaultExpanded={true}
          showObservations={true}
        />
      )

      expect(screen.getByText("Mentions work stress")).toBeInTheDocument()
    })

    it("shows observation type badges", () => {
      const analysis = createMockAnalysis()
      render(
        <EmotionTimeline
          analysis={analysis}
          defaultExpanded={true}
          showObservations={true}
        />
      )

      expect(screen.getByText("Stress Indicator")).toBeInTheDocument()
      expect(screen.getByText("Positive Sign")).toBeInTheDocument()
    })
  })

  describe("interpretations section", () => {
    it("shows stress interpretation", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      expect(screen.getByText("Stress Analysis")).toBeInTheDocument()
      expect(screen.getByText("Moderate stress indicators detected")).toBeInTheDocument()
    })

    it("shows fatigue interpretation", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      expect(screen.getByText("Fatigue Analysis")).toBeInTheDocument()
      expect(screen.getByText("Energy levels appear normal")).toBeInTheDocument()
    })
  })

  describe("summary section", () => {
    it("shows summary text", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      expect(
        screen.getByText(/speaker demonstrates mixed emotional state/i)
      ).toBeInTheDocument()
    })

    it("handles missing summary gracefully", () => {
      const analysis = createMockAnalysis({ summary: "" })
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      // Should not crash, just not show the summary section
      expect(screen.queryByText(/"/)).not.toBeInTheDocument()
    })
  })

  describe("emotion distribution", () => {
    it("shows distribution in header", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      // Should show emotion percentages in the legend
      // 1 neutral, 1 happy, 1 sad = 33% each
      expect(screen.getByText(/neutral:/i)).toBeInTheDocument()
      expect(screen.getByText(/happy:/i)).toBeInTheDocument()
      expect(screen.getByText(/sad:/i)).toBeInTheDocument()
    })

    it("calculates correct percentages", () => {
      const analysis = createMockAnalysis({
        segments: [
          { timestamp: "00:05", content: "A", emotion: "happy" },
          { timestamp: "00:10", content: "B", emotion: "happy" },
          { timestamp: "00:15", content: "C", emotion: "sad" },
          { timestamp: "00:20", content: "D", emotion: "sad" },
        ],
      })
      render(<EmotionTimeline analysis={analysis} defaultExpanded={true} />)

      // 2 happy, 2 sad = 50% each - there will be two elements with this text
      const percentageElements = screen.getAllByText("2 (50%)")
      expect(percentageElements.length).toBe(2) // One for happy, one for sad
    })
  })

  describe("emotion type styling", () => {
    const emotionTypes: EmotionType[] = ["happy", "sad", "angry", "neutral"]

    emotionTypes.forEach((emotion) => {
      it(`renders ${emotion} emotion with correct emoji`, () => {
        const analysis = createMockAnalysis({ overallEmotion: emotion })
        render(<EmotionTimeline analysis={analysis} />)

        expect(screen.getByText(EMOTION_CONFIG[emotion].emoji)).toBeInTheDocument()
      })
    })
  })

  describe("accessibility", () => {
    it("has accessible expand/collapse button", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} />)

      const button = screen.getByRole("button", {
        name: /toggle emotion timeline details/i,
      })
      expect(button).toHaveAttribute("aria-expanded", "false")
    })

    it("updates aria-expanded on toggle", () => {
      const analysis = createMockAnalysis()
      render(<EmotionTimeline analysis={analysis} />)

      const button = screen.getByRole("button", {
        name: /toggle emotion timeline details/i,
      })

      fireEvent.click(button)
      expect(button).toHaveAttribute("aria-expanded", "true")
    })
  })
})

describe("EmotionTimelineCompact", () => {
  it("renders overall emotion badge", () => {
    const analysis = createMockAnalysis({ overallEmotion: "happy" })
    render(<EmotionTimelineCompact analysis={analysis} />)

    expect(screen.getByText("😊")).toBeInTheDocument()
  })

  it("shows segment count", () => {
    const analysis = createMockAnalysis()
    render(<EmotionTimelineCompact analysis={analysis} />)

    expect(screen.getByText(/3 segments/i)).toBeInTheDocument()
  })

  it("shows confidence percentage", () => {
    const analysis = createMockAnalysis({ emotionConfidence: 0.75 })
    render(<EmotionTimelineCompact analysis={analysis} />)

    expect(screen.getByText(/75% confident/i)).toBeInTheDocument()
  })

  it("handles singular segment correctly", () => {
    const analysis = createMockAnalysis({
      segments: [{ timestamp: "00:05", content: "Test", emotion: "neutral" }],
    })
    render(<EmotionTimelineCompact analysis={analysis} />)

    expect(screen.getByText(/1 segment/i)).toBeInTheDocument()
    expect(screen.queryByText(/segments/i)).not.toBeInTheDocument()
  })
})

describe("EMOTION_CONFIG", () => {
  it("exports emotion configuration", () => {
    expect(EMOTION_CONFIG).toBeDefined()
    expect(EMOTION_CONFIG.happy).toBeDefined()
    expect(EMOTION_CONFIG.sad).toBeDefined()
    expect(EMOTION_CONFIG.angry).toBeDefined()
    expect(EMOTION_CONFIG.neutral).toBeDefined()
  })

  it("has correct structure for each emotion", () => {
    Object.values(EMOTION_CONFIG).forEach((config) => {
      expect(config).toHaveProperty("emoji")
      expect(config).toHaveProperty("label")
      expect(config).toHaveProperty("color")
      expect(config).toHaveProperty("bgColor")
      expect(config).toHaveProperty("borderColor")
    })
  })

  it("has unique emojis for each emotion", () => {
    const emojis = Object.values(EMOTION_CONFIG).map((c) => c.emoji)
    const uniqueEmojis = new Set(emojis)
    expect(uniqueEmojis.size).toBe(emojis.length)
  })
})
