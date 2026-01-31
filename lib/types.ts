// ============================================
// Recording Types
// ============================================

export type RecordingStatus = "recording" | "processing" | "complete" | "error"

export type TestStatus = "pass" | "fail" | "warn"

export interface Recording {
  id: string
  createdAt: string
  duration: number // seconds
  status: RecordingStatus
  features?: AudioFeatures
  metrics?: VoiceMetrics
  semanticAnalysis?: GeminiSemanticAnalysis // Emotion detection from Gemini
  // Audio samples for playback (user voice only).
  // New: store Float32Array directly (IndexedDB supports typed arrays).
  // Legacy: older records may still have number[].
  audioData?: StoredAudioData
  sampleRate?: number // For playback (default 16000)
}

export type StoredAudioData = Float32Array | number[]

export interface AudioFeatures {
  // Spectral features (extracted via Meyda)
  mfcc: number[] // Mel-frequency cepstral coefficients
  spectralCentroid: number
  spectralFlux: number
  spectralRolloff: number
  // Energy features
  rms: number // Root mean square energy
  zcr: number // Zero crossing rate
  // Temporal features
  speechRate: number // Syllables per second
  pauseRatio: number // Ratio of silence to speech
  pauseCount: number
  avgPauseDuration: number // milliseconds
  // Pitch features (F0 analysis)
  pitchMean: number // Mean fundamental frequency in Hz
  pitchStdDev: number // Pitch variability (higher = stress indicator)
  pitchRange: number // Max - Min pitch (low = monotone = fatigue indicator)
}

// ============================================
// Metrics Types
// ============================================

export type StressLevel = "low" | "moderate" | "elevated" | "high"
export type FatigueLevel = "rested" | "normal" | "tired" | "exhausted"
export type TrendDirection = "improving" | "stable" | "declining"

export interface VoiceMetrics {
  stressScore: number // 0-100
  fatigueScore: number // 0-100
  stressLevel: StressLevel
  fatigueLevel: FatigueLevel
  confidence: number // 0-1
  analyzedAt: string

  /** Optional: why the score changed (for explainable UI) */
  explanations?: BiomarkerExplanations

  /** Optional: data quality signals (speech amount, noise, etc.) */
  quality?: VoiceDataQuality
}

export type BiomarkerExplanationMode = "baseline" | "threshold"

export interface BiomarkerExplanations {
  mode: BiomarkerExplanationMode
  stress: string[]
  fatigue: string[]
}

export interface VoiceDataQuality {
  /** Detected speech duration (seconds) */
  speechSeconds: number
  /** Total recorded duration (seconds) */
  totalSeconds: number
  /** speechSeconds / totalSeconds */
  speechRatio: number
  /** Combined 0-1 quality score */
  quality: number
  /** Human-readable reasons when quality is low */
  reasons: string[]
}

export interface VoiceBaseline {
  /** Baseline audio features captured during calibration */
  features: AudioFeatures
  recordedAt: string
  /** Which calibration prompt was used */
  promptId: string
  /** Optional: detected speech duration during calibration */
  speechSeconds?: number
}

export interface BiomarkerCalibration {
  /** Bias applied after scoring (-25..25) */
  stressBias: number
  fatigueBias: number
  /** Scale applied around 50 (0.75..1.25) */
  stressScale: number
  fatigueScale: number
  sampleCount: number
  updatedAt: string
}

export interface CheckInSelfReport {
  /** 0-100 (higher = more stressed) */
  stressScore: number
  /** 0-100 (higher = more fatigued) */
  fatigueScore: number
  reportedAt: string
}

export interface TrendData {
  date: string
  stressScore: number
  fatigueScore: number
  recordingCount?: number // Track how many recordings were aggregated for this day
}

export interface BurnoutPrediction {
  riskScore: number // 0-100
  riskLevel: "low" | "moderate" | "high" | "critical"
  predictedDays: number // Days until potential burnout (3-7)
  trend: TrendDirection
  confidence: number // 0-1
  factors: string[] // Contributing factors
}

// ============================================
// Enriched Wellness Context Types
// ============================================

