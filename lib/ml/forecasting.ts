import type { TrendData, BurnoutPrediction, TrendDirection } from "@/lib/types"
import { calculateAverage, calculateSlope, calculateStdDev } from "@/lib/math/statistics"
import { FORECASTING, RISK_WEIGHTS } from "./thresholds"

/**
 * Burnout prediction using trend analysis
 *
 * Analyzes historical stress/fatigue scores to predict burnout risk 3-7 days ahead.
 * Uses simple but effective trend analysis suitable for MVP.
 */

interface TrendAnalysis {
  slope: number // Rate of change (positive = worsening)
  volatility: number // How much scores fluctuate
  recentAverage: number // Average of last 3 days
  overallAverage: number // Average of all data
}

/**
 * Analyze stress/fatigue trends from historical data
 */
function analyzeTrend(trendData: TrendData[]): TrendAnalysis {
  // Combine stress and fatigue into a single "wellness burden" score
  const combinedScores = trendData.map((d) => (d.stressScore + d.fatigueScore) / 2)

  const slope = calculateSlope(combinedScores)
  const volatility = calculateStdDev(combinedScores)

  // Recent average (last 3 days or all if less)
  const recentCount = Math.min(3, combinedScores.length)
  const recentScores = combinedScores.slice(-recentCount)
  const recentAverage = calculateAverage(recentScores)

  // Overall average
  const overallAverage = calculateAverage(combinedScores)

  return { slope, volatility, recentAverage, overallAverage }
}

/**
 * Determine trend direction from slope
 */
function getTrendDirection(slope: number): TrendDirection {
  if (slope > FORECASTING.SLOPE_DECLINING) return "declining" // Getting worse
  if (slope < FORECASTING.SLOPE_IMPROVING) return "improving" // Getting better
  return "stable"
}

/**
 * Calculate burnout risk score (0-100)
 */
function calculateRiskScore(analysis: TrendAnalysis): number {
  let risk = 0

  // Factor 1: Recent average score (40% weight)
  risk += analysis.recentAverage * RISK_WEIGHTS.RECENT_AVERAGE

  // Factor 2: Upward trend (30% weight)
  // Positive slope means worsening condition
  if (analysis.slope > 0) {
    risk += Math.min(analysis.slope * 3, RISK_WEIGHTS.UPWARD_TREND_MAX)
  }

  // Factor 3: High volatility (20% weight)
  // Unstable patterns suggest poor regulation
  risk += Math.min(analysis.volatility * 0.3, RISK_WEIGHTS.VOLATILITY_MAX)

  // Factor 4: Recent vs overall comparison (10% weight)
  // Recent significantly worse than historical average = risk
  if (analysis.recentAverage > analysis.overallAverage + FORECASTING.RECENT_VS_OVERALL_DIFF) {
    risk += RISK_WEIGHTS.RECENT_WORSE
  }

  return Math.min(100, Math.max(0, Math.round(risk)))
}

/**
 * Map risk score to categorical level
 */
function scoreToRiskLevel(score: number): BurnoutPrediction["riskLevel"] {
  if (score >= FORECASTING.RISK_CRITICAL) return "critical"
  if (score >= FORECASTING.RISK_HIGH) return "high"
  if (score >= FORECASTING.RISK_MODERATE) return "moderate"
  return "low"
}

/**
 * Estimate days until potential burnout based on trend
 */
function estimateDaysUntilBurnout(analysis: TrendAnalysis, riskScore: number): number {
  // If already at high risk, predict sooner
  if (riskScore >= FORECASTING.RISK_CRITICAL) return FORECASTING.DAYS_RAPID_DECLINE

  // Use slope to estimate trajectory
  if (analysis.slope > FORECASTING.SLOPE_RAPID) return FORECASTING.DAYS_RAPID_DECLINE
  if (analysis.slope > FORECASTING.SLOPE_MODERATE) return FORECASTING.DAYS_MODERATE_DECLINE
  if (analysis.slope > 0) return FORECASTING.DAYS_SLOW_DECLINE

  // Stable or improving
  return FORECASTING.DAYS_SLOW_DECLINE
}

/**
 * Identify contributing factors based on analysis
 */
