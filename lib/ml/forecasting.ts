import type { TrendData, BurnoutPrediction, TrendDirection } from "@/lib/types"

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
 * Calculate linear regression slope for trend direction
 */
function calculateSlope(data: number[]): number {
  const n = data.length
  if (n < 2) return 0

  const xMean = (n - 1) / 2
  const yMean = data.reduce((sum, val) => sum + val, 0) / n

  let numerator = 0
  let denominator = 0

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (data[i] - yMean)
    denominator += (i - xMean) ** 2
  }

  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * Calculate standard deviation (measure of volatility)
 */
function calculateStdDev(data: number[]): number {
  if (data.length < 2) return 0

  const mean = data.reduce((sum, val) => sum + val, 0) / data.length
  const squaredDiffs = data.map((val) => (val - mean) ** 2)
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length

  return Math.sqrt(variance)
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
  const recentAverage = recentScores.reduce((sum, val) => sum + val, 0) / recentCount

  // Overall average
  const overallAverage = combinedScores.reduce((sum, val) => sum + val, 0) / combinedScores.length

  return { slope, volatility, recentAverage, overallAverage }
}

/**
 * Determine trend direction from slope
 */
function getTrendDirection(slope: number): TrendDirection {
  if (slope > 2) return "declining" // Getting worse
  if (slope < -2) return "improving" // Getting better
  return "stable"
}

/**
 * Calculate burnout risk score (0-100)
 */
function calculateRiskScore(analysis: TrendAnalysis): number {
  let risk = 0

  // Factor 1: Recent average score (40% weight)
  risk += analysis.recentAverage * 0.4

  // Factor 2: Upward trend (30% weight)
  // Positive slope means worsening condition
  if (analysis.slope > 0) {
    risk += Math.min(analysis.slope * 3, 30)
  }

  // Factor 3: High volatility (20% weight)
  // Unstable patterns suggest poor regulation
  risk += Math.min(analysis.volatility * 0.3, 20)

  // Factor 4: Recent vs overall comparison (10% weight)
  // Recent significantly worse than historical average = risk
  if (analysis.recentAverage > analysis.overallAverage + 10) {
    risk += 10
  }

  return Math.min(100, Math.max(0, Math.round(risk)))
}

/**
 * Map risk score to categorical level
 */
function scoreToRiskLevel(score: number): BurnoutPrediction["riskLevel"] {
  if (score >= 75) return "critical"
  if (score >= 55) return "high"
  if (score >= 35) return "moderate"
  return "low"
}

/**
 * Estimate days until potential burnout based on trend
 */
function estimateDaysUntilBurnout(analysis: TrendAnalysis, riskScore: number): number {
  // If already at high risk, predict sooner
  if (riskScore >= 75) return 3

  // Use slope to estimate trajectory
  if (analysis.slope > 5) return 3 // Rapid decline
  if (analysis.slope > 2) return 5 // Moderate decline
  if (analysis.slope > 0) return 7 // Slow decline

  // Stable or improving
  return 7
}

/**
 * Identify contributing factors based on analysis
 */
function identifyFactors(analysis: TrendAnalysis, trendData: TrendData[]): string[] {
  const factors: string[] = []

  // Recent stress levels
  const recentStress = trendData.slice(-3).reduce((sum, d) => sum + d.stressScore, 0) / 3
  if (recentStress > 60) {
    factors.push("Elevated stress levels")
  }

  // Recent fatigue levels
  const recentFatigue = trendData.slice(-3).reduce((sum, d) => sum + d.fatigueScore, 0) / 3
  if (recentFatigue > 60) {
    factors.push("High fatigue levels")
  }

  // Worsening trend
  if (analysis.slope > 2) {
    factors.push("Declining trend over time")
  }

  // High volatility
  if (analysis.volatility > 15) {
    factors.push("Inconsistent wellness patterns")
  }

  // Sustained high burden
  if (analysis.recentAverage > 65) {
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
  let confidence = 0.5 // Base confidence

  // More data points = higher confidence
  if (trendData.length >= 14) confidence += 0.3
  else if (trendData.length >= 7) confidence += 0.2
  else if (trendData.length >= 3) confidence += 0.1
  else confidence -= 0.2 // Very little data

  // Lower volatility = more predictable = higher confidence
  if (analysis.volatility < 10) confidence += 0.15
  else if (analysis.volatility > 20) confidence -= 0.1

  // Strong trend (either direction) = higher confidence
  if (Math.abs(analysis.slope) > 3) confidence += 0.05

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
