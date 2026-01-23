/**
 * ML Thresholds and Constants
 *
 * Centralized configuration for all heuristic-based voice analysis thresholds.
 * These values are derived from voice biomarker research and tuned for the app.
 *
 * Reference: Research basis documented in inference.ts header comments
 */

// ============================================
// Stress Detection Thresholds
// ============================================

export const STRESS = {
  /**
   * Speech rate thresholds (syllables/second)
   * Normal: 3-5 syl/s, Stressed: >5.5 syl/s
   */
  SPEECH_RATE_HIGH: 5.5,
  SPEECH_RATE_MODERATE: 4.5,

  /**
   * RMS energy thresholds (0-1 normalized)
   * Higher RMS = louder/more intense = stress indicator
   */
  RMS_HIGH: 0.3,
  RMS_MODERATE: 0.2,

  /**
   * Spectral flux thresholds (0-1 normalized)
   * Higher flux = more dynamic/agitated speech
   */
  SPECTRAL_FLUX_HIGH: 0.15,
  SPECTRAL_FLUX_MODERATE: 0.1,

  /**
   * Zero-crossing rate thresholds (0-1 normalized)
   * Higher ZCR = more tension in voice
   */
  ZCR_HIGH: 0.08,
  ZCR_MODERATE: 0.05,
} as const

// ============================================
// Fatigue Detection Thresholds
// ============================================

export const FATIGUE = {
  /**
   * Speech rate thresholds (syllables/second)
   * Fatigued people speak slower: <3 syl/s indicates fatigue
   */
  SPEECH_RATE_LOW: 3.0,
  SPEECH_RATE_MODERATE: 3.5,

  /**
   * RMS energy thresholds (0-1 normalized)
   * Lower RMS = softer voice = fatigue indicator
   */
  RMS_LOW: 0.1,
  RMS_MODERATE: 0.15,

  /**
   * Pause ratio thresholds (0-1)
   * Higher pause ratio = more pauses = fatigue indicator
   */
  PAUSE_RATIO_HIGH: 0.4,
  PAUSE_RATIO_MODERATE: 0.3,

  /**
   * Spectral centroid thresholds (0-1 normalized)
   * Lower centroid = less bright voice = fatigue indicator
   */
  SPECTRAL_CENTROID_LOW: 0.3,
  SPECTRAL_CENTROID_MODERATE: 0.45,
} as const

// ============================================
// Score Level Thresholds
// ============================================

export const SCORE_LEVELS = {
  /** Score >= 70 = high/exhausted */
  HIGH: 70,
  /** Score >= 50 = elevated/tired */
  ELEVATED: 50,
  /** Score >= 30 = moderate/normal */
  MODERATE: 30,
  // Below 30 = low/rested
} as const

// ============================================
// Confidence Calculation
// ============================================

export const CONFIDENCE = {
  /** Base confidence for any analysis */
  BASE: 0.7,

  /** Pause count thresholds for confidence adjustment */
  PAUSE_COUNT_HIGH: 10,
  PAUSE_COUNT_MODERATE: 5,
  PAUSE_COUNT_LOW: 3,

  /** Confidence adjustments */
  BOOST_HIGH: 0.15,
  BOOST_MODERATE: 0.1,
  PENALTY_LOW_DATA: -0.1,
  PENALTY_POOR_AUDIO: -0.2,

  /** RMS thresholds for audio quality */
  RMS_POOR_QUALITY: 0.05,
  RMS_GOOD_QUALITY: 0.15,
} as const

// ============================================
// Burnout Risk Forecasting
// ============================================

