/**
 * POST /api/gemini/synthesize
 *
 * Post-check-in synthesis endpoint.
 * Takes a completed check-in (transcript + voice metrics + journal entries) and asks
 * Gemini 3 Flash to produce an evidence-backed narrative + a small set of targeted suggestions.
 *
 * Key properties:
 * - Suggestions are intentionally capped (1-2) to reduce overwhelm
 * - Each suggestion links to specific insights ("why" is visible)
 * - IDs/meta are added server-side for determinism and transparency
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  callGeminiAPI,
  validateAPIKey,
  getAPIKeyFromRequest,
  type GeminiRequest,
} from "@/lib/gemini/client"
import { maybeRateLimitKanariGeminiKey } from "@/lib/gemini/server-rate-limit"
import { parseGeminiJson } from "@/lib/gemini/json"
import { CHECK_IN_SYNTHESIS_PROMPT, CHECK_IN_SYNTHESIS_SCHEMA } from "@/lib/gemini/prompts"
import type {
  CheckInSynthesis,
  CheckInSynthesisEvidenceQuote,
} from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ============================================
// Validation
// ============================================

const MessageRoleSchema = z.enum(["user", "assistant", "system"])

const StressLevelSchema = z.enum(["low", "moderate", "elevated", "high"])
const FatigueLevelSchema = z.enum(["rested", "normal", "tired", "exhausted"])

const MismatchSchema = z
  .object({
    detected: z.boolean(),
    semanticSignal: z.enum(["positive", "neutral", "negative"]),
    acousticSignal: z.enum(["stressed", "fatigued", "normal", "energetic"]),
    confidence: z.number().min(0).max(1),
    suggestionForGemini: z.string().nullable(),
  })
  .strict()

const MessageSchema = z
  .object({
    id: z.string().min(1).max(200),
    role: MessageRoleSchema,
    content: z.string().min(1).max(20_000),
    timestamp: z.string().datetime(),
    mismatch: MismatchSchema.optional(),
  })
  .strict()

const AcousticMetricsSchema = z
  .object({
    stressScore: z.number().min(0).max(100),
    fatigueScore: z.number().min(0).max(100),
    stressLevel: StressLevelSchema,
    fatigueLevel: FatigueLevelSchema,
    confidence: z.number().min(0).max(1),
  })
  .strict()

const SessionSchema = z
  .object({
    id: z.string().min(1).max(200),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    duration: z.number().min(0).optional(),
    mismatchCount: z.number().min(0).optional(),
    acousticMetrics: AcousticMetricsSchema.optional(),
    messages: z.array(MessageSchema).min(2).max(200),
  })
  .strict()

const JournalEntrySchema = z
  .object({
    id: z.string().min(1).max(200),
    createdAt: z.string().datetime(),
    category: z.string().min(1).max(100),
    prompt: z.string().min(1).max(2000),
    content: z.string().min(1).max(20_000),
    checkInSessionId: z.string().min(1).max(200).optional(),
  })
  .strict()

const SynthesizeRequestSchema = z
  .object({
    session: SessionSchema,
    journalEntries: z.array(JournalEntrySchema).max(25).optional(),
  })
  .strict()

type SynthesizeRequest = z.infer<typeof SynthesizeRequestSchema>

const EvidenceQuoteSchema = z
  .object({
    messageId: z.string().min(1).max(200).optional(),
    role: MessageRoleSchema,
    text: z.string().min(1).max(2000),
  })
  .strict()

const ModelSynthesisOutputSchema = z
  .object({
    narrative: z.string().min(1).max(10_000),
    insights: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            description: z.string().min(1).max(2000),
            evidence: z
              .object({
                quotes: z.array(EvidenceQuoteSchema).min(1).max(3),
                voice: z.array(z.string().min(1).max(500)).max(4),
                journal: z.array(z.string().min(1).max(2000)).max(3),
              })
              .strict(),
          })
          .strict()
      )
      .min(2)
      .max(3),
    suggestions: z
      .array(
        z
          .object({
            content: z.string().min(1).max(5000),
            rationale: z.string().min(1).max(8000),
            duration: z.number().min(5).max(60),
            category: z.enum(["break", "exercise", "mindfulness", "social", "rest"]),
            linkedInsightIndexes: z.array(z.number().min(1).max(3)).min(1).max(2),
          })
          .strict()
      )
      .min(1)
      .max(2),
    semanticBiomarkers: z
      .object({
        stressScore: z.number().min(0).max(100),
        fatigueScore: z.number().min(0).max(100),
        confidence: z.number().min(0).max(1),
        notes: z.string().min(1).max(2000),
        evidenceQuotes: z.array(EvidenceQuoteSchema).min(1).max(3),
      })
      .strict(),
  })
  .strict()

// ============================================
// Helpers
// ============================================

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, "AIza[REDACTED]")
    .replace(/key[=:]\s*[^\s&]+/gi, "key=[REDACTED]")
    .replace(/token[=:]\s*[^\s&]+/gi, "token=[REDACTED]")
}

function truncateText(text: string, maxChars: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…"
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenizeForMatching(text: string): string[] {
  const normalized = normalizeForMatching(text)
  if (!normalized) return []
  return normalized.split(" ")
}

function containsTokenSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false
  if (needle.length > haystack.length) return false

  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return true
  }

  return false
}

function longestCommonContiguousTokenMatch(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0

  // DP for longest common substring (token-level).
  const dp = new Array(b.length + 1).fill(0)
  let max = 0

  for (let i = 1; i <= a.length; i++) {
    let prev = 0
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j]
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1
        if (dp[j] > max) max = dp[j]
      } else {
        dp[j] = 0
      }
      prev = temp
    }
  }

  return max
}

function inferMessageIdFromQuote(options: {
  quoteText: string
  quoteRole?: string
  messages: Array<{ id: string; role: string; tokens: string[] }>
}): string | null {
  const needleTokens = tokenizeForMatching(options.quoteText)
  if (needleTokens.length === 0) return null

  const roleFilter =
    options.quoteRole === "user" || options.quoteRole === "assistant" || options.quoteRole === "system"
      ? options.quoteRole
      : null

  const candidates = roleFilter
    ? options.messages.filter((m) => m.role === roleFilter)
    : options.messages

  const exactMatches = candidates.filter((m) => containsTokenSequence(m.tokens, needleTokens))
  if (exactMatches.length === 1) return exactMatches[0]!.id
  if (exactMatches.length > 1) return null

  // Fuzzy fallback: only for long-ish quotes to avoid mislinking common phrases.
  if (needleTokens.length < 5) return null

  const needleSet = new Set(needleTokens)
  const scored = candidates
    .map((m) => {
      const haySet = new Set(m.tokens)
      let overlap = 0
      for (const t of needleSet) if (haySet.has(t)) overlap++
      const coverage = needleSet.size > 0 ? overlap / needleSet.size : 0
      const contiguous = longestCommonContiguousTokenMatch(needleTokens, m.tokens)
      const contiguousRatio = needleTokens.length > 0 ? contiguous / needleTokens.length : 0
      const score = coverage * 0.55 + contiguousRatio * 0.45
      return { id: m.id, score, coverage, contiguous }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  const second = scored[1]
  if (!best) return null

  if (best.coverage < 0.75) return null
  if (best.contiguous < 4) return null
  if (best.score < 0.8) return null
  if (second && best.score - second.score < 0.12) return null

  return best.id
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function ensureMessageIds(output: unknown, messages: SynthesizeRequest["session"]["messages"]): unknown {
  if (!isRecord(output)) return output

  const msgIndex = messages.map((m) => ({
    id: m.id,
    role: m.role,
    tokens: tokenizeForMatching(m.content),
  }))
  const msgIdSet = new Set(msgIndex.map((m) => m.id))

  const patchQuote = (q: unknown): unknown => {
    if (!isRecord(q)) return q

    const rawMessageId = typeof q.messageId === "string" ? q.messageId.trim() : ""
    if (rawMessageId.length > 0 && msgIdSet.has(rawMessageId)) return { ...q, messageId: rawMessageId }

    const text = typeof q.text === "string" ? q.text : ""
    const role = typeof q.role === "string" ? q.role : undefined
    const inferred = inferMessageIdFromQuote({ quoteText: text, quoteRole: role, messages: msgIndex })

    // Never hard-fail synthesis on evidence linking; omit messageId if we can't match confidently.
    return { ...q, messageId: inferred ?? undefined }
  }

  const next: Record<string, unknown> = { ...output }

  const insights = next.insights
  if (Array.isArray(insights)) {
    next.insights = insights.map((insight) => {
      if (!isRecord(insight)) return insight
      const evidence = insight.evidence
      if (!isRecord(evidence)) return insight
      const quotes = evidence.quotes
      if (!Array.isArray(quotes)) return insight

      return {
        ...insight,
        evidence: {
          ...evidence,
          quotes: quotes.map(patchQuote),
        },
      }
    })
  }

  const semanticBiomarkers = next.semanticBiomarkers
  if (isRecord(semanticBiomarkers) && Array.isArray(semanticBiomarkers.evidenceQuotes)) {
    next.semanticBiomarkers = {
      ...semanticBiomarkers,
      evidenceQuotes: (semanticBiomarkers.evidenceQuotes as unknown[]).map(patchQuote),
    }
  }

  return next
}

function buildSynthesisUserPrompt(body: SynthesizeRequest & { _meta: { truncated: boolean; messagesUsed: number; journalEntriesUsed: number } }): string {
  const { session, journalEntries, _meta } = body

  const headerLines: string[] = [
    `SESSION:`,
    `- sessionId: ${session.id}`,
    `- startedAt: ${session.startedAt}`,
    `- endedAt: ${session.endedAt ?? "unknown"}`,
    `- durationSeconds: ${session.duration ?? "unknown"}`,
    `- mismatchCount: ${session.mismatchCount ?? "unknown"}`,
  ]

  if (session.acousticMetrics) {
    headerLines.push(
      ``,
      `VOICE SUMMARY (session-level):`,
      `- stress: ${session.acousticMetrics.stressScore}/100 (${session.acousticMetrics.stressLevel})`,
      `- fatigue: ${session.acousticMetrics.fatigueScore}/100 (${session.acousticMetrics.fatigueLevel})`,
      `- confidence: ${Math.round(session.acousticMetrics.confidence * 100)}%`
    )
  }

  headerLines.push(
    ``,
    `INPUT TRANSPARENCY:`,
    `- transcriptMessagesUsed: ${_meta.messagesUsed}/${session.messages.length}`,
    `- journalEntriesUsed: ${_meta.journalEntriesUsed}/${journalEntries?.length ?? 0}`,
    `- truncated: ${_meta.truncated ? "yes" : "no"}`,
    ``,
    `JOURNAL ENTRIES:`
  )

  const journalLines =
    journalEntries && journalEntries.length > 0
      ? journalEntries.slice(0, _meta.journalEntriesUsed).map((entry, i) => {
          const prompt = truncateText(entry.prompt, 180)
          const content = truncateText(entry.content, 800)
          return [
            `${i + 1}) [${entry.category}] ${prompt}`,
            `   "${content}"`,
          ].join("\n")
        })
      : ["(none)"]

  const transcriptLines: string[] = [
    ``,
    `TRANSCRIPT:`,
    ...session.messages.slice(session.messages.length - _meta.messagesUsed).map((m) => {
      const mismatch =
        m.mismatch && m.mismatch.detected
          ? ` [mismatch: text=${m.mismatch.semanticSignal} voice=${m.mismatch.acousticSignal} conf=${Math.round(m.mismatch.confidence * 100)}%]`
          : ""
      return `- [${m.id}] (${m.timestamp}) ${m.role}: ${truncateText(m.content, 900)}${mismatch}`
    }),
  ]

  return [...headerLines, ...journalLines, ...transcriptLines].join("\n")
}

type ModelSynthesisOutput = {
  narrative: string
  insights: Array<{
    title: string
    description: string
    evidence: {
      quotes: CheckInSynthesisEvidenceQuote[]
      voice: string[]
      journal: string[]
    }
  }>
  suggestions: Array<{
    content: string
    rationale: string
    duration: number
    category: "break" | "exercise" | "mindfulness" | "social" | "rest"
    linkedInsightIndexes: number[]
  }>
  semanticBiomarkers?: {
    stressScore: number
    fatigueScore: number
    confidence: number
    notes: string
    evidenceQuotes?: CheckInSynthesisEvidenceQuote[]
  }
}

function normalizeModelOutput(sessionId: string, inputMeta: CheckInSynthesis["meta"]["input"], output: ModelSynthesisOutput): CheckInSynthesis {
  const now = new Date().toISOString()

  const insights = output.insights.map((insight, index) => {
    const id = `checkin_${sessionId}_insight${index + 1}`
    return {
      id,
      title: truncateText(insight.title, 80),
      description: truncateText(insight.description, 500),
      evidence: {
        quotes: (insight.evidence.quotes ?? [])
          .slice(0, 3)
          .map((q) => ({
            ...(q.messageId ? { messageId: String(q.messageId).slice(0, 200) } : {}),
            role: q.role,
            text: truncateText(q.text, 200),
          })),
        voice: (insight.evidence.voice ?? []).slice(0, 4).map((v) => truncateText(v, 160)),
        journal: (insight.evidence.journal ?? []).slice(0, 3).map((j) => truncateText(j, 200)),
      },
    }
  })

  const suggestions = output.suggestions.map((suggestion, index) => {
    const id = `checkin_${sessionId}_suggestion${index + 1}`
    const linkedInsightIds = (suggestion.linkedInsightIndexes ?? [])
      .map((idx) => insights[idx - 1]?.id)
      .filter((v): v is string => typeof v === "string")

    return {
      id,
      content: truncateText(suggestion.content, 700),
      rationale: truncateText(suggestion.rationale, 900),
      duration: suggestion.duration,
      category: suggestion.category,
      linkedInsightIds: linkedInsightIds.length > 0 ? linkedInsightIds : insights.slice(0, 1).map((i) => i.id),
    }
  })

  const semanticBiomarkers = (() => {
    if (!output.semanticBiomarkers) return undefined

    const stressScore = Number(output.semanticBiomarkers.stressScore)
    const fatigueScore = Number(output.semanticBiomarkers.fatigueScore)
    const confidence = Number(output.semanticBiomarkers.confidence)
    const notes = output.semanticBiomarkers.notes
    const evidenceQuotes = output.semanticBiomarkers.evidenceQuotes

    if (!Number.isFinite(stressScore) || !Number.isFinite(fatigueScore) || !Number.isFinite(confidence)) {
      return undefined
    }

    if (typeof notes !== "string" || notes.trim().length === 0) {
      return undefined
    }

    const normalizedEvidenceQuotes = Array.isArray(evidenceQuotes)
      ? evidenceQuotes
          .slice(0, 3)
          .map((q) => ({
            ...(q.messageId ? { messageId: String(q.messageId).slice(0, 200) } : {}),
            role: q.role,
            text: truncateText(q.text, 200),
          }))
      : undefined

    return {
      stressScore: Math.max(0, Math.min(100, Math.round(stressScore))),
      fatigueScore: Math.max(0, Math.min(100, Math.round(fatigueScore))),
      confidence: Math.max(0, Math.min(1, confidence)),
      notes: truncateText(notes, 280),
      ...(normalizedEvidenceQuotes ? { evidenceQuotes: normalizedEvidenceQuotes } : {}),
    }
  })()

  return {
    narrative: truncateText(output.narrative, 900),
    insights,
    suggestions,
    ...(semanticBiomarkers ? { semanticBiomarkers } : {}),
    meta: {
      model: "gemini-3-flash-preview",
      generatedAt: now,
      input: inputMeta,
    },
  }
}

async function generateSynthesis(apiKey: string, body: SynthesizeRequest): Promise<CheckInSynthesis> {
  // Cap inputs to keep latency + tokens predictable (production-friendly).
  const messagesTotal = body.session.messages.length
  const journalEntriesTotal = body.journalEntries?.length ?? 0
  const messagesUsed = Math.min(messagesTotal, 60)
  const journalEntriesUsed = Math.min(journalEntriesTotal, 5)
  const truncated = messagesUsed < messagesTotal || journalEntriesUsed < journalEntriesTotal

  const userPrompt = buildSynthesisUserPrompt({
    ...body,
    _meta: { truncated, messagesUsed, journalEntriesUsed },
  })

  const request: GeminiRequest = {
    systemInstruction: {
      parts: [{ text: CHECK_IN_SYNTHESIS_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: CHECK_IN_SYNTHESIS_SCHEMA,
    },
  }

  const data = await callGeminiAPI(apiKey, request, 35_000)

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from Gemini API")
  }

  const text = data.candidates[0]?.content?.parts?.[0]?.text
  if (typeof text !== "string") {
    throw new Error("Gemini response parse error: missing text")
  }

  const parsed = parseGeminiJson<ModelSynthesisOutput>(text)

  const patched = ensureMessageIds(parsed, body.session.messages)
  const validated = ModelSynthesisOutputSchema.safeParse(patched)
  if (!validated.success) {
    throw new Error(`Gemini response parse error: Invalid response structure (${validated.error.issues[0]?.message ?? "unknown"})`)
  }

  const inputMeta: CheckInSynthesis["meta"]["input"] = {
    messagesTotal,
    messagesUsed,
    journalEntriesTotal,
    journalEntriesUsed,
    truncated,
  }

  return normalizeModelOutput(body.session.id, inputMeta, validated.data)
}

// ============================================
// Handlers
// ============================================

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 250_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    const rateLimited = maybeRateLimitKanariGeminiKey(request, "synthesize")
    if (rateLimited) return rateLimited

    const bodyJson = await request.json()
    const parsed = SynthesizeRequestSchema.safeParse(bodyJson)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const apiKey = validateAPIKey(getAPIKeyFromRequest(request))

    const synthesis = await generateSynthesis(apiKey, parsed.data)

    return NextResponse.json({ synthesis })
  } catch (error) {
    const message = error instanceof Error ? sanitizeErrorMessage(error.message) : "Unknown error"
    console.error("Check-in synthesis error:", message)

    if (error instanceof Error) {
      if (message.includes("API key")) {
        return NextResponse.json(
          { error: "API key configuration error. Please add your Gemini API key in Settings." },
          { status: 401 }
        )
      }

      if (
        message.includes("Gemini API error") ||
        message.includes("Gemini response parse error")
      ) {
        return NextResponse.json(
          { error: "External API error", details: message },
          { status: 502 }
        )
      }

      if (message.toLowerCase().includes("timed out") || message.toLowerCase().includes("timeout")) {
        return NextResponse.json(
          { error: "Gemini API request timed out", details: message },
          { status: 504 }
        )
      }

      if (
        message.toLowerCase().includes("fetch failed") ||
        message.includes("ECONN") ||
        message.includes("ENOTFOUND") ||
        message.includes("EAI_AGAIN")
      ) {
        return NextResponse.json(
          { error: "Unable to reach Gemini API", details: message },
          { status: 502 }
        )
      }
    }

    return NextResponse.json(
      { error: "Failed to synthesize check-in" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gemini/synthesize
 *
 * Lightweight health check.
 */
export async function GET(request: NextRequest) {
  try {
    const hasApiKey = !!getAPIKeyFromRequest(request)

    return NextResponse.json({
      status: "ok",
      configured: hasApiKey,
      endpoint: "/api/gemini/synthesize",
      methods: ["POST"],
    })
  } catch {
    return NextResponse.json(
      { status: "error", error: "Health check failed" },
      { status: 500 }
    )
  }
}
