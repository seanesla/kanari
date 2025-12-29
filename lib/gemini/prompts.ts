import type { StressLevel, FatigueLevel, TrendDirection, EnrichedWellnessContext } from "@/lib/types"

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
  // Enriched context (optional - only present when historical data available)
  voicePatterns?: VoicePatterns
  history?: HistoricalContext
  burnout?: BurnoutPrediction
  confidence?: number
}

/**
 * Gemini 3 Constitution - Core principles for wellness coaching
 */
export const GEMINI_CONSTITUTION = `
You are a wellness coach assistant in the Kanari app. Follow these principles:

1. OFFER, DON'T PRESCRIBE
   - Use "You might try..." not "You must..."
   - User always has agency over their choices
   - Frame suggestions as options, not commands

2. CONTEXT-AWARE TIMING
   - Consider time of day when suggesting activities
   - No outdoor activities late at night
   - No naps during typical work hours (9am-5pm)
   - Adjust suggestions based on the day (weekday vs weekend)

3. ALWAYS EXPLAIN RATIONALE
   - Every suggestion must include WHY it was recommended
   - Connect the suggestion to the detected voice patterns
   - Example: "Your speech rate was faster than usual, which often indicates stress. A breathing exercise might help..."

4. RESPECT USER AUTONOMY
   - Never guilt or shame
   - Acknowledge that voice analysis has limitations
   - Be supportive, not judgmental
`

/**
 * System prompt that establishes Gemini's role and context
 */
export const SYSTEM_PROMPT = `You are a wellness assistant for kanari, an early warning system for burnout. Your role is to generate personalized recovery suggestions based on voice biomarker analysis.

${GEMINI_CONSTITUTION}

IMPORTANT CONTEXT:
- kanari analyzes voice recordings for stress and fatigue biomarkers (speech rate, volume, pauses, spectral features)
- All audio processing happens client-side in the browser
- You receive ONLY numerical scores and categorical levels—NEVER audio or transcripts
- Your suggestions help users prevent burnout by scheduling proactive recovery time

ENRICHED CONTEXT YOU RECEIVE:
- Voice patterns: Qualitative descriptors (speech rate, energy level, pause frequency, voice tone)
- Historical data: User's baseline trends and changes over time
- Burnout prediction: Risk level and contributing factors when elevated
- Data confidence: Quality indicator for the analysis

HOW TO USE ENRICHED CONTEXT:
- Reference voice patterns in your rationale (e.g., "Your speech was faster than usual...")
- Compare current state to user's baseline when historical data is available
- Mention burnout risk when it's moderate or higher, framing it as preventive
- Be transparent about data confidence (acknowledge limitations when confidence is low)

RESPONSE FORMAT:
You must respond with a JSON array of 2-3 suggestion objects. Each suggestion must have:
- "content": A clear, actionable suggestion (30-50 words)
- "rationale": Brief explanation of why this helps, referencing voice patterns and context (20-40 words)
- "duration": Estimated time in minutes (5-60)
- "category": One of: "break", "exercise", "mindfulness", "social", "rest"

SUGGESTION GUIDELINES:
1. Be specific and actionable (not vague like "take care of yourself")
2. Consider time of day and day of week for practical suggestions
3. Match intensity to severity (high stress/fatigue = more substantial interventions)
4. Prioritize evidence-based interventions (deep breathing, movement, social connection, rest)
5. Keep tone supportive but not patronizing
6. Avoid medical advice or diagnosis
7. Ground rationale in observed voice patterns and historical trends

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
 * Generate user prompt with wellness data (legacy version)
 */
export function generateUserPrompt(context: WellnessContext): string {
  const { stressScore, stressLevel, fatigueScore, fatigueLevel, trend, timeOfDay, dayOfWeek, voicePatterns, history, burnout, confidence } = context

  let prompt = `Generate 2-3 personalized recovery suggestions based on this wellness data:

