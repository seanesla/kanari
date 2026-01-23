"use client"

import type { CheckInSession, JournalEntry, CheckInSynthesis } from "@/lib/types"
import { createGeminiHeaders } from "@/lib/utils"

interface SynthesizeSessionMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
  mismatch?: CheckInSession["messages"][number]["mismatch"]
}

export interface SynthesizeCheckInRequestBody {
  session: {
    id: string
    startedAt: string
    endedAt?: string
    duration?: number
    mismatchCount?: number
    acousticMetrics?: {
      stressScore: number
      fatigueScore: number
      stressLevel: "low" | "moderate" | "elevated" | "high"
      fatigueLevel: "rested" | "normal" | "tired" | "exhausted"
      confidence: number
    }
    messages: SynthesizeSessionMessage[]
  }
  journalEntries?: JournalEntry[]
}

export function buildSynthesizeCheckInRequestBody(
  session: CheckInSession,
  journalEntries?: JournalEntry[]
): SynthesizeCheckInRequestBody {
  const messages: SynthesizeSessionMessage[] = session.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    ...(m.mismatch ? { mismatch: m.mismatch } : {}),
  }))

  const acousticMetrics = session.acousticMetrics
    ? {
        stressScore: session.acousticMetrics.acousticStressScore ?? session.acousticMetrics.stressScore,
        fatigueScore: session.acousticMetrics.acousticFatigueScore ?? session.acousticMetrics.fatigueScore,
        stressLevel: session.acousticMetrics.acousticStressLevel ?? session.acousticMetrics.stressLevel,
        fatigueLevel: session.acousticMetrics.acousticFatigueLevel ?? session.acousticMetrics.fatigueLevel,
        confidence: session.acousticMetrics.acousticConfidence ?? session.acousticMetrics.confidence,
      }
    : undefined

  return {
    session: {
      id: session.id,
      startedAt: session.startedAt,
      ...(session.endedAt ? { endedAt: session.endedAt } : {}),
      ...(session.duration !== undefined ? { duration: session.duration } : {}),
      ...(session.mismatchCount !== undefined ? { mismatchCount: session.mismatchCount } : {}),
      ...(acousticMetrics ? { acousticMetrics } : {}),
      messages,
    },
    ...(journalEntries && journalEntries.length > 0 ? { journalEntries } : {}),
  }
}

export async function synthesizeCheckInSession(
  session: CheckInSession,
  journalEntries?: JournalEntry[],
  options?: { signal?: AbortSignal }
): Promise<CheckInSynthesis> {
  const headers = await createGeminiHeaders({ "Content-Type": "application/json" })
  const body = buildSynthesizeCheckInRequestBody(session, journalEntries)

  const response = await fetch("/api/gemini/synthesize", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  })

  const json = (await response.json().catch(() => ({}))) as { synthesis?: unknown; error?: unknown }
  if (!response.ok) {
    const errorText = typeof json.error === "string" ? json.error : `API error: ${response.status}`
    throw new Error(errorText)
  }

  if (!json || typeof json !== "object" || !("synthesis" in json)) {
    throw new Error("Invalid synthesis response")
  }

  return json.synthesis as CheckInSynthesis
}
