/**
 * Simple statistical utilities shared across the app.
 *
 * Note: Keep behavior consistent with existing callers (e.g., slope/stddev return 0 for small samples).
 */

/**
 * Calculate arithmetic mean.
 */
export function calculateAverage(data: number[]): number {
  if (data.length === 0) return 0
  return data.reduce((sum, val) => sum + val, 0) / data.length
}

/**
 * Calculate linear regression slope for trend direction.
 */
export function calculateSlope(data: number[]): number {
  const n = data.length
  if (n < 2) return 0

  const xMean = (n - 1) / 2
  const yMean = calculateAverage(data)

  let numerator = 0
  let denominator = 0

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (data[i] - yMean)
    denominator += (i - xMean) ** 2
  }

  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * Calculate standard deviation (measure of volatility).
 */
export function calculateStdDev(data: number[]): number {
  if (data.length < 2) return 0

  const mean = calculateAverage(data)
  const squaredDiffs = data.map((val) => (val - mean) ** 2)
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length

  return Math.sqrt(variance)
}