// Voice pattern descriptors (qualitative)
export interface VoicePatterns {
  speechRate: "fast" | "normal" | "slow"
  energyLevel: "high" | "moderate" | "low"
  pauseFrequency: "frequent" | "normal" | "rare"
  voiceTone: "bright" | "neutral" | "dull"
}

// Historical context for suggestions
export interface HistoricalContext {
  recordingCount: number
  daysOfData: number
  averageStress: number
  averageFatigue: number
  stressChange: string   // "+15% from baseline" | "stable" | "-10%"
  fatigueChange: string
}

// Burnout context for suggestions
export interface BurnoutContext {
  riskLevel: "low" | "moderate" | "high" | "critical"
  predictedDays: number
  factors: string[]
}

// Enriched wellness context sent to Gemini
export interface EnrichedWellnessContext {
  // Core metrics (existing)
  stressScore: number
  stressLevel: StressLevel
  fatigueScore: number
  fatigueLevel: FatigueLevel
  trend: TrendDirection
  timeOfDay: "morning" | "afternoon" | "evening" | "night"
  dayOfWeek: "weekday" | "weekend"

  // NEW: Voice patterns
  voicePatterns: VoicePatterns

  // NEW: Historical context
  history: HistoricalContext

  // NEW: Burnout prediction
  burnout: BurnoutContext

  // NEW: Data quality
  confidence: number
}

// ============================================
// Google Search Grounding Types
// ============================================

/**
 * Citation from a web search source
 * Used to reference specific parts of the response that came from the source
 */
export interface GroundingCitation {
  startIndex: number
  endIndex: number
  uri: string
}

/**
 * Web search source used for grounding
 * Contains the source URL, title, and any citations
 */
export interface WebSearchSource {
  uri: string
  title: string
  citations?: GroundingCitation[]
}

/**
 * Grounding metadata from Google Search
 * Returned when suggestions are backed by web research
 */
export interface GroundingMetadata {
  /** Search queries that were performed */
  webSearchQueries?: string[]
  /** Sources that were used to ground the response */
  webSearchSource?: WebSearchSource[]
}

// ============================================
// Suggestion Types
// ============================================

export type SuggestionStatus = "pending" | "accepted" | "dismissed" | "scheduled" | "completed"
export type SuggestionCategory = "break" | "exercise" | "mindfulness" | "social" | "rest"
export type KanbanColumn = "pending" | "scheduled" | "completed"

/**
 * Effectiveness rating for completed suggestions
 * Used to track whether a suggestion actually helped the user
 */
export type EffectivenessRating = "very_helpful" | "somewhat_helpful" | "not_helpful" | "skipped"

/**
 * Effectiveness feedback data collected after suggestion completion
 */
export interface EffectivenessFeedback {
  /** The rating given by the user */
  rating: EffectivenessRating
  /** When the feedback was collected */
  ratedAt: string
  /** Optional comment from the user */
  comment?: string
}

// ============================================
// Suggestion Memory Types
// ============================================

export type CategoryPreference = "high" | "medium" | "low" | "avoid"

export interface CategoryStats {
  completed: number
  dismissed: number
  total: number
  /** completed / total (0-100) */
  completionRate: number
  preference: CategoryPreference
}

export interface CategoryEffectivenessStats {
  totalRatings: number
  helpfulRatings: number
  notHelpfulRatings: number
  /** helpfulRatings / totalRatings (0-100) */
  helpfulRate: number
}

// ============================================
// Diff-Aware Suggestion Types
// ============================================

export type SuggestionDecision = "keep" | "update" | "drop" | "new"

export interface GeminiDiffSuggestion {
  id: string
  decision: SuggestionDecision
  content: string
  rationale: string
  duration: number
  category: SuggestionCategory
  decisionReason?: string  // Required for update/drop decisions
  updateSummary?: string   // What changed (only for update)
}

export interface GeminiDiffResponse {
  suggestions: GeminiDiffSuggestion[]
  summary: {
    kept: number
    updated: number
    dropped: number
    added: number
  }
}

