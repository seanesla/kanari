import { describe, it, expect, vi } from "vitest"
import type { EnrichedWellnessContext, GeminiMemoryContext } from "@/lib/types"

describe("generateDiffAwareUserPrompt", () => {
  it("includes category preferences, concrete rules, and effectiveness feedback", async () => {
    const { generateDiffAwareUserPrompt } = await vi.importActual<
      typeof import("@/lib/gemini/prompts")
    >("@/lib/gemini/prompts")

    const context: EnrichedWellnessContext = {
      stressScore: 70,
      stressLevel: "high",
      fatigueScore: 55,
      fatigueLevel: "moderate",
      trend: "rising",
      timeOfDay: "evening",
      dayOfWeek: "weekday",
      voicePatterns: {
        speechRate: "fast",
        energyLevel: "low",
        pauseFrequency: "frequent",
        voiceTone: "dull",
      },
      history: {
        recordingCount: 0,
        daysOfData: 0,
        averageStress: 70,
        averageFatigue: 55,
        stressChange: "stable",
        fatigueChange: "stable",
      },
      burnout: {
        riskLevel: "low",
        predictedDays: 0,
        factors: [],
      },
      confidence: 0.9,
    }

    const memoryContext: GeminiMemoryContext = {
      completed: [],
      dismissed: [],
      scheduled: [],
      stats: {
        totalCompleted: 9,
        totalDismissed: 7,
        mostUsedCategory: "mindfulness",
        leastUsedCategory: "exercise",
        averageCompletionRate: 65,
        categoryStats: {
          mindfulness: { completed: 8, dismissed: 1, total: 9, completionRate: 89, preference: "high" },
          rest: { completed: 5, dismissed: 2, total: 7, completionRate: 71, preference: "high" },
          break: { completed: 3, dismissed: 3, total: 6, completionRate: 50, preference: "medium" },
          social: { completed: 1, dismissed: 2, total: 3, completionRate: 33, preference: "low" },
          exercise: { completed: 1, dismissed: 6, total: 7, completionRate: 14, preference: "avoid" },
        },
        preferredCategories: ["mindfulness", "rest"],
        avoidedCategories: ["exercise"],
        effectivenessByCategory: {
          mindfulness: { totalRatings: 5, helpfulRatings: 4, notHelpfulRatings: 1, helpfulRate: 80 },
          exercise: { totalRatings: 0, helpfulRatings: 0, notHelpfulRatings: 0, helpfulRate: 0 },
          rest: { totalRatings: 3, helpfulRatings: 1, notHelpfulRatings: 2, helpfulRate: 33 },
          break: { totalRatings: 0, helpfulRatings: 0, notHelpfulRatings: 0, helpfulRate: 0 },
          social: { totalRatings: 0, helpfulRatings: 0, notHelpfulRatings: 0, helpfulRate: 0 },
        },
      },
    }

    const prompt = generateDiffAwareUserPrompt(context, [], memoryContext)

    expect(prompt).toContain("CATEGORY PREFERENCES:")
    expect(prompt).toContain("| mindfulness | 8 | 1 | 89% | HIGH |")
    expect(prompt).toContain("CATEGORY RULES (MUST FOLLOW):")
    expect(prompt).toContain("PRIORITIZE categories with >60% completion rate: [mindfulness, rest]")
    expect(prompt).toContain("AVOID categories with >50% dismissal rate: [exercise]")
    expect(prompt).toContain("EFFECTIVENESS FEEDBACK:")
    expect(prompt).toContain("- mindfulness: 80% rated helpful (5 ratings)")
  })
})

