import {
  buildCheckInSystemInstruction,
  generateMismatchContext,
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
  accountabilityMode?: Parameters<typeof buildCheckInSystemInstruction>[2]
  userName?: string
}): string {
  return buildCheckInSystemInstruction(
    options.contextSummary,
    options.timeContext,
    options.accountabilityMode,
    options.userName
  )
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

