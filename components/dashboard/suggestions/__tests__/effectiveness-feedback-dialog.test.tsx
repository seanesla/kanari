/**
 * @vitest-environment jsdom
 */

/**
 * Tests for EffectivenessFeedbackDialog
 *
 * Tests the feedback dialog shown after a user marks a suggestion as complete.
 * Covers:
 * - Rendering rating options
 * - Rating selection and submission
 * - Skip functionality
 * - Dialog open/close behavior
 * - EffectivenessStats component
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { EffectivenessFeedbackDialog, EffectivenessStats } from "../effectiveness-feedback-dialog"
import type { Suggestion, EffectivenessFeedback } from "@/lib/types"

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
    button: ({ children, className, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button className={className} onClick={onClick} disabled={disabled} {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Sample suggestion for tests
const createMockSuggestion = (overrides: Partial<Suggestion> = {}): Suggestion => ({
  id: "test-suggestion-1",
  content: "Take a 10-minute walk outside",
  rationale: "Physical activity helps reduce stress",
  duration: 10,
  category: "exercise",
  status: "scheduled",
  createdAt: "2025-12-28T10:00:00Z",
  scheduledFor: "2025-12-28T14:00:00Z",
  ...overrides,
})

describe("EffectivenessFeedbackDialog", () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSubmit = vi.fn()
  const mockOnSkip = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders nothing when suggestion is null", () => {
      const { container } = render(
        <EffectivenessFeedbackDialog
          suggestion={null}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )
      expect(container).toBeEmptyDOMElement()
    })

    it("renders the dialog when open with a suggestion", () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText("Nice work!")).toBeInTheDocument()
      expect(screen.getByText("Did this suggestion help you feel better?")).toBeInTheDocument()
    })

    it("renders all three rating options", () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText("Very Helpful")).toBeInTheDocument()
      expect(screen.getByText("Somewhat Helpful")).toBeInTheDocument()
      expect(screen.getByText("Not Helpful")).toBeInTheDocument()
    })

    it("renders rating descriptions", () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText("This really made a difference")).toBeInTheDocument()
      expect(screen.getByText("It helped a little bit")).toBeInTheDocument()
      expect(screen.getByText("This didn't help much")).toBeInTheDocument()
    })

    it("renders skip button", () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText("Skip for now")).toBeInTheDocument()
    })

    it("renders privacy note", () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText("Your feedback helps us improve suggestions")).toBeInTheDocument()
    })
  })

  describe("rating selection", () => {
    it("calls onSubmit with 'very_helpful' when clicking Very Helpful", async () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      const veryHelpfulButton = screen.getByText("Very Helpful").closest("button")
      fireEvent.click(veryHelpfulButton!)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            rating: "very_helpful",
            ratedAt: expect.any(String),
          })
        )
      })
    })

    it("calls onSubmit with 'somewhat_helpful' when clicking Somewhat Helpful", async () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      const somewhatHelpfulButton = screen.getByText("Somewhat Helpful").closest("button")
      fireEvent.click(somewhatHelpfulButton!)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            rating: "somewhat_helpful",
            ratedAt: expect.any(String),
          })
        )
      })
    })

    it("calls onSubmit with 'not_helpful' when clicking Not Helpful", async () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      const notHelpfulButton = screen.getByText("Not Helpful").closest("button")
      fireEvent.click(notHelpfulButton!)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            rating: "not_helpful",
            ratedAt: expect.any(String),
          })
        )
      })
    })

    it("closes the dialog after rating submission", async () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      const veryHelpfulButton = screen.getByText("Very Helpful").closest("button")
      fireEvent.click(veryHelpfulButton!)

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })
  })

  describe("skip functionality", () => {
    it("calls onSubmit with 'skipped' when clicking skip", () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      )

      const skipButton = screen.getByText("Skip for now")
      fireEvent.click(skipButton)

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: "skipped",
          ratedAt: expect.any(String),
        })
      )
    })

    it("calls onSkip callback when skipping", () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      )

      const skipButton = screen.getByText("Skip for now")
      fireEvent.click(skipButton)

      expect(mockOnSkip).toHaveBeenCalled()
    })

    it("closes dialog when skipping", () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      const skipButton = screen.getByText("Skip for now")
      fireEvent.click(skipButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe("feedback timestamp", () => {
    it("includes a valid ISO timestamp in feedback", async () => {
      render(
        <EffectivenessFeedbackDialog
          suggestion={createMockSuggestion()}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
        />
      )

      const veryHelpfulButton = screen.getByText("Very Helpful").closest("button")
      fireEvent.click(veryHelpfulButton!)

      await waitFor(() => {
        const call = mockOnSubmit.mock.calls[0][0] as EffectivenessFeedback
        expect(() => new Date(call.ratedAt)).not.toThrow()
        expect(new Date(call.ratedAt).toISOString()).toBe(call.ratedAt)
      })
    })
  })
})

describe("EffectivenessStats", () => {
  describe("rendering with no feedback", () => {
    it("shows 'no feedback' message when total is 0", () => {
      render(
        <EffectivenessStats
          stats={{
            veryHelpful: 0,
            somewhatHelpful: 0,
            notHelpful: 0,
            total: 0,
          }}
        />
      )

      expect(screen.getByText("No feedback collected yet")).toBeInTheDocument()
    })
  })

  describe("rendering with feedback", () => {
    it("displays all rating counts", () => {
      render(
        <EffectivenessStats
          stats={{
            veryHelpful: 5,
            somewhatHelpful: 3,
            notHelpful: 2,
            total: 10,
          }}
        />
      )

      expect(screen.getByText("5")).toBeInTheDocument()
      expect(screen.getByText("3")).toBeInTheDocument()
      expect(screen.getByText("2")).toBeInTheDocument()
    })

    it("calculates helpful percentage correctly (100% helpful)", () => {
      render(
        <EffectivenessStats
          stats={{
            veryHelpful: 10,
            somewhatHelpful: 0,
            notHelpful: 0,
            total: 10,
          }}
        />
      )

      expect(screen.getByText("(100% helpful)")).toBeInTheDocument()
    })

    it("calculates helpful percentage correctly (0% helpful)", () => {
      render(
        <EffectivenessStats
          stats={{
            veryHelpful: 0,
            somewhatHelpful: 0,
            notHelpful: 10,
            total: 10,
          }}
        />
      )

      expect(screen.getByText("(0% helpful)")).toBeInTheDocument()
    })

    it("calculates helpful percentage with weighted somewhat_helpful", () => {
      // 5 very_helpful (100%) + 4 somewhat_helpful (50% = 2) + 1 not_helpful (0%)
      // = (5 + 2) / 10 = 70%
      render(
        <EffectivenessStats
          stats={{
            veryHelpful: 5,
            somewhatHelpful: 4,
            notHelpful: 1,
            total: 10,
          }}
        />
      )

      expect(screen.getByText("(70% helpful)")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(
        <EffectivenessStats
          stats={{
            veryHelpful: 1,
            somewhatHelpful: 1,
            notHelpful: 1,
            total: 3,
          }}
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass("custom-class")
    })
  })
})
