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

// Re-export SceneMode for convenience
export type { SceneMode } from "./scene-context"
