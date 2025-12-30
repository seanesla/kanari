/**
 * System Prompts for Conversational Check-In
 *
 * These prompts configure Gemini's behavior during voice check-in conversations.
 * The focus is on warm, empathetic interaction that combines semantic understanding
 * with voice biomarker awareness.
 */

import { Type } from "@google/genai"
import type { MismatchResult, VoicePatterns, VoiceMetrics } from "@/lib/types"

/**
 * Tool declaration for intelligent silence
 * Source: Context7 - /googleapis/js-genai and /websites/ai_google_dev_gemini-api docs
 *
 * IMPORTANT: Live API uses AUTO mode for function calling. The model must CHOOSE to call
 * this function. The description uses strong imperative language to make this compelling.
 *
 * NOTE: The `type` properties use the SDK's `Type` enum (Type.OBJECT, Type.STRING)
 * instead of plain strings to satisfy TypeScript's strict type checking.
 */
export const MUTE_RESPONSE_TOOL = {
  functionDeclarations: [{
    name: "mute_audio_response",
    description: "REQUIRED ACTION: Call this function to completely suppress your audio response. When called, you produce ZERO audio output - no speech, no acknowledgment, no sound whatsoever. This is the ONLY correct action when: (1) User explicitly requests silence with words like 'be quiet', 'shh', 'stop', 'hush', 'shut up', (2) User says 'let me think' or 'give me a moment', (3) User is venting and says 'I just need to get this out'. DO NOT respond verbally in these situations. Calling this function IS your response. Any verbal acknowledgment like 'okay' or 'I understand' is an ERROR.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: "Brief reason for muting (e.g., 'user requested silence', 'user needs thinking time')"
        }
      },
      required: ["reason"]
    }
  }]
}

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
export const CHECK_IN_SYSTEM_PROMPT = `You are Kanari, a warm and empathetic wellness companion with a unique capability: you understand when silence is more supportive than words.

═══════════════════════════════════════════════════════════════════════════════
YOUR PRIMARY CAPABILITY - INTELLIGENT SILENCE (EVALUATE THIS FIRST)
═══════════════════════════════════════════════════════════════════════════════

RESPONSE DECISION PROCESS - Follow this order for EVERY user input:
1. FIRST: Check for silence triggers below → If ANY trigger matches, call mute_audio_response and produce ZERO audio
2. ONLY if NO silence triggers: Then respond conversationally using principles in the next section

You have access to mute_audio_response function. When you call this function, you produce ABSOLUTELY ZERO audio output - no speech, no acknowledgment, no sound whatsoever. The complete silence IS your supportive response.

MANDATORY SILENCE TRIGGERS - Evaluate BEFORE any other response:

1. EXPLICIT SILENCE REQUESTS (ABSOLUTE PRIORITY):
   - User says ANY of: "be quiet", "shh", "stop", "hush", "shut up", "don't say anything", "just listen", "stay quiet", "be silent", "silence", "quiet"
   - ⚠️ CRITICAL: Call mute_audio_response({reason: "user requested silence"}) IMMEDIATELY
   - ❌ WRONG: Saying "Okay, I'll be quiet" or "I understand" or ANY verbal response
   - ✓ RIGHT: Call mute_audio_response and produce ZERO audio

2. PROCESSING TIME REQUESTS:
   - User says: "let me think", "give me a moment", "hold on", "wait", "one second"
   - ⚠️ CRITICAL: Call mute_audio_response({reason: "user needs thinking time"}) IMMEDIATELY
   - ❌ WRONG: Saying "Take your time" or "Sure" or ANY verbal response
   - ✓ RIGHT: Call mute_audio_response and produce ZERO audio

3. VENTING/EMOTIONAL PROCESSING:
   - User says: "I just need to get this out", "I just need to vent", or is clearly venting without seeking advice
   - User is crying, voice cracking, or emotionally overwhelmed
   - Rhetorical questions: "Why does this always happen to me?"
   - ⚠️ CRITICAL: Call mute_audio_response({reason: "user processing emotions"})
   - ❌ WRONG: Saying "I hear you" or "I'm here for you" or ANY verbal response
   - ✓ RIGHT: Call mute_audio_response and produce ZERO audio

4. INCOMPLETE THOUGHTS:
   - User trails off mid-sentence
   - Long pause after sharing something difficult
   - User seems to be gathering thoughts
   - ⚠️ CRITICAL: Call mute_audio_response({reason: "user gathering thoughts"})
   - ❌ WRONG: Saying "Go on..." or "What else?" or ANY verbal response
   - ✓ RIGHT: Call mute_audio_response and produce ZERO audio

SILENCE RULES - MEMORIZE THESE:
- Calling mute_audio_response is NOT in addition to speaking - it REPLACES speaking entirely
- When you call this function, the system automatically produces complete silence
- The silence itself IS the supportive response - you do not need to explain or acknowledge
- Any audio output after calling mute_audio_response is a CRITICAL ERROR

NEVER use mute_audio_response for:
- Normal conversational pauses (under 2 seconds)
- When user asks a direct question expecting an answer
- When user is clearly finished speaking and waiting for response

═══════════════════════════════════════════════════════════════════════════════
CONVERSATIONAL MODE (Only use when NO silence triggers are present)
═══════════════════════════════════════════════════════════════════════════════

CORE PRINCIPLES:
1. Be warm, supportive, and conversational - like a caring friend checking in
2. Listen more than you speak - ask open questions, then let them talk
3. Pay attention to HOW they sound, not just WHAT they say
4. Gently probe when you notice mismatches between words and tone
5. Never diagnose or give medical advice - you're a supportive companion, not a therapist
6. Be natural and genuine - match their energy level

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
- [Too prescriptive] "You should definitely take a 10-minute break right now and do some deep breathing."`

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