CURRENT STATE:
- Stress Score: ${stressScore}/100 (${stressLevel})
- Fatigue Score: ${fatigueScore}/100 (${fatigueLevel})
- Trend: ${trend}`

  // Add voice patterns if available
  if (voicePatterns) {
    prompt += `\n- Voice Patterns: speech ${voicePatterns.speechRate}, energy ${voicePatterns.energyLevel}, pauses ${voicePatterns.pauseFrequency}, tone ${voicePatterns.voiceTone}`
  }

  // Add confidence if available
  if (confidence !== undefined) {
    prompt += `\n- Analysis Confidence: ${Math.round(confidence * 100)}%`
  }

  prompt += `\n\nCONTEXT:
- Time of day: ${timeOfDay}
- Day: ${dayOfWeek}`

  // Add historical context if available
  if (history) {
    prompt += `\n\nHISTORICAL DATA (${history.daysOfData} days, ${history.recordingCount} recordings):
- Average Stress: ${history.averageStress}/100
- Average Fatigue: ${history.averageFatigue}/100
- Stress Change: ${history.stressChange}
- Fatigue Change: ${history.fatigueChange}`
  }

  // Add burnout prediction if available
  if (burnout) {
    prompt += `\n\nBURNOUT PREDICTION:
- Risk Level: ${burnout.riskLevel} (${burnout.riskScore}/100)
- Predicted Days: ${burnout.predictedDays} days
- Contributing Factors: ${burnout.factors.join(", ")}`
  }

  prompt += `\n\nProvide practical, actionable suggestions that fit this person's current state and schedule. Return ONLY the JSON array, no additional text.`

  return prompt
}

/**
 * Generate enriched user prompt with comprehensive wellness data
 */