export const FORECASTING = {
  /** Slope thresholds for trend direction */
  SLOPE_DECLINING: 2, // Positive slope = worsening
  SLOPE_IMPROVING: -2, // Negative slope = improving

  /** Risk level score thresholds */
  RISK_CRITICAL: 75,
  RISK_HIGH: 55,
  RISK_MODERATE: 35,

  /** Days prediction thresholds based on risk/slope */
  DAYS_RAPID_DECLINE: 3,
  DAYS_MODERATE_DECLINE: 5,
  DAYS_SLOW_DECLINE: 7,

  /** Slope thresholds for days estimation */
  SLOPE_RAPID: 5,
  SLOPE_MODERATE: 2,

  /** Factor thresholds */
  STRESS_ELEVATED: 60,
  FATIGUE_ELEVATED: 60,
  VOLATILITY_HIGH: 15,
  BURDEN_HIGH: 65,
  RECENT_VS_OVERALL_DIFF: 10,

  /** Data availability thresholds */
  DATA_POINTS_HIGH: 14,
  DATA_POINTS_MODERATE: 7,
  DATA_POINTS_LOW: 3,

  /** Volatility thresholds for confidence */
  VOLATILITY_LOW: 10,
  VOLATILITY_CONCERNING: 20,

  /** Confidence adjustments for forecasting */
  CONFIDENCE_BASE: 0.5,
  CONFIDENCE_BOOST_HIGH_DATA: 0.3,
  CONFIDENCE_BOOST_MODERATE_DATA: 0.2,
  CONFIDENCE_BOOST_LOW_DATA: 0.1,
  CONFIDENCE_PENALTY_MINIMAL_DATA: -0.2,
  CONFIDENCE_BOOST_LOW_VOLATILITY: 0.15,
  CONFIDENCE_PENALTY_HIGH_VOLATILITY: -0.1,
  CONFIDENCE_BOOST_STRONG_TREND: 0.05,
} as const

// ============================================
// Scoring Weights (for stress/fatigue calculation)
// ============================================

export const SCORING_WEIGHTS = {
  /** Feature contribution weights */
  SPEECH_RATE: 30,
  RMS_ENERGY: 25,
  SPECTRAL_FLUX: 25,
  ZCR: 20,
  PAUSE_RATIO: 25,
  SPECTRAL_CENTROID: 20,

  /** Points for high/moderate indicators */
  HIGH_INDICATOR: 30,
  MODERATE_INDICATOR: 15,
  HIGH_SECONDARY: 25,
  MODERATE_SECONDARY: 12,
  HIGH_TERTIARY: 20,
  MODERATE_TERTIARY: 10,
} as const

// ============================================
// Risk Calculation Weights (for burnout forecasting)
// ============================================

export const RISK_WEIGHTS = {
  /** Weight for recent average in risk score */
  RECENT_AVERAGE: 0.4,
  /** Max points from upward trend */
  UPWARD_TREND_MAX: 30,
  /** Max points from volatility */
  VOLATILITY_MAX: 20,
  /** Points when recent is worse than overall */
  RECENT_WORSE: 10,
} as const

/** @deprecated Use SCORING_WEIGHTS and RISK_WEIGHTS instead */
export const WEIGHTS = {
  ...SCORING_WEIGHTS,
  RISK_RECENT_AVERAGE: RISK_WEIGHTS.RECENT_AVERAGE,
  RISK_UPWARD_TREND_MAX: RISK_WEIGHTS.UPWARD_TREND_MAX,
  RISK_VOLATILITY_MAX: RISK_WEIGHTS.VOLATILITY_MAX,
  RISK_RECENT_WORSE: RISK_WEIGHTS.RECENT_WORSE,
} as const

// ============================================
// Validation Ranges
// ============================================

export const VALIDATION = {
  /** Reasonable ranges for feature validation */
  RMS_MIN: 0,
  RMS_MAX: 1,
  SPEECH_RATE_MIN: 0,
  SPEECH_RATE_MAX: 20,
  PAUSE_RATIO_MIN: 0,
  PAUSE_RATIO_MAX: 1,
  ZCR_MIN: 0,
  ZCR_MAX: 1,

  /** Minimum pause count for valid analysis */
  MIN_PAUSE_COUNT: 2,

  /** Minimum detected speech duration (seconds) before showing biomarkers */
  MIN_SPEECH_SECONDS: 1,
} as const
