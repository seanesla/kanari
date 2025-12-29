// ============================================
// Recording Types
// ============================================

export type RecordingStatus = "recording" | "processing" | "complete" | "error"

export interface Recording {
  id: string
  createdAt: string
  duration: number // seconds
  status: RecordingStatus
  features?: AudioFeatures
  metrics?: VoiceMetrics
  audioData?: number[] // Float32Array serialized for IndexedDB storage
  sampleRate?: number // For playback (default 16000)
}

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
// Enriched Context Types (for Gemini suggestions)
// ============================================

export interface VoicePatterns {
  speechRate: "slow" | "normal" | "fast"
  energyLevel: "low" | "moderate" | "high"
  pauseFrequency: "rare" | "normal" | "frequent"
  voiceTone: "dull" | "neutral" | "bright"
}

export interface HistoricalContext {
  recordingCount: number
  daysOfData: number
  averageStress: number
  averageFatigue: number
  stressChange: string // e.g., "stable", "+15% from baseline"
  fatigueChange: string
}

// ============================================
// Suggestion Types
// ============================================

export type SuggestionStatus = "pending" | "accepted" | "dismissed" | "scheduled" | "completed"
export type SuggestionCategory = "break" | "exercise" | "mindfulness" | "social" | "rest"
export type KanbanColumn = "pending" | "scheduled" | "completed"

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
  }
}

export interface Suggestion {
  id: string
  recordingId?: string // Links to the recording that generated this suggestion (optional for global suggestions)
  content: string
  rationale: string
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
  break: { label: "Break", color: "text-amber-500", bgColor: "bg-amber-500/10" },
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

export interface UserSettings {
  // Recording preferences
  defaultRecordingDuration: number // seconds (30-60)
  enableVAD: boolean // Voice activity detection
  // Notification preferences
  enableNotifications: boolean
  dailyReminderTime?: string // HH:mm format
  // Calendar integration
  calendarConnected: boolean
  autoScheduleRecovery: boolean
  preferredRecoveryTimes: string[] // Array of HH:mm
  // Privacy
  localStorageOnly: boolean
  // Coach preferences
  coachVoice?: CoachVoice
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

// Re-export SceneMode for convenience
export type { SceneMode } from "./scene-context"
