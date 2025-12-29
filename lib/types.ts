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
// Suggestion Types
// ============================================

export type SuggestionStatus = "pending" | "accepted" | "dismissed" | "scheduled"

export interface Suggestion {
  id: string
  content: string
  rationale: string
  duration: number // minutes
  category: "break" | "exercise" | "mindfulness" | "social" | "rest"
  status: SuggestionStatus
  createdAt: string
  scheduledFor?: string
  calendarEventId?: string
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
  encryptionEnabled: boolean
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
// Hybrid Analysis Types (Local Acoustic + Gemini Semantic)
// ============================================

// === LOCAL ACOUSTIC ANALYSIS (from Meyda) ===

export type FeatureStatus = "low" | "normal" | "elevated" | "high"

export interface FeatureContribution {
  featureName: string // e.g., "speechRate", "rms"
  displayName: string // e.g., "Speech Rate", "Voice Energy"
  rawValue: number // Actual extracted value
  normalizedValue: number // 0-1 scale
  status: FeatureStatus
  contribution: number // Points contributed to score
  maxContribution: number // Max possible points for this feature
  description: string // "Speech rate is elevated at 5.8 syllables/sec"
}

export interface AcousticBreakdown {
  // Each feature shows: value, status, contribution to score
  speechRate: FeatureContribution
  rmsEnergy: FeatureContribution
  spectralFlux: FeatureContribution
  spectralCentroid: FeatureContribution
  pauseRatio: FeatureContribution
  zcr: FeatureContribution
}

// === GEMINI SEMANTIC ANALYSIS ===

export type EmotionType = "happy" | "sad" | "angry" | "neutral"
export type ObservationType = "stress_cue" | "fatigue_cue" | "positive_cue"
export type ObservationRelevance = "high" | "medium" | "low"

export interface TranscriptSegment {
  timestamp: string // "MM:SS" format
  content: string // Transcribed text
  emotion: EmotionType
}

export interface SemanticObservation {
  type: ObservationType
  observation: string // "Speaker frequently restarts sentences"
  relevance: ObservationRelevance
}

export interface GeminiSemanticAnalysis {
  // Transcription with emotions
  segments: TranscriptSegment[]
  overallEmotion: EmotionType
  emotionConfidence: number // 0-1

  // Semantic observations (NOT acoustic measurements)
  observations: SemanticObservation[]

  // Gemini's interpretation of stress/fatigue
  stressInterpretation: string // "Speaker sounds pressured and rushed"
  fatigueInterpretation: string // "Voice lacks energy, monotone delivery"

  // Overall narrative
  summary: string
}

// === COMBINED HYBRID RESULT ===

export interface HybridAnalysis {
  // From local processing
  acousticBreakdown: AcousticBreakdown
  acousticStressScore: number // 0-100 from local features
  acousticFatigueScore: number // 0-100 from local features

  // From Gemini
  semanticAnalysis: GeminiSemanticAnalysis | null // null if Gemini failed

  // Combined final scores (weighted blend: 70% acoustic, 30% semantic)
  finalStressScore: number
  finalFatigueScore: number

  // For UI
  stressLevel: StressLevel
  fatigueLevel: FatigueLevel
  confidence: number // 0-1

  // Analysis metadata
  analysisTimestamp: string
  analysisMethod: "acoustic_only" | "hybrid" // acoustic_only if Gemini failed
}

// Re-export SceneMode for convenience
export type { SceneMode } from "./scene-context"
