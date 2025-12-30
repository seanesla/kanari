/**
 * Check-In Components
 *
 * Conversational check-in feature using Gemini Live API.
 * Combines semantic analysis (what users say) with voice biomarkers
 * (how they sound) to detect mismatches and provide empathetic support.
 */

export { CheckInDialog } from "./check-in-dialog"
export { CheckInTrigger, CheckInFab, PostRecordingPrompt } from "./check-in-trigger"
export { ConversationView } from "./conversation-view"
export { MessageBubble, TypingIndicator, TranscriptPreview } from "./message-bubble"
export { VoiceIndicator, VoiceIndicatorLarge } from "./voice-indicator"