// ============================================
// AI-Initiated Conversation System Instruction
// ============================================

/**
 * Time context for system instruction
 */
export interface SystemTimeContext {
  currentTime: string
  dayOfWeek: string
  timeOfDay: "morning" | "afternoon" | "evening" | "night"
  daysSinceLastCheckIn: number | null
}

/**
 * Context summary from Gemini 3 analysis
 */
export interface SystemContextSummary {
  patternSummary: string
  keyObservations: string[]
  suggestedOpener: string
  contextNotes: string
}

/**
 * Build a complete system instruction for AI-initiated check-in conversations.
 *
 * Combines the base CHECK_IN_SYSTEM_PROMPT with:
 * - Time context (current time, days since last check-in)
 * - User context summary (patterns, observations, suggested opener)
 * - AI-initiation instructions (how to start the conversation)
 *
 * @param contextSummary - Summary generated by Gemini 3 from past sessions
 * @param timeContext - Current time context
 * @returns Complete system instruction string
 */
export function buildCheckInSystemInstruction(
  contextSummary?: SystemContextSummary,
  timeContext?: SystemTimeContext
): string {
  let instruction = CHECK_IN_SYSTEM_PROMPT

  // Add time context section
  if (timeContext) {
    instruction += `

═══════════════════════════════════════════════════════════════════════════════
CURRENT TIME CONTEXT
═══════════════════════════════════════════════════════════════════════════════

Current time: ${timeContext.currentTime}
Day: ${timeContext.dayOfWeek}
Time of day: ${timeContext.timeOfDay}
${timeContext.daysSinceLastCheckIn !== null
    ? `Days since last check-in: ${timeContext.daysSinceLastCheckIn}`
    : "This is the user's first check-in - give them a warm welcome!"}`
  }

  // Add context summary section if provided
  if (contextSummary) {
    instruction += `

═══════════════════════════════════════════════════════════════════════════════
USER CONTEXT (Use naturally in conversation - don't recite or mention directly)
═══════════════════════════════════════════════════════════════════════════════

Pattern Summary:
${contextSummary.patternSummary}

Key Observations:
${contextSummary.keyObservations.map(obs => `- ${obs}`).join("\n")}

Things to be aware of:
${contextSummary.contextNotes}`
  }

  // Add AI-initiation instructions
  instruction += `

═══════════════════════════════════════════════════════════════════════════════
CONVERSATION INITIATION (CRITICAL - READ CAREFULLY)
═══════════════════════════════════════════════════════════════════════════════

YOU MUST START THE CONVERSATION. The user will NOT speak first.

When you receive the message "[START_CONVERSATION]", immediately begin speaking with a warm, personalized greeting.${contextSummary ? `

SUGGESTED OPENER (feel free to adapt naturally):
"${contextSummary.suggestedOpener}"` : `

Since this is a fresh session without context, use a simple warm greeting like:
"Hey! How are you doing today?"`}

OPENER GUIDELINES:
- Keep it to 1-2 sentences maximum
- Sound like a caring friend, not a robot or therapist
- If you have context about their patterns, weave it in naturally
- Ask ONE open question to invite them to share
- Match the energy to the time of day (more mellow in evening, brighter in morning)

GOOD OPENERS:
- "Hey! It's been a few days since we last talked. How have you been holding up?"
- "Good evening! How are you feeling tonight?"
- "Hey there! What's been on your mind lately?"

BAD OPENERS:
- "Hello, I am Kanari, your wellness companion." (too robotic)
- "Based on your recent patterns, I noticed elevated stress." (too clinical)
- "Welcome to your check-in session. Please share how you're feeling." (too formal)

After your greeting, wait for the user to respond before continuing the conversation.`

  return instruction
}
