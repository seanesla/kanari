/**
 * Check-In Components
 *
 * Conversational check-in feature using Gemini Live API.
 * Combines semantic analysis (what users say) with voice biomarkers
 * (how they sound) to detect mismatches and provide empathetic support.
 */

export { CheckInDialog } from "./check-in-dialog"
export { CheckInTrigger, CheckInFab } from "./check-in-trigger"
export { ConversationView } from "./conversation-view"
export { MessageBubble, TypingIndicator, TranscriptPreview } from "./message-bubble"
export { VoiceIndicator } from "./voice-indicator"
export { BiomarkerIndicator } from "./biomarker-indicator"
export {
  EmotionTimeline,
  EmotionTimelineCompact,
  EMOTION_CONFIG,
} from "./emotion-timeline"
export type { EmotionTimelineProps } from "./emotion-timeline"