// Memory context sent to Gemini for personalization
export interface GeminiMemoryContext {
  completed: Array<{
    content: string
    category: SuggestionCategory
    completedAt: string
  }>
  dismissed: Array<{
    content: string
    category: SuggestionCategory
    dismissedAt: string
  }>
  scheduled: Array<{
    content: string
    category: SuggestionCategory
    scheduledFor: string
  }>
  stats: {
    totalCompleted: number
    totalDismissed: number
    mostUsedCategory: SuggestionCategory | null
    leastUsedCategory: SuggestionCategory | null
    averageCompletionRate: number
    categoryStats: Record<SuggestionCategory, CategoryStats>
    preferredCategories: SuggestionCategory[]
    avoidedCategories: SuggestionCategory[]
    effectivenessByCategory: Record<SuggestionCategory, CategoryEffectivenessStats>
  }
}

export interface Suggestion {
  id: string
  recordingId?: string // Links to the recording that generated this suggestion (optional for global suggestions)
  /** Links a suggestion back to a specific check-in session (post-check-in synthesis, AI chat tools, etc.) */
  checkInSessionId?: string
  content: string
  rationale: string
  /**
   * Optional linkage to specific synthesized insights.
   * Used to make "why" traceable (suggestion → insight → evidence).
   */
  linkedInsightIds?: string[]
  duration: number // minutes
  category: SuggestionCategory
  status: SuggestionStatus
  createdAt: string
  scheduledFor?: string
  calendarEventId?: string
  // Diff-aware suggestion tracking
  version?: number // Track suggestion version for diff-aware generation
  lastDecision?: SuggestionDecision // Last decision made by Gemini
  lastDecisionReason?: string // Why this decision was made
  lastUpdatedAt?: string // When this suggestion was last updated
  // Effectiveness tracking
  effectiveness?: EffectivenessFeedback // Feedback collected after completion
  completedAt?: string // When the suggestion was marked complete
}

// Map suggestion status to kanban column
export const statusToColumn: Record<SuggestionStatus, KanbanColumn> = {
  pending: "pending",
  scheduled: "scheduled",
  accepted: "completed",
  dismissed: "completed",
  completed: "completed",
}

