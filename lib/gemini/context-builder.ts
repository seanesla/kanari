import {
  buildCheckInSystemInstruction,
  generateMismatchContext,
  generatePostRecordingContext,
  generateVoicePatternContext,
  type SystemContextSummary,
  type SystemTimeContext,
} from "@/lib/gemini/live-prompts"
import type { CheckInContextData } from "@/lib/gemini/check-in-context"
import { formatContextForAPI } from "@/lib/gemini/check-in-context"
import type { MismatchResult, VoiceMetrics, VoicePatterns } from "@/lib/types"

export function buildSystemContext(options: {
  contextSummary?: SystemContextSummary
  timeContext?: SystemTimeContext
}): string {
  return buildCheckInSystemInstruction(options.contextSummary, options.timeContext)
}

export function buildHistoricalContext(data: CheckInContextData) {
  return formatContextForAPI(data)
}

export function buildMismatchContext(result: MismatchResult): string {
  return generateMismatchContext(result)
}

export function buildVoicePatternContext(patterns: VoicePatterns, metrics: VoiceMetrics): string {
  return generateVoicePatternContext(patterns, metrics)
}

export function buildPostRecordingContext(
  stressScore: number,
  fatigueScore: number,
  patterns: VoicePatterns
): string {
  return generatePostRecordingContext(stressScore, fatigueScore, patterns)
}

