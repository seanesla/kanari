import type { StressLevel, FatigueLevel, TrendDirection } from "@/lib/types"

/**
 * Gemini prompt templates for generating personalized recovery suggestions
 *
 * Privacy-first approach: Only sends numerical scores and categorical levels,
 * NEVER audio data or transcripts.
 */

export interface WellnessContext {
  stressScore: number
  stressLevel: StressLevel
  fatigueScore: number
  fatigueLevel: FatigueLevel
  trend: TrendDirection
  timeOfDay: "morning" | "afternoon" | "evening" | "night"
  dayOfWeek: "weekday" | "weekend"
}

/**
 * System prompt that establishes Gemini's role and context
 */
export const SYSTEM_PROMPT = `You are a wellness assistant for kanari, an early warning system for burnout. Your role is to generate personalized recovery suggestions based on voice biomarker analysis.

IMPORTANT CONTEXT:
- kanari analyzes voice recordings for stress and fatigue biomarkers (speech rate, volume, pauses, spectral features)
- All audio processing happens client-side in the browser
- You receive ONLY numerical scores and categorical levels—NEVER audio or transcripts
- Your suggestions help users prevent burnout by scheduling proactive recovery time

RESPONSE FORMAT:
You must respond with a JSON array of 2-3 suggestion objects. Each suggestion must have:
- "content": A clear, actionable suggestion (30-50 words)
- "rationale": Brief explanation of why this helps (20-40 words)
- "duration": Estimated time in minutes (5-60)
- "category": One of: "break", "exercise", "mindfulness", "social", "rest"

SUGGESTION GUIDELINES:
1. Be specific and actionable (not vague like "take care of yourself")
2. Consider time of day and day of week for practical suggestions
3. Match intensity to severity (high stress/fatigue = more substantial interventions)
4. Prioritize evidence-based interventions (deep breathing, movement, social connection, rest)
5. Keep tone supportive but not patronizing
6. Avoid medical advice or diagnosis

EXAMPLE OUTPUT:
[
  {
    "content": "Take a 15-minute walk outside to reset your nervous system. Focus on your surroundings rather than work thoughts.",
    "rationale": "Physical movement and nature exposure reduce cortisol levels and improve mood regulation.",
    "duration": 15,
    "category": "exercise"
  },
  {
    "content": "Practice 4-7-8 breathing for 5 minutes: inhale for 4 counts, hold for 7, exhale for 8. Repeat 5 times.",
    "rationale": "Extended exhales activate the parasympathetic nervous system, counteracting stress response.",
    "duration": 5,
    "category": "mindfulness"
  }
]`

/**
 * Generate user prompt with wellness data
 */
export function generateUserPrompt(context: WellnessContext): string {
  const { stressScore, stressLevel, fatigueScore, fatigueLevel, trend, timeOfDay, dayOfWeek } = context

  return `Generate 2-3 personalized recovery suggestions based on this wellness data:

CURRENT STATE:
- Stress Score: ${stressScore}/100 (${stressLevel})
- Fatigue Score: ${fatigueScore}/100 (${fatigueLevel})
- Trend: ${trend}

CONTEXT:
- Time of day: ${timeOfDay}
- Day: ${dayOfWeek}

Provide practical, actionable suggestions that fit this person's current state and schedule. Return ONLY the JSON array, no additional text.`
}

/**
 * Helper to determine time of day from current hour
 */
export function getTimeOfDay(hour: number): WellnessContext["timeOfDay"] {
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  if (hour >= 17 && hour < 22) return "evening"
  return "night"
}

/**
 * Helper to determine if current day is weekday or weekend
 */
export function getDayType(dayOfWeek: number): WellnessContext["dayOfWeek"] {
  // dayOfWeek: 0 = Sunday, 6 = Saturday
  return dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday"
}

/**
 * Build complete wellness context from current data
 */
export function buildWellnessContext(
  stressScore: number,
  stressLevel: StressLevel,
  fatigueScore: number,
  fatigueLevel: FatigueLevel,
  trend: TrendDirection
): WellnessContext {
  const now = new Date()

  return {
    stressScore,
    stressLevel,
    fatigueScore,
    fatigueLevel,
    trend,
    timeOfDay: getTimeOfDay(now.getHours()),
    dayOfWeek: getDayType(now.getDay()),
  }
}