// Category display configuration
export const categoryConfig: Record<SuggestionCategory, { label: string; color: string; bgColor: string }> = {
  break: { label: "Break", color: "text-accent", bgColor: "bg-accent/10" },
  exercise: { label: "Exercise", color: "text-green-500", bgColor: "bg-green-500/10" },
  mindfulness: { label: "Mindfulness", color: "text-purple-500", bgColor: "bg-purple-500/10" },
  social: { label: "Social", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  rest: { label: "Rest", color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
}

// Extract short title from suggestion content
export function extractSuggestionTitle(content: string, maxLength = 50): string {
  // Try to get first sentence
  const firstSentence = content.split(/[.!?]/)[0]?.trim()
  if (!firstSentence) return content.slice(0, maxLength)

  if (firstSentence.length <= maxLength) return firstSentence

  // Truncate at word boundary
  const truncated = firstSentence.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + "..."
}

// ============================================
// Calendar Types
// ============================================

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: string // ISO date string
  end: string // ISO date string
  type: "recovery" | "break" | "focus"
}

export interface RecoveryBlock {
  id: string
  suggestionId: string
  calendarEventId: string
  scheduledAt: string
  duration: number // minutes
  completed: boolean
}

// ============================================
// Settings Types
// ============================================

export type CoachVoice = 'warm' | 'professional' | 'minimal'

export type AccountabilityMode = "supportive" | "balanced" | "accountability"

// Gemini TTS voice options (30 prebuilt voices)
// Source: Context7 - /websites/ai_google_dev_gemini-api docs - "Speech generation"
export type GeminiVoice =
  | "Zephyr"      // Bright
  | "Puck"        // Upbeat
  | "Charon"      // Informative
  | "Kore"        // Firm
  | "Fenrir"      // Excitable
  | "Leda"        // Youthful
  | "Orus"        // Firm
  | "Aoede"       // Breezy
  | "Callirrhoe"  // Easy-going
  | "Autonoe"     // Bright
  | "Enceladus"   // Breathy
  | "Iapetus"     // Clear
  | "Umbriel"     // Easy-going
  | "Algieba"     // Smooth
  | "Despina"     // Smooth
  | "Erinome"     // Clear
  | "Algenib"     // Gravelly
  | "Rasalgethi"  // Informative
  | "Laomedeia"   // Upbeat
  | "Achernar"    // Soft
  | "Alnilam"     // Firm
  | "Schedar"     // Even
  | "Gacrux"      // Mature
  | "Pulcherrima" // Forward
  | "Achird"      // Friendly
  | "Zubenelgenubi" // Casual
  | "Vindemiatrix"  // Gentle
  | "Sadachbia"   // Lively
  | "Sadaltager"  // Knowledgeable
  | "Sulafat"     // Warm

// Font family options
export type FontFamily =
  | "Instrument Sans"
  | "Inter"
  | "DM Sans"
  | "Work Sans"
  | "Public Sans"
  | "Plus Jakarta Sans"
  | "Manrope"
  | "Sora"
  | "Outfit"
  | "Quicksand"
  | "Karla"
  | "Nunito Sans"
  | "Poppins"
  | "Raleway"
  | "Rubik"
  | "Source Sans 3"
  | "Montserrat"
  | "Lexend"

export type SerifFamily =
  | "Instrument Serif"
  | "Merriweather"
  | "Lora"
  | "Playfair Display"
  | "IBM Plex Serif"
  | "Spectral"
  | "Crimson Pro"
  | "Libre Baskerville"
  | "Cardo"
  | "Bitter"
  | "Fraunces"
  | "EB Garamond"

export type MonoFamily =
  | "Geist Mono"
  | "JetBrains Mono"
  | "Fira Code"
  | "Roboto Mono"
  | "IBM Plex Mono"
  | "Inconsolata"
  | "Source Code Pro"

export type GraphicsQuality = "auto" | "low" | "medium" | "high"

export type GeminiApiKeySource = "kanari" | "user"

export interface UserSettings {
  // User identity
  userName?: string // User's preferred name (for personalization)

  // Notification preferences
  enableNotifications: boolean
  dailyReminderTime?: string // HH:mm format

  // Timezone
  timeZone?: string // IANA timezone id (e.g., "America/Los_Angeles")

  // Calendar integration
  calendarConnected: boolean
  autoScheduleRecovery: boolean
  preferredRecoveryTimes: string[] // Array of HH:mm

  // Privacy
  localStorageOnly: boolean
  /**
   * If enabled, Kanari can share your journal entries with Gemini during check-ins
   * so the AI can reference them.
   *
   * Off by default.
   */
  shareJournalWithAi: boolean

  // Coach preferences
  coachVoice?: CoachVoice
  accountabilityMode?: AccountabilityMode // Default: "balanced"

  // AI Voice (Gemini TTS)
  selectedGeminiVoice?: GeminiVoice // User's chosen AI assistant voice

  // Coach avatar
  coachAvatarBase64?: string // SVG data URI (preferred) or legacy base64 PNG (no data: prefix)
  coachAvatarVoice?: GeminiVoice // Voice used when avatar was generated

  // Appearance
  accentColor?: string // Hex color string (e.g., "#d4a574")
  selectedSansFont?: FontFamily
  selectedSerifFont?: SerifFamily
  selectedMonoFont?: MonoFamily
  disableStartupAnimation?: boolean // Skip the animated logo on app load
  graphicsQuality?: GraphicsQuality

  // API Configuration
  geminiApiKey?: string // User's Gemini API key (stored locally)
  /**
   * Which Gemini key to use.
   * - "kanari": use the deployment-provided key (NEXT_PUBLIC_GEMINI_API_KEY)
   * - "user": use the user's own key stored in IndexedDB
   */
  geminiApiKeySource?: GeminiApiKeySource

  // Onboarding
  hasCompletedOnboarding?: boolean // Whether user has completed the onboarding flow
  onboardingCompletedAt?: string // ISO timestamp when onboarding was completed

  /** Optional: per-user voice baseline used to personalize biomarkers */
  voiceBaseline?: VoiceBaseline

  /** Optional: learned mapping tweaks based on user self-report */
  voiceBiomarkerCalibration?: BiomarkerCalibration
}

// ============================================
// Dashboard Stats
// ============================================

export interface DashboardStats {
  totalRecordings: number
  totalMinutesRecorded: number
  currentStreak: number // Days
  averageStress: number
  averageFatigue: number
  suggestionsAccepted: number
  recoveryBlocksScheduled: number
  weeklyRecordings: number // Recordings made this week (Mon-Sun)
  weeklyGoal: number // Target recordings per week (default: 3)
}

// ============================================
// Gemini Semantic Analysis Types
// ============================================

export type EmotionType = "happy" | "sad" | "angry" | "neutral"
export type ObservationType = "stress_cue" | "fatigue_cue" | "positive_cue"
export type RelevanceLevel = "high" | "medium" | "low"

export interface SemanticSegment {
  timestamp: string // MM:SS format
  content: string   // Transcribed text
  emotion: EmotionType
}

export interface SemanticObservation {
  type: ObservationType
  observation: string
  relevance: RelevanceLevel
}

export interface GeminiSemanticAnalysis {
  segments: SemanticSegment[]
  overallEmotion: EmotionType
  emotionConfidence: number // 0-1
  observations: SemanticObservation[]
  stressInterpretation: string
  fatigueInterpretation: string
  summary: string
}

// ============================================
// Conversational Check-In Types
// ============================================

export type CheckInMessageRole = "user" | "assistant" | "system"

export type CheckInState =
  | "idle"
  | "initializing"
  | "connecting"
  | "ready"
  | "ai_greeting"    // AI is speaking first (greeting the user)
  | "listening"
  | "user_speaking"
  | "processing"
  | "assistant_speaking"
  | "ending"
  | "complete"
  | "error"

export interface MismatchResult {
  detected: boolean
  semanticSignal: "positive" | "neutral" | "negative"
  acousticSignal: "stressed" | "fatigued" | "normal" | "energetic"
  confidence: number // 0-1
  suggestionForGemini: string | null // Context to inject, e.g., "User said fine but voice shows fatigue"
}

export interface CheckInMessage {
  id: string
  role: CheckInMessageRole
  content: string
  // Chain-of-thought reasoning (for assistant messages)
  // Shows Gemini's internal reasoning process - displayed in expandable accordion
  thinking?: string
  timestamp: string
  // Audio features captured during this message (for user messages)
  features?: AudioFeatures
  // Voice metrics computed from features
  metrics?: VoiceMetrics
  // Mismatch detection result (for user messages)
  mismatch?: MismatchResult
  // Duration of the audio segment in seconds
  audioDuration?: number
  // True while message is being streamed (assistant messages only)
  isStreaming?: boolean
}

export interface CheckInSummary {
  stressIndicators: string[]
  fatigueIndicators: string[]
  positiveNotes: string[]
  suggestedActions: string[]
  overallMood: "positive" | "neutral" | "concerning"
}

// ============================================
// Post-Check-In Synthesis Types
// ============================================

export interface CheckInSynthesisEvidenceQuote {
  /** Optional link back to the transcript message id */
  messageId?: string
  role: CheckInMessageRole
  text: string
}

export interface CheckInSynthesisInsight {
  id: string
  title: string
  description: string
  evidence: {
    quotes: CheckInSynthesisEvidenceQuote[]
    voice: string[]
    journal: string[]
  }
}

export interface CheckInSynthesisSuggestion {
  id: string
  content: string
  rationale: string
  duration: number
  category: SuggestionCategory
  linkedInsightIds: string[]
}

export interface CheckInSynthesis {
  narrative: string
  insights: CheckInSynthesisInsight[]
  suggestions: CheckInSynthesisSuggestion[]
  /**
   * Semantic stress/fatigue estimate from what the user said (not how they sounded).
   * This is generated by Gemini during synthesis and is used to refine the final biomarkers.
   */
  semanticBiomarkers?: {
    /** 0-100 (higher = more stressed) */
    stressScore: number
    /** 0-100 (higher = more fatigued) */
    fatigueScore: number
    /** 0-1 */
    confidence: number
    /** Short, user-safe explanation */
    notes: string
  }
  meta: {
    model: string
    generatedAt: string
    input: {
      messagesTotal: number
      messagesUsed: number
      journalEntriesTotal: number
      journalEntriesUsed: number
      truncated: boolean
    }
  }
}

export interface CheckInSession {
  id: string
  startedAt: string
  endedAt?: string
  messages: CheckInMessage[]
  // Summary generated at end of conversation
  summary?: CheckInSummary
  // Post-check-in synthesis generated by Gemini (bridge to dashboard)
  synthesis?: CheckInSynthesis
  // Legacy: link to recording if session was started after a recording
  recordingId?: string
  // Total duration of the conversation in seconds
  duration?: number
  // Number of detected mismatches during conversation
  mismatchCount?: number
  // Session-level acoustic metrics (aggregated from all user speech)
  acousticMetrics?: {
    /** Final (blended) stress score 0-100 */
    stressScore: number
    /** Final (blended) fatigue score 0-100 */
    fatigueScore: number
    /** Final (blended) categorical level */
    stressLevel: StressLevel
    /** Final (blended) categorical level */
    fatigueLevel: FatigueLevel
    /** Final (blended) confidence 0-1 */
    confidence: number
    analyzedAt?: string
    features: AudioFeatures

    /** Raw acoustic-only scores before semantic blending */
    acousticStressScore?: number
    acousticFatigueScore?: number
    acousticStressLevel?: StressLevel
    acousticFatigueLevel?: FatigueLevel
    acousticConfidence?: number

    /** Semantic-only estimate (keywords during session, Gemini after synthesis) */
    semanticStressScore?: number
    semanticFatigueScore?: number
    semanticConfidence?: number
    semanticSource?: "keywords" | "gemini"

    /** Optional: why the score changed (for explainable UI) */
    explanations?: BiomarkerExplanations

    /** Optional: data quality signals (speech amount, noise, etc.) */
    quality?: VoiceDataQuality
  }

  /** Optional: user self-report collected after the check-in */
  selfReport?: CheckInSelfReport
  // Audio data for session playback (user's voice only)
  // Audio samples for playback (user voice only).
  // New: store Float32Array directly (IndexedDB supports typed arrays).
  // Legacy: older sessions may still have number[].
  audioData?: StoredAudioData
  sampleRate?: number // For playback (default 16000)
}

// ============================================
// Commitments (Accountability)
// ============================================

export type CommitmentCategory = "action" | "habit" | "mindset" | "boundary"
export type CommitmentOutcome = "completed" | "partial" | "not_done" | "modified"

export interface Commitment {
  id: string
  checkInSessionId: string
  content: string
  category: CommitmentCategory
  extractedAt: string
  followedUpAt?: string
  outcome?: CommitmentOutcome
  outcomeNote?: string
}

export interface CommitmentToolArgs {
  content: string
  category: CommitmentCategory
  timeframe?: string
}

// ============================================
// Conversational Check-In Widgets (Gemini-triggered)
// ============================================

export interface ScheduleActivityToolArgs {
  title: string
  category: SuggestionCategory
  /** YYYY-MM-DD */
  date: string
  /** HH:MM (24h) */
  time: string
  /** Minutes */
  duration: number
}

export type BreathingExerciseType = "box" | "478" | "relaxing"

export interface BreathingExerciseToolArgs {
  type: BreathingExerciseType
  /** Seconds */
  duration: number
}

export interface StressGaugeToolArgs {
  /** 0-100 */
  stressLevel: number
  /** 0-100 */
  fatigueLevel: number
  message?: string
}

export interface QuickActionsToolArgs {
  options: Array<{
    label: string
    action: string
  }>
}

export interface JournalPromptToolArgs {
  prompt: string
  placeholder?: string
  category?: string
}

/**
 * Tool args for letting Gemini request journal entries as context.
 * This is not a widget; it returns data via tool response.
 */
export interface GetJournalEntriesToolArgs {
  /** Max entries to return (most recent first). */
  limit?: number
  /** Number of most-recent entries to skip (for pagination). */
  offset?: number
}

export type WidgetType =
  | "schedule_activity"
  | "breathing_exercise"
  | "stress_gauge"
  | "quick_actions"
  | "journal_prompt"

interface WidgetBase<TType extends WidgetType, TArgs> {
  id: string
  type: TType
  createdAt: string
  args: TArgs
}

export type ScheduleActivityWidgetStatus = "scheduled" | "failed"

export type ScheduleActivityWidgetState = WidgetBase<"schedule_activity", ScheduleActivityToolArgs> & {
  status: ScheduleActivityWidgetStatus
  suggestionId?: string
  error?: string
}

export type BreathingExerciseWidgetState = WidgetBase<"breathing_exercise", BreathingExerciseToolArgs>

export type StressGaugeWidgetState = WidgetBase<"stress_gauge", StressGaugeToolArgs>

export type QuickActionsWidgetState = WidgetBase<"quick_actions", QuickActionsToolArgs>

export type JournalPromptWidgetStatus = "draft" | "saved" | "failed"

export type JournalPromptWidgetState = WidgetBase<"journal_prompt", JournalPromptToolArgs> & {
  status: JournalPromptWidgetStatus
  entryId?: string
  error?: string
}

export type WidgetState =
  | ScheduleActivityWidgetState
  | BreathingExerciseWidgetState
  | StressGaugeWidgetState
  | QuickActionsWidgetState
  | JournalPromptWidgetState

export interface JournalEntry {
  id: string
  createdAt: string
  category: string
  prompt: string
  content: string
  checkInSessionId?: string
}

// Configuration for Gemini Live API connection
export interface LiveAPIConfig {
  model: string // e.g., "gemini-2.5-flash-native-audio-preview-12-2025"
  systemInstruction: string
  voiceConfig?: {
    voiceName?: string // One of 30 HD voices
    speakingRate?: number // 0.5-2.0
  }
  inputAudioConfig: {
    sampleRate: number // 16000
    encoding: "PCM_16"
  }
  outputAudioConfig: {
    sampleRate: number // 24000
    encoding: "PCM_16"
  }
}

// WebSocket message types for Gemini Live API
export interface LiveAPISetupMessage {
  setup: {
    model: string
    systemInstruction: {
      parts: Array<{ text: string }>
    }
    generationConfig: {
      responseModalities: Array<"AUDIO" | "TEXT">
    }
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: boolean
      }
    }
  }
}