export function generateEnrichedUserPrompt(context: EnrichedWellnessContext): string {
  const {
    stressScore,
    stressLevel,
    fatigueScore,
    fatigueLevel,
    trend,
    timeOfDay,
    dayOfWeek,
    voicePatterns,
    history,
    burnout,
    confidence,
  } = context

  let prompt = `Generate 2-3 personalized recovery suggestions based on this wellness data:

CURRENT STATE:
- Stress Score: ${stressScore}/100 (${stressLevel})
- Fatigue Score: ${fatigueScore}/100 (${fatigueLevel})
- Trend: ${trend}

VOICE PATTERNS:
- Speech Rate: ${voicePatterns.speechRate}
- Energy Level: ${voicePatterns.energyLevel}
- Pause Frequency: ${voicePatterns.pauseFrequency}
- Voice Tone: ${voicePatterns.voiceTone}

CONTEXT:
- Time of day: ${timeOfDay}
- Day: ${dayOfWeek}
- Data Confidence: ${Math.round(confidence * 100)}%`

  // Add historical context if available
  if (history.recordingCount > 0) {
    prompt += `

HISTORICAL BASELINE (${history.daysOfData} days, ${history.recordingCount} recordings):
- Average Stress: ${history.averageStress}/100
- Average Fatigue: ${history.averageFatigue}/100
- Stress Change: ${history.stressChange}
- Fatigue Change: ${history.fatigueChange}`
  }

  // Add burnout prediction if risk is elevated
  if (burnout.riskLevel === "moderate" || burnout.riskLevel === "high" || burnout.riskLevel === "critical") {
    prompt += `

BURNOUT PREDICTION:
- Risk Level: ${burnout.riskLevel}
- Predicted Days: ${burnout.predictedDays}
- Contributing Factors: ${burnout.factors.join(", ")}`
  }

  prompt += `

Provide practical, actionable suggestions that fit this person's current state and schedule. Ground your rationale in the voice patterns and historical context provided. Return ONLY the JSON array, no additional text.`

  return prompt
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

/**
 * Gemini prompt for audio semantic analysis
 *
 * Analyzes WHAT is heard and HOW it sounds—NOT numerical acoustic measurements.
 * Focuses on semantic content, emotion, and qualitative delivery patterns.
 */
export const AUDIO_SEMANTIC_PROMPT = `You are analyzing a voice recording to detect emotional state and semantic indicators of stress and fatigue.

CRITICAL INSTRUCTIONS - DO NOT:
❌ Measure exact speech rate in syllables/second
❌ Report numerical acoustic values (RMS, frequency, spectral features, etc.)
❌ Provide precise pause durations in milliseconds
❌ Extract MFCCs or technical audio features

FOCUS ON - WHAT YOU HEAR AND HOW IT SOUNDS:
✓ Transcribe the content with timestamps
✓ Detect emotional tone (happy, sad, angry, neutral)
✓ Note semantic stress cues: rushed delivery, hesitations, sentence restarts, tense tone, anxious content
✓ Note semantic fatigue cues: sluggish delivery, monotone, trailing off, expressions of tiredness
✓ Provide qualitative interpretation of stress and fatigue

YOUR TASK:

1. TRANSCRIBE with timestamps (MM:SS format)
   - Break into logical segments (every 5-15 seconds)
   - Include timestamp, transcribed text, and detected emotion for each segment

2. IDENTIFY OBSERVATIONS
   - stress_cue: Rushed speech, hesitations, restarts, tense/pressured tone, anxious content
   - fatigue_cue: Sluggish delivery, monotone, trailing off, low energy, tiredness expressions
   - positive_cue: Upbeat tone, enthusiastic delivery, positive content
   - Mark relevance as high/medium/low

3. INTERPRET QUALITATIVELY
   - Stress: Does the speaker sound pressured, rushed, anxious, or tense? Why?
   - Fatigue: Does the speaker sound tired, low-energy, monotone, or sluggish? Why?

4. SUMMARIZE overall emotional state and delivery

RESPONSE FORMAT:
Return a JSON object with this exact structure (do not add extra fields):
{
  "segments": [
    {
      "timestamp": "00:05",
      "content": "transcribed text here",
      "emotion": "happy" | "sad" | "angry" | "neutral"
    }
  ],
  "overallEmotion": "happy" | "sad" | "angry" | "neutral",
  "emotionConfidence": 0.0-1.0,
  "observations": [
    {
      "type": "stress_cue" | "fatigue_cue" | "positive_cue",
      "observation": "description of what you noticed",
      "relevance": "high" | "medium" | "low"
    }
  ],
  "stressInterpretation": "qualitative description of stress indicators",
  "fatigueInterpretation": "qualitative description of fatigue indicators",
  "summary": "overall emotional state and delivery assessment"
}`

/**
 * JSON schema for Gemini audio semantic analysis response
 * Matches GeminiSemanticAnalysis type from lib/types.ts
 */
export const AUDIO_SEMANTIC_SCHEMA = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: {
            type: "string",
            description: "Timestamp in MM:SS format",
          },
          content: {
            type: "string",
            description: "Transcribed text",
          },
          emotion: {
            type: "string",
            enum: ["happy", "sad", "angry", "neutral"],
            description: "Detected emotion for this segment",
          },
        },
        required: ["timestamp", "content", "emotion"],
      },
    },
    overallEmotion: {
      type: "string",
      enum: ["happy", "sad", "angry", "neutral"],
      description: "Overall dominant emotion",
    },
    emotionConfidence: {
      type: "number",
      description: "Confidence in emotion detection (0-1)",
      minimum: 0,
      maximum: 1,
    },
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["stress_cue", "fatigue_cue", "positive_cue"],
            description: "Type of observation",
          },
          observation: {
            type: "string",
            description: "Description of what was noticed",
          },
          relevance: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Relevance level of this observation",
          },
        },
        required: ["type", "observation", "relevance"],
      },
    },
    stressInterpretation: {
      type: "string",
      description: "Qualitative interpretation of stress indicators",
    },
    fatigueInterpretation: {
      type: "string",
      description: "Qualitative interpretation of fatigue indicators",
    },
    summary: {
      type: "string",
      description: "Overall emotional state and delivery assessment",
    },
  },
  required: [
    "segments",
    "overallEmotion",
    "emotionConfidence",
    "observations",
    "stressInterpretation",
    "fatigueInterpretation",
    "summary",
  ],
}

// ============================================
// Diff-Aware Suggestion Generation
// ============================================

/**
 * System prompt for diff-aware suggestion generation.
 * Gemini reviews existing suggestions and decides to keep, update, or drop each one.
 */
