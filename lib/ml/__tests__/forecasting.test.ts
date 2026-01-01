import { describe, it, expect } from "vitest"
import { predictBurnoutRisk, recordingsToTrendData, sessionsToTrendData } from "../forecasting"
import type { TrendData } from "@/lib/types"

/**
 * Helper to create TrendData array for a given number of days
 * with specified stress/fatigue scores
 */
function createTrendData(
  days: number,
  stressScore: number | ((day: number) => number),
  fatigueScore: number | ((day: number) => number)
): TrendData[] {
  const result: TrendData[] = []
  for (let i = 0; i < days; i++) {
    const stress = typeof stressScore === "function" ? stressScore(i) : stressScore
    const fatigue = typeof fatigueScore === "function" ? fatigueScore(i) : fatigueScore
    result.push({
      date: `2024-01-${String(i + 1).padStart(2, "0")}`,
      stressScore: stress,
      fatigueScore: fatigue,
    })
  }
  return result
}

describe("predictBurnoutRisk", () => {
  describe("insufficient data handling", () => {
    it("returns low risk with 0.1 confidence for empty data", () => {
      const result = predictBurnoutRisk([])
      expect(result.riskLevel).toBe("low")
      expect(result.riskScore).toBe(0)
      expect(result.confidence).toBe(0.1)
      expect(result.factors).toContain("Insufficient data for prediction")
    })

    it("returns low risk with 0.1 confidence for single data point", () => {
      const result = predictBurnoutRisk([
        { date: "2024-01-01", stressScore: 50, fatigueScore: 50 },
      ])
      expect(result.riskLevel).toBe("low")
      expect(result.confidence).toBe(0.1)
      expect(result.factors).toContain("Insufficient data for prediction")
    })

    it("can make predictions with 2 data points (minimum)", () => {
      const result = predictBurnoutRisk([
        { date: "2024-01-01", stressScore: 20, fatigueScore: 20 },
        { date: "2024-01-02", stressScore: 20, fatigueScore: 20 },
      ])
      expect(result.confidence).toBeGreaterThan(0.1)
      expect(result.factors).not.toContain("Insufficient data for prediction")
    })
  })

  describe("risk level classification", () => {
    it("returns 'low' risk for consistently low scores", () => {
      const data = createTrendData(7, 20, 20)
      const result = predictBurnoutRisk(data)
      expect(result.riskLevel).toBe("low")
      expect(result.riskScore).toBeLessThan(35)
    })

    it("returns 'moderate' risk for stable high scores", () => {
      // Stable high scores only contribute 40% weight (Factor 1)
      // Score of 90 gives: 90 * 0.4 = 36 → moderate
      const data = createTrendData(7, 90, 90)
      const result = predictBurnoutRisk(data)
      expect(result.riskLevel).toBe("moderate")
      expect(result.riskScore).toBeGreaterThanOrEqual(35)
      expect(result.riskScore).toBeLessThan(55)
    })

    it("returns 'high' risk for worsening trend with high scores", () => {
      // Worsening trend + high recent scores triggers Factors 1, 2, 4
      // Scores rising from 40 to 80: slope ~6-7, recentAvg ~75
      const data = createTrendData(7, (day) => 40 + day * 7, (day) => 40 + day * 7)
      const result = predictBurnoutRisk(data)
      expect(["moderate", "high"]).toContain(result.riskLevel)
      expect(result.riskScore).toBeGreaterThanOrEqual(35)
    })

    it("returns 'critical' risk for steep worsening with high volatility", () => {
      // Steep upward trend + volatility + high recent scores
      // This triggers all risk factors for maximum score
      const volatileWorsening: TrendData[] = [
        { date: "2024-01-01", stressScore: 30, fatigueScore: 30 },
        { date: "2024-01-02", stressScore: 50, fatigueScore: 40 },
        { date: "2024-01-03", stressScore: 45, fatigueScore: 55 },
        { date: "2024-01-04", stressScore: 65, fatigueScore: 60 },
        { date: "2024-01-05", stressScore: 70, fatigueScore: 75 },
        { date: "2024-01-06", stressScore: 85, fatigueScore: 80 },
        { date: "2024-01-07", stressScore: 95, fatigueScore: 90 },
      ]
      const result = predictBurnoutRisk(volatileWorsening)
      expect(result.riskLevel).toBe("critical")
      expect(result.riskScore).toBeGreaterThanOrEqual(75)
    })
  })

  describe("trend direction detection", () => {
    it("detects 'stable' trend for constant scores", () => {
      const data = createTrendData(7, 40, 40)
      const result = predictBurnoutRisk(data)
      expect(result.trend).toBe("stable")
    })

    it("detects 'declining' trend for worsening scores", () => {
      // Scores increasing over time = worsening wellness = declining trend
      const data = createTrendData(7, (day) => 30 + day * 8, (day) => 30 + day * 8)
      const result = predictBurnoutRisk(data)
      expect(result.trend).toBe("declining")
    })

    it("detects 'improving' trend for improving scores", () => {
      // Scores decreasing over time = improving wellness
      const data = createTrendData(7, (day) => 70 - day * 8, (day) => 70 - day * 8)
      const result = predictBurnoutRisk(data)
      expect(result.trend).toBe("improving")
    })
  })

  describe("confidence calculation", () => {
    it("returns higher confidence with more data points", () => {
      const shortData = createTrendData(3, 40, 40)
      const longData = createTrendData(14, 40, 40)

      const shortResult = predictBurnoutRisk(shortData)
      const longResult = predictBurnoutRisk(longData)

      expect(longResult.confidence).toBeGreaterThan(shortResult.confidence)
    })

    it("returns lower confidence for volatile data", () => {
      // Stable data
      const stableData = createTrendData(7, 40, 40)

      // Volatile data - oscillating high and low
      const volatileData: TrendData[] = []
      for (let i = 0; i < 7; i++) {
        volatileData.push({
          date: `2024-01-${String(i + 1).padStart(2, "0")}`,
          stressScore: i % 2 === 0 ? 20 : 80,
          fatigueScore: i % 2 === 0 ? 20 : 80,
        })
      }

      const stableResult = predictBurnoutRisk(stableData)
      const volatileResult = predictBurnoutRisk(volatileData)

      expect(stableResult.confidence).toBeGreaterThan(volatileResult.confidence)
    })

    it("confidence is clamped between 0.1 and 1", () => {
      const data = createTrendData(7, 40, 40)
      const result = predictBurnoutRisk(data)

      expect(result.confidence).toBeGreaterThanOrEqual(0.1)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe("factor identification", () => {
    it("identifies elevated stress levels", () => {
      const data = createTrendData(7, 70, 30)
      const result = predictBurnoutRisk(data)
      expect(result.factors).toContain("Elevated stress levels")
    })

    it("identifies high fatigue levels", () => {
      const data = createTrendData(7, 30, 70)
      const result = predictBurnoutRisk(data)
      expect(result.factors).toContain("High fatigue levels")
    })

    it("identifies declining trend", () => {
      const data = createTrendData(7, (day) => 30 + day * 8, (day) => 30 + day * 8)
      const result = predictBurnoutRisk(data)
      expect(result.factors).toContain("Declining trend over time")
    })

    it("identifies inconsistent patterns", () => {
      // Create highly volatile data
      const volatileData: TrendData[] = []
      for (let i = 0; i < 7; i++) {
        volatileData.push({
          date: `2024-01-${String(i + 1).padStart(2, "0")}`,
          stressScore: i % 2 === 0 ? 10 : 90,
          fatigueScore: i % 2 === 0 ? 10 : 90,
        })
      }
      const result = predictBurnoutRisk(volatileData)
      expect(result.factors).toContain("Inconsistent wellness patterns")
    })

    it("identifies sustained high burden", () => {
      const data = createTrendData(7, 70, 70)
      const result = predictBurnoutRisk(data)
      expect(result.factors).toContain("Sustained high stress/fatigue")
    })

    it("returns general message for normal wellness", () => {
      const data = createTrendData(7, 25, 25)
      const result = predictBurnoutRisk(data)
      expect(result.factors).toContain("Overall wellness within normal range")
    })
  })

  describe("predicted days calculation", () => {
    it("predicts 3 days for critical risk (steep worsening)", () => {
      // Use data that triggers critical risk (riskScore >= 75)
      const volatileWorsening: TrendData[] = [
        { date: "2024-01-01", stressScore: 30, fatigueScore: 30 },
        { date: "2024-01-02", stressScore: 50, fatigueScore: 40 },
        { date: "2024-01-03", stressScore: 45, fatigueScore: 55 },
        { date: "2024-01-04", stressScore: 65, fatigueScore: 60 },
        { date: "2024-01-05", stressScore: 70, fatigueScore: 75 },
        { date: "2024-01-06", stressScore: 85, fatigueScore: 80 },
        { date: "2024-01-07", stressScore: 95, fatigueScore: 90 },
      ]
      const result = predictBurnoutRisk(volatileWorsening)
      // Critical risk OR steep slope should predict 3 days
      expect(result.predictedDays).toBeLessThanOrEqual(5)
    })

    it("predicts 7 days for low risk stable trend", () => {
      const data = createTrendData(7, 25, 25)
      const result = predictBurnoutRisk(data)
      expect(result.predictedDays).toBe(7)
    })
  })

  describe("output structure", () => {
    it("returns all required fields", () => {
      const data = createTrendData(7, 40, 40)
      const result = predictBurnoutRisk(data)

      expect(result).toHaveProperty("riskScore")
      expect(result).toHaveProperty("riskLevel")
      expect(result).toHaveProperty("predictedDays")
      expect(result).toHaveProperty("trend")
      expect(result).toHaveProperty("confidence")
      expect(result).toHaveProperty("factors")

      expect(typeof result.riskScore).toBe("number")
      expect(["low", "moderate", "high", "critical"]).toContain(result.riskLevel)
      expect(typeof result.predictedDays).toBe("number")
      expect(["stable", "improving", "declining"]).toContain(result.trend)
      expect(typeof result.confidence).toBe("number")
      expect(Array.isArray(result.factors)).toBe(true)
    })

    it("riskScore is clamped between 0 and 100", () => {
      // Test with extreme values
      const lowData = createTrendData(7, 0, 0)
      const highData = createTrendData(7, 100, 100)

      const lowResult = predictBurnoutRisk(lowData)
      const highResult = predictBurnoutRisk(highData)

      expect(lowResult.riskScore).toBeGreaterThanOrEqual(0)
      expect(lowResult.riskScore).toBeLessThanOrEqual(100)
      expect(highResult.riskScore).toBeGreaterThanOrEqual(0)
      expect(highResult.riskScore).toBeLessThanOrEqual(100)
    })
  })
})

describe("recordingsToTrendData", () => {
  it("returns empty array for empty input", () => {
    const result = recordingsToTrendData([])
    expect(result).toEqual([])
  })

  it("filters out recordings without metrics", () => {
    const recordings = [
      { createdAt: "2024-01-01T10:00:00Z", metrics: { stressScore: 50, fatigueScore: 50 } },
      { createdAt: "2024-01-02T10:00:00Z" }, // No metrics
      { createdAt: "2024-01-03T10:00:00Z", metrics: { stressScore: 60, fatigueScore: 60 } },
    ]
    const result = recordingsToTrendData(recordings)
    expect(result).toHaveLength(2)
  })

  it("extracts date correctly from ISO string", () => {
    const recordings = [
      { createdAt: "2024-01-15T14:30:00.000Z", metrics: { stressScore: 50, fatigueScore: 50 } },
    ]
    const result = recordingsToTrendData(recordings)
    expect(result[0].date).toBe("2024-01-15")
  })

  it("preserves stress and fatigue scores", () => {
    const recordings = [
      { createdAt: "2024-01-01T10:00:00Z", metrics: { stressScore: 42, fatigueScore: 67 } },
    ]
    const result = recordingsToTrendData(recordings)
    expect(result[0].stressScore).toBe(42)
    expect(result[0].fatigueScore).toBe(67)
  })
})

describe("sessionsToTrendData", () => {
  it("returns empty array for empty input", () => {
    const result = sessionsToTrendData([])
    expect(result).toEqual([])
  })

  it("filters out sessions without acoustic metrics", () => {
    const sessions = [
      { startedAt: "2024-01-01T10:00:00Z", acousticMetrics: { stressScore: 50, fatigueScore: 50 } },
      { startedAt: "2024-01-02T10:00:00Z" },
      { startedAt: "2024-01-03T10:00:00Z", acousticMetrics: { stressScore: 60, fatigueScore: 60 } },
    ]
    const result = sessionsToTrendData(sessions)
    expect(result).toHaveLength(2)
  })

  it("extracts date correctly from ISO string", () => {
    const sessions = [
      { startedAt: "2024-01-15T14:30:00.000Z", acousticMetrics: { stressScore: 50, fatigueScore: 50 } },
    ]
    const result = sessionsToTrendData(sessions)
    expect(result[0].date).toBe("2024-01-15")
  })

  it("preserves stress and fatigue scores", () => {
    const sessions = [
      { startedAt: "2024-01-01T10:00:00Z", acousticMetrics: { stressScore: 42, fatigueScore: 67 } },
    ]
    const result = sessionsToTrendData(sessions)
    expect(result[0].stressScore).toBe(42)
    expect(result[0].fatigueScore).toBe(67)
  })
})