export interface LiveAPIAudioMessage {
  realtimeInput: {
    audio: {
      mimeType: string // "audio/pcm;rate=16000"
      data: string // base64-encoded PCM
    }
  }
}

export interface LiveAPITextMessage {
  realtimeInput: {
    text: string
  }
}

export interface LiveAPIServerContent {
  serverContent: {
    modelTurn?: {
      parts: Array<{
        text?: string
        inlineData?: {
          mimeType: string
          data: string
        }
      }>
    }
    turnComplete?: boolean
    interrupted?: boolean
  }
}

export interface LiveAPITranscription {
  realtimeOutput?: {
    transcription?: {
      text: string
      isFinal: boolean
    }
  }
}

// ============================================
// Unified History Timeline Types
// ============================================

// Discriminator type to identify which history item we're dealing with
export type HistoryItemType = "ai_chat"

// Represents an AI chat session in the history timeline
export interface AIChatHistoryItem {
  id: string // Same as session.id
  type: "ai_chat"
  timestamp: string // ISO date string (session.startedAt) for chronological sorting
  session: CheckInSession // The full session object
}

// History item type (AI chat only)
export type HistoryItem = AIChatHistoryItem

// Re-export SceneMode for convenience
export type { SceneMode } from "./scene-context"

// ============================================
// Analytics Insights Types
// ============================================

/** Reference to a specific moment in a recording */
export interface RecordingReference {
  recordingId: string
  timestamp?: string // MM:SS from segment
  createdAt: string // For display
}

/** Aggregated observation with sources */
export interface AggregatedObservation {
  type: "stress_cue" | "fatigue_cue" | "positive_cue"
  observation: string
  relevance: "high" | "medium" | "low"
  references: RecordingReference[]
  frequency: number
}

/** Detected pattern */
export interface DetectedPattern {
  description: string
  occurrenceRate: number // 0-100%
  affectedRecordingIds: string[]
}

export type AnalyticsTimeRange = "7_days" | "30_days" | "all_time"

export interface AnalyticsInsights {
  timeRange: AnalyticsTimeRange
  recordingCount: number
  observations: {
    stress: AggregatedObservation[]
    fatigue: AggregatedObservation[]
    positive: AggregatedObservation[]
  }
  interpretations: {
    stressSummary: string
    fatigueSummary: string
  }
  patterns: DetectedPattern[]
}
