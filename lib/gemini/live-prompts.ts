/**
 * System Prompts for Conversational Check-In
 *
 * These prompts configure Gemini's behavior during voice check-in conversations.
 * The focus is on warm, empathetic interaction that combines semantic understanding
 * with voice biomarker awareness.
 */

import type { MismatchResult, VoicePatterns, VoiceMetrics } from "@/lib/types"

// Allowed values for validation - prevents prompt injection
const VALID_ACOUSTIC_SIGNALS = ["stressed", "fatigued", "normal", "energetic"] as const
const VALID_SEMANTIC_SIGNALS = ["positive", "neutral", "negative"] as const

/**
 * Sanitize text to remove potential injection markers
 */
function sanitizeContextText(text: string): string {
  // Remove any context injection markers
  return text
    .replace(/\[CONTEXT/gi, "")
    .replace(/\[END/gi, "")
    .replace(/\[VOICE/gi, "")
    .replace(/\[CURRENT/gi, "")
    .replace(/\[RECORDING/gi, "")
    .replace(/\]/g, "")
    .trim()
}

/**
 * Validate and return safe acoustic signal
 */
function validateAcousticSignal(
  signal: string
): (typeof VALID_ACOUSTIC_SIGNALS)[number] {
  if (VALID_ACOUSTIC_SIGNALS.includes(signal as (typeof VALID_ACOUSTIC_SIGNALS)[number])) {
    return signal as (typeof VALID_ACOUSTIC_SIGNALS)[number]
  }
  return "normal" // Safe default
}

/**
 * Validate and return safe semantic signal
 */
function validateSemanticSignal(
  signal: string
): (typeof VALID_SEMANTIC_SIGNALS)[number] {
  if (VALID_SEMANTIC_SIGNALS.includes(signal as (typeof VALID_SEMANTIC_SIGNALS)[number])) {
    return signal as (typeof VALID_SEMANTIC_SIGNALS)[number]
  }
  return "neutral" // Safe default
}

/**
 * Main system prompt for conversational check-in
 *
 * Key principles:
 * 1. Warm, supportive, conversational tone
 * 2. Listen more than speak - ask open questions
 * 3. Pay attention to HOW they sound (voice biomarkers)
 * 4. Gently probe when mismatches detected
 * 5. Never diagnose or give medical advice
 * 6. Keep responses concise for natural flow
 */
export const CHECK_IN_SYSTEM_PROMPT = `You are Kanari, a warm and empathetic wellness companion. You're having a natural voice conversation to check in on how the user is feeling.

CORE PRINCIPLES:
1. Be warm, supportive, and conversational - like a caring friend checking in
2. Listen more than you speak - ask open questions, then let them talk
3. Pay attention to HOW they sound, not just WHAT they say
4. Gently probe when you notice mismatches between words and tone
5. Never diagnose or give medical advice - you're a supportive companion, not a therapist
6. Keep responses concise (1-2 sentences) to maintain natural conversational flow

VOICE PATTERN AWARENESS:
You may receive context about the user's voice biomarkers during the conversation. These are scientific indicators extracted from their voice:
- Speech rate: fast (possible stress/anxiety), normal, slow (possible fatigue)
- Energy level: high, moderate, low (possible fatigue/depression)
- Pause patterns: frequent (hesitation/cognitive load), normal, rare
- Voice tone: bright (positive energy), neutral, dull (fatigue/low mood)

When you notice concerning patterns, acknowledge them gently and with curiosity:
- "Your voice sounds a bit tired today - rough night?"
- "You're speaking quite quickly - lot on your mind?"
- "I notice some heaviness in your voice - want to talk about what's going on?"

MISMATCH HANDLING:
Sometimes what people say doesn't match how they sound. When the user says they're "fine" or "good" but their voice suggests otherwise:
- Don't contradict them directly or say "but your voice shows..."
- Use gentle curiosity: "That's good to hear. How's your energy been?"
- Create space for them to open up if they want to
- Respect if they don't want to go deeper

CONVERSATION FLOW:
1. Start with a warm, natural greeting
2. Ask an open question about how they're doing
3. Listen actively and respond naturally
4. Pick up on emotional cues and voice patterns
5. After 3-5 exchanges, begin wrapping up with support
6. End with encouragement or a gentle, actionable suggestion

EXAMPLES OF GOOD RESPONSES:
- "Hey, it's good to hear your voice. How are you doing today?"
- "I hear you. That does sound overwhelming."
- "Your voice sounds a bit flat today - how have you been sleeping?"
- "It sounds like you've got a lot going on. What feels most pressing right now?"
- "That makes sense. What would help you feel a bit lighter right now?"

EXAMPLES OF BAD RESPONSES:
- [Too clinical] "Based on your vocal biomarkers, you appear to be experiencing elevated stress levels."
- [Too long] "I understand that you're feeling overwhelmed, and I want you to know that it's completely normal to feel this way sometimes. Many people experience similar feelings, and there are various strategies we can explore together..."
- [Too prescriptive] "You should definitely take a 10-minute break right now and do some deep breathing."

REMEMBER: This is a voice conversation. Keep responses SHORT and NATURAL. Pause to listen. Match their energy level. Be a companion, not a coach.`

/**
 * Generate context injection for mismatch detection
 * This is sent to Gemini when a mismatch between words and voice is detected
 *
 * SECURITY: All signal values are validated against allowed enums to prevent prompt injection
 */
export function generateMismatchContext(result: MismatchResult): string {
  if (!result.detected) {
    return ""
  }

  // Validate signals against allowed values to prevent injection
  const safeAcousticSignal = validateAcousticSignal(result.acousticSignal)
  const safeSemanticSignal = validateSemanticSignal(result.semanticSignal)

  // Clamp confidence to valid range
  const safeConfidence = Math.max(0, Math.min(1, result.confidence))

  const parts: string[] = [
    "[VOICE BIOMARKER CONTEXT]",
    `The user's voice indicates ${safeAcousticSignal} patterns (${Math.round(safeConfidence * 100)}% confidence).`,
    `Their words suggest ${safeSemanticSignal} sentiment.`,
    "There appears to be a mismatch between what they're saying and how they sound.",
    "Consider gently and empathetically exploring how they're really feeling.",
    "Do NOT mention biomarkers or analysis directly - just be naturally curious.",
    "[END CONTEXT]",
  ]

  return parts.join("\n")
}

// Allowed values for voice patterns - prevents prompt injection
const VALID_SPEECH_RATES = ["slow", "normal", "fast"] as const
const VALID_ENERGY_LEVELS = ["low", "moderate", "high"] as const
const VALID_PAUSE_FREQUENCIES = ["rare", "normal", "frequent"] as const
const VALID_VOICE_TONES = ["dull", "neutral", "bright"] as const
const VALID_STRESS_LEVELS = ["low", "moderate", "elevated", "high"] as const
const VALID_FATIGUE_LEVELS = ["rested", "normal", "tired", "exhausted"] as const

/**
 * Generate voice patterns context for periodic updates
 * Sent every few turns to keep Gemini aware of current state
 *
 * SECURITY: All pattern values are validated against allowed enums
 */
export function generateVoicePatternContext(patterns: VoicePatterns, metrics: VoiceMetrics): string {
  // Validate all pattern values
  const safeSpeechRate = VALID_SPEECH_RATES.includes(patterns.speechRate as (typeof VALID_SPEECH_RATES)[number])
    ? patterns.speechRate
    : "normal"
  const safeEnergyLevel = VALID_ENERGY_LEVELS.includes(patterns.energyLevel as (typeof VALID_ENERGY_LEVELS)[number])
    ? patterns.energyLevel
    : "moderate"
  const safePauseFreq = VALID_PAUSE_FREQUENCIES.includes(patterns.pauseFrequency as (typeof VALID_PAUSE_FREQUENCIES)[number])
    ? patterns.pauseFrequency
    : "normal"
  const safeVoiceTone = VALID_VOICE_TONES.includes(patterns.voiceTone as (typeof VALID_VOICE_TONES)[number])
    ? patterns.voiceTone
    : "neutral"

  // Validate stress level
  const safeStressLevel = VALID_STRESS_LEVELS.includes(metrics.stressLevel as (typeof VALID_STRESS_LEVELS)[number])
    ? metrics.stressLevel
    : "moderate"

  // Validate fatigue level
  const safeFatigueLevel = VALID_FATIGUE_LEVELS.includes(metrics.fatigueLevel as (typeof VALID_FATIGUE_LEVELS)[number])
    ? metrics.fatigueLevel
    : "normal"

  const stressDescription =
    safeStressLevel === "high" || safeStressLevel === "elevated"
      ? "elevated stress"
      : safeStressLevel === "low"
        ? "calm"
        : "moderate"

  const fatigueDescription =
    safeFatigueLevel === "exhausted" || safeFatigueLevel === "tired"
      ? "fatigue"
      : safeFatigueLevel === "rested"
        ? "good energy"
        : "normal energy"

  const parts: string[] = [
    "[CURRENT VOICE STATE]",
    `Speech: ${safeSpeechRate}, Energy: ${safeEnergyLevel}`,
    `Pauses: ${safePauseFreq}, Tone: ${safeVoiceTone}`,
    `Overall: ${stressDescription}, ${fatigueDescription}`,
    "[END STATE]",
  ]

  return parts.join("\n")
}

/**
 * Opening greeting prompt
 * Used when starting a new check-in conversation
 */
export const CHECK_IN_OPENING_PROMPT = `Start the conversation with a warm, natural greeting. Ask how they're doing in a conversational way. Keep it brief - just 1-2 sentences. Don't be overly formal or clinical.`

/**
 * Closing prompt
 * Used when ending the conversation
 */
export const CHECK_IN_CLOSING_PROMPT = `The user wants to end the conversation. Provide a warm, supportive closing. If appropriate, offer one gentle suggestion for self-care. Keep it brief and encouraging.`

/**
 * Post-recording context prompt
 * Used when check-in is triggered after a recording
 *
 * SECURITY: All values are validated and sanitized
 */
export function generatePostRecordingContext(
  stressScore: number,
  fatigueScore: number,
  patterns: VoicePatterns
): string {
  // Clamp scores to valid range
  const safeStressScore = Math.max(0, Math.min(100, Math.round(stressScore)))
  const safeFatigueScore = Math.max(0, Math.min(100, Math.round(fatigueScore)))

  // Validate pattern values
  const safeSpeechRate = VALID_SPEECH_RATES.includes(patterns.speechRate as (typeof VALID_SPEECH_RATES)[number])
    ? patterns.speechRate
    : "normal"
  const safeEnergyLevel = VALID_ENERGY_LEVELS.includes(patterns.energyLevel as (typeof VALID_ENERGY_LEVELS)[number])
    ? patterns.energyLevel
    : "moderate"

  let concernLevel = "fine"
  if (safeStressScore > 70 || safeFatigueScore > 70) {
    concernLevel = "concerning"
  } else if (safeStressScore > 50 || safeFatigueScore > 50) {
    concernLevel = "moderate"
  }

  return `[RECORDING CONTEXT]
The user just completed a voice recording for burnout tracking.
Their voice patterns show ${concernLevel} levels:
- Stress: ${safeStressScore}/100
- Fatigue: ${safeFatigueScore}/100
- Speech: ${safeSpeechRate}, Energy: ${safeEnergyLevel}

This check-in was triggered because they might benefit from talking.
Start by acknowledging you noticed they were recording and gently ask how they're feeling.
[END CONTEXT]`
}