export const DIFF_AWARE_SYSTEM_PROMPT = `You are a wellness assistant for kanari, an early warning system for burnout. Your role is to manage and refine recovery suggestions based on voice biomarker analysis.

${GEMINI_CONSTITUTION}

DIFF-AWARE SUGGESTION MANAGEMENT:

You will receive:
1. CURRENT WELLNESS DATA - Latest voice analysis results
2. EXISTING SUGGESTIONS - Active suggestions currently shown to the user
3. USER ACTION HISTORY - What the user has completed, dismissed, or scheduled
4. HISTORICAL CONTEXT - Trends and patterns over time

YOUR TASK:
Review each existing suggestion and decide whether to:
- KEEP: Suggestion is still relevant, no changes needed
- UPDATE: Suggestion needs modification (explain why in decisionReason)
- DROP: Suggestion is no longer relevant (explain why in decisionReason)

You may also ADD new suggestions if gaps exist.

DECISION GUIDELINES:

1. KEEP suggestions that:
   - Remain relevant to current stress/fatigue levels
   - Haven't been completed or dismissed
   - Are still practical for current time of day

2. UPDATE suggestions when:
   - Stress/fatigue levels have changed significantly
   - Time of day makes original timing impractical
   - User history suggests a different approach would be better
   - Duration needs adjustment based on current state

3. DROP suggestions when:
   - Similar suggestion was recently completed (avoid repetition)
   - User dismissed similar suggestions repeatedly (learn from dismissals)
   - Suggestion is outdated (was for morning, now evening)
   - Stress/fatigue improved significantly (reduce intervention intensity)

4. ADD new suggestions when:
   - Current state requires interventions not covered by existing suggestions
   - User history shows gaps in certain categories
   - Burnout risk requires additional interventions

LEARNING FROM USER ACTIONS:
- If user frequently completes "mindfulness" suggestions, lean into that category
- If user dismisses "exercise" suggestions, try lower-intensity alternatives
- If user schedules but doesn't complete, suggest shorter durations
- Respect patterns in user preferences

RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "suggestions": [
    {
      "id": "existing-id-or-new-uuid",
      "decision": "keep" | "update" | "drop" | "new",
      "content": "suggestion text (30-50 words)",
      "rationale": "why this helps (20-40 words)",
      "duration": 5-60,
      "category": "break" | "exercise" | "mindfulness" | "social" | "rest",
      "decisionReason": "why this decision was made (required for update/drop)",
      "updateSummary": "what changed (only for update)"
    }
  ],
  "summary": {
    "kept": 0,
    "updated": 0,
    "dropped": 0,
    "added": 0
  }
}

IMPORTANT:
- Return ALL existing suggestions with a decision (keep/update/drop)
- Include 1-3 new suggestions if current coverage is insufficient
- Maximum total of 5 active suggestions to avoid overwhelming the user
- Ground all decisions in observable data (voice patterns, history, actions)
- For "new" suggestions, generate a UUID for the id field`

/**
 * JSON schema for diff-aware suggestion response.
 * Enforces structured output from Gemini.
 */
export const DIFF_AWARE_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Existing suggestion ID or new UUID",
          },
          decision: {
            type: "string",
            enum: ["keep", "update", "drop", "new"],
            description: "Decision for this suggestion",
          },
          content: {
            type: "string",
            description: "Clear, actionable suggestion (30-50 words)",
          },
          rationale: {
            type: "string",
            description: "Why this helps (20-40 words)",
          },
          duration: {
            type: "number",
            description: "Estimated time in minutes (5-60)",
            minimum: 5,
            maximum: 60,
          },
          category: {
            type: "string",
            enum: ["break", "exercise", "mindfulness", "social", "rest"],
            description: "Suggestion category",
          },
          decisionReason: {
            type: "string",
            description: "Why this decision was made (required for update/drop)",
          },
          updateSummary: {
            type: "string",
            description: "What changed (only for update)",
          },
        },
        required: ["id", "decision", "content", "rationale", "duration", "category"],
      },
    },
    summary: {
      type: "object",
      properties: {
        kept: {
          type: "number",
          description: "Number of suggestions kept unchanged",
        },
        updated: {
          type: "number",
          description: "Number of suggestions updated",
        },
        dropped: {
          type: "number",
          description: "Number of suggestions dropped",
        },
        added: {
          type: "number",
          description: "Number of new suggestions added",
        },
      },
      required: ["kept", "updated", "dropped", "added"],
    },
  },
  required: ["suggestions", "summary"],
}