function identifyFactors(analysis: TrendAnalysis, trendData: TrendData[]): string[] {
  const factors: string[] = []

  // Recent stress levels
  const recentStress = trendData.slice(-3).reduce((sum, d) => sum + d.stressScore, 0) / 3
  if (recentStress > FORECASTING.STRESS_ELEVATED) {
    factors.push("Elevated stress levels")
  }

  // Recent fatigue levels
  const recentFatigue = trendData.slice(-3).reduce((sum, d) => sum + d.fatigueScore, 0) / 3
  if (recentFatigue > FORECASTING.FATIGUE_ELEVATED) {
    factors.push("High fatigue levels")
  }

  // Worsening trend
  if (analysis.slope > FORECASTING.SLOPE_DECLINING) {
    factors.push("Declining trend over time")
  }

  // High volatility
  if (analysis.volatility > FORECASTING.VOLATILITY_HIGH) {
    factors.push("Inconsistent wellness patterns")
  }

  // Sustained high burden
  if (analysis.recentAverage > FORECASTING.BURDEN_HIGH) {
    factors.push("Sustained high stress/fatigue")
  }

  // If no specific factors identified, provide general message
  if (factors.length === 0) {
    factors.push("Overall wellness within normal range")
  }

  return factors
}

/**
 * Calculate confidence based on data availability and consistency
 */
function calculateConfidence(trendData: TrendData[], analysis: TrendAnalysis): number {
  let confidence = FORECASTING.CONFIDENCE_BASE

  // More data points = higher confidence
  if (trendData.length >= FORECASTING.DATA_POINTS_HIGH) confidence += FORECASTING.CONFIDENCE_BOOST_HIGH_DATA
  else if (trendData.length >= FORECASTING.DATA_POINTS_MODERATE) confidence += FORECASTING.CONFIDENCE_BOOST_MODERATE_DATA
  else if (trendData.length >= FORECASTING.DATA_POINTS_LOW) confidence += FORECASTING.CONFIDENCE_BOOST_LOW_DATA
  else confidence += FORECASTING.CONFIDENCE_PENALTY_MINIMAL_DATA // Very little data

  // Lower volatility = more predictable = higher confidence
  if (analysis.volatility < FORECASTING.VOLATILITY_LOW) confidence += FORECASTING.CONFIDENCE_BOOST_LOW_VOLATILITY
  else if (analysis.volatility > FORECASTING.VOLATILITY_CONCERNING) confidence += FORECASTING.CONFIDENCE_PENALTY_HIGH_VOLATILITY

  // Strong trend (either direction) = higher confidence
  if (Math.abs(analysis.slope) > 3) confidence += FORECASTING.CONFIDENCE_BOOST_STRONG_TREND

  return Math.max(0.1, Math.min(1, confidence))
}

/**
 * Main forecasting function
 * Predicts burnout risk 3-7 days ahead based on historical trends
 *
 * @param trendData - Array of historical stress/fatigue scores (ideally 7-14 days)
 * @returns BurnoutPrediction object with risk assessment
 */
export function predictBurnoutRisk(trendData: TrendData[]): BurnoutPrediction {
  // Require minimum data for meaningful prediction
  if (trendData.length < 2) {
    return {
      riskScore: 0,
      riskLevel: "low",
      predictedDays: 7,
      trend: "stable",
      confidence: 0.1,
      factors: ["Insufficient data for prediction"],
    }
  }

  const analysis = analyzeTrend(trendData)
  const riskScore = calculateRiskScore(analysis)
  const riskLevel = scoreToRiskLevel(riskScore)
  const predictedDays = estimateDaysUntilBurnout(analysis, riskScore)
  const trend = getTrendDirection(analysis.slope)
  const confidence = calculateConfidence(trendData, analysis)
  const factors = identifyFactors(analysis, trendData)

  return {
    riskScore,
    riskLevel,
    predictedDays,
    trend,
    confidence,
    factors,
  }
}

/**
 * Helper to convert Recording[] to TrendData[]
 * Use this if you're storing full Recording objects
 */
export function recordingsToTrendData(recordings: Array<{
  createdAt: string
  metrics?: { stressScore: number; fatigueScore: number }
}>): TrendData[] {
  return recordings
    .filter((r) => r.metrics) // Only include recordings with metrics
    .map((r) => ({
      date: r.createdAt.split("T")[0], // Extract date (YYYY-MM-DD)
      stressScore: r.metrics!.stressScore,
      fatigueScore: r.metrics!.fatigueScore,
    }))
}

/**
 * Helper to convert CheckInSession[] to TrendData[]
 * Uses session-level acoustic metrics captured during AI chat.
 */
export function sessionsToTrendData(sessions: Array<{
  startedAt: string
  acousticMetrics?: { stressScore: number; fatigueScore: number }
}>): TrendData[] {
  return sessions
    .filter((s) => s.acousticMetrics)
    .map((s) => ({
      date: s.startedAt.split("T")[0],
      stressScore: s.acousticMetrics!.stressScore,
      fatigueScore: s.acousticMetrics!.fatigueScore,
    }))
}