/**
 * Generate user prompt for diff-aware suggestion generation.
 * Includes wellness context, existing suggestions, and user action history.
 */
export function generateDiffAwareUserPrompt(
  context: EnrichedWellnessContext,
  existingSuggestions: Suggestion[],
  memoryContext: GeminiMemoryContext
): string {
  let prompt = `Review and update recovery suggestions based on this wellness data:

CURRENT STATE:
- Stress Score: ${context.stressScore}/100 (${context.stressLevel})
- Fatigue Score: ${context.fatigueScore}/100 (${context.fatigueLevel})
- Trend: ${context.trend}
- Time: ${context.timeOfDay} on a ${context.dayOfWeek}

VOICE PATTERNS:
- Speech Rate: ${context.voicePatterns.speechRate}
- Energy Level: ${context.voicePatterns.energyLevel}
- Pause Frequency: ${context.voicePatterns.pauseFrequency}
- Voice Tone: ${context.voicePatterns.voiceTone}

Data Confidence: ${Math.round(context.confidence * 100)}%`

  // Add historical context if available
  if (context.history.recordingCount > 0) {
    prompt += `

HISTORICAL BASELINE (${context.history.daysOfData} days, ${context.history.recordingCount} recordings):
- Average Stress: ${context.history.averageStress}/100
- Average Fatigue: ${context.history.averageFatigue}/100
- Stress Change: ${context.history.stressChange}
- Fatigue Change: ${context.history.fatigueChange}`
  }

  // Add burnout prediction if risk is elevated
  if (context.burnout.riskLevel !== "low") {
    prompt += `

BURNOUT PREDICTION:
- Risk Level: ${context.burnout.riskLevel}
- Predicted Days: ${context.burnout.predictedDays}
- Contributing Factors: ${context.burnout.factors.join(", ")}`
  }

  // Add existing suggestions to review
  if (existingSuggestions.length > 0) {
    prompt += `

EXISTING SUGGESTIONS TO REVIEW:
${existingSuggestions
  .map(
    (s, i) => `
${i + 1}. ID: ${s.id}
   Status: ${s.status}
   Category: ${s.category}
   Duration: ${s.duration} min
   Content: ${s.content}
   Rationale: ${s.rationale}${s.scheduledFor ? `\n   Scheduled for: ${s.scheduledFor}` : ""}`
  )
  .join("")}`
  } else {
    prompt += `

NO EXISTING SUGGESTIONS - Generate 2-3 new suggestions.`
  }

  // Add memory context (user action history)
  if (memoryContext.completed.length > 0 || memoryContext.dismissed.length > 0) {
    prompt += `

USER ACTION HISTORY:`

    if (memoryContext.completed.length > 0) {
      prompt += `
Recently Completed (${memoryContext.stats.totalCompleted} total):
${memoryContext.completed
  .slice(0, 5)
  .map((c) => `- [${c.category}] ${c.content}`)
  .join("\n")}`
    }

    if (memoryContext.dismissed.length > 0) {
      prompt += `
Recently Dismissed (${memoryContext.stats.totalDismissed} total):
${memoryContext.dismissed
  .slice(0, 5)
  .map((d) => `- [${d.category}] ${d.content}`)
  .join("\n")}`
    }

    if (memoryContext.stats.mostUsedCategory) {
      prompt += `
Preferred Category: ${memoryContext.stats.mostUsedCategory}`
    }

    if (memoryContext.stats.averageCompletionRate > 0) {
      prompt += `
Completion Rate: ${memoryContext.stats.averageCompletionRate}%`
    }
  }

  prompt += `

Provide your diff-aware response with decisions for each existing suggestion and any new suggestions needed.`

  return prompt
}
