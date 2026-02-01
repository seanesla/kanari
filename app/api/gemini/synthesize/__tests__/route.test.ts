/**
 * Check-In Synthesis API Route Tests
 *
 * Tests for the /api/gemini/synthesize endpoint.
 *
 * These tests verify:
 * - Request validation and size limits
 * - API key handling (header-only; no env fallback)
 * - Error mapping for timeouts/network failures/Gemini errors
 * - Deterministic ID + meta generation on success
 * - Input truncation metadata (performance guardrails)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "../route"

vi.mock("@/lib/gemini/client", () => ({
  validateAPIKey: vi.fn((key: string | undefined) => {
    if (!key) throw new Error("Gemini API key not configured")
    if (!key.startsWith("AIza")) throw new Error("Invalid API key format")
    return key
  }),
  getAPIKeyFromRequest: vi.fn((request: Request) => {
    return request.headers.get("X-Gemini-Api-Key") || undefined
  }),
  callGeminiAPI: vi.fn(),
}))

import { callGeminiAPI } from "@/lib/gemini/client"
const mockCallGeminiAPI = vi.mocked(callGeminiAPI)

function createRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  contentLength?: number
): NextRequest {
  return new NextRequest("http://localhost:3000/api/gemini/synthesize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(contentLength !== undefined ? { "content-length": String(contentLength) } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

const nowIso = new Date().toISOString()

const validBody = {
  session: {
    id: "sess_123",
    startedAt: nowIso,
    endedAt: nowIso,
    duration: 120,
    mismatchCount: 1,
    acousticMetrics: {
      stressScore: 72,
      fatigueScore: 55,
      stressLevel: "elevated",
      fatigueLevel: "tired",
      confidence: 0.8,
    },
    messages: [
      {
        id: "m1",
        role: "user",
        content: "I keep saying I'm fine, but I'm honestly stretched thin.",
        timestamp: nowIso,
        mismatch: {
          detected: true,
          semanticSignal: "neutral",
          acousticSignal: "stressed",
          confidence: 0.82,
          suggestionForGemini: null,
        },
      },
      {
        id: "m2",
        role: "assistant",
        content: "Thanks for sharing that. What's been taking most of your energy lately?",
        timestamp: nowIso,
      },
    ],
  },
  journalEntries: [
    {
      id: "j1",
      createdAt: nowIso,
      category: "reflection",
      prompt: "What's on your mind right now?",
      content: "I feel guilty taking breaks, even when I need them.",
      checkInSessionId: "sess_123",
    },
  ],
}

describe("POST /api/gemini/synthesize", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("returns 400 for invalid request body", async () => {
    const request = createRequest(
      { not: "valid" },
      { "X-Gemini-Api-Key": "AIzaTestKey123" }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("Invalid request body")
  })

  it("returns 401 when API key is missing", async () => {
    const request = createRequest(validBody)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain("API key")
  })

  it("returns 413 when request body is too large", async () => {
    const request = createRequest(
      validBody,
      { "X-Gemini-Api-Key": "AIzaTestKey123" },
      250_001
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(413)
    expect(data.error).toContain("too large")
  })

  it("returns 504 on Gemini timeout", async () => {
    mockCallGeminiAPI.mockRejectedValueOnce(
      new Error("Gemini API request timed out after 35000ms")
    )

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(504)
    expect(data.error).toContain("timed out")
  })

  it("returns 502 on network fetch failure", async () => {
    mockCallGeminiAPI.mockRejectedValueOnce(new Error("fetch failed"))

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain("reach")
  })

  it("returns 502 on Gemini API error response", async () => {
    mockCallGeminiAPI.mockRejectedValueOnce(
      new Error("Gemini API error (403): {\"error\":\"forbidden\"}")
    )

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain("External API error")
    expect(data.details).toContain("Gemini API error")
  })

  it("returns 200 with synthesis when Gemini succeeds (adds ids + meta)", async () => {
    const modelOutput = {
      narrative: "You described feeling stretched thin and guilty about breaks, despite needing them.",
      insights: [
        {
          title: "You’re carrying more than you admit",
          description: "You downplay stress out loud, but your words and tone suggest real strain.",
          evidence: {
            quotes: [{ messageId: "m1", role: "user", text: "I'm honestly stretched thin." }],
            voice: ["Mismatch detected: neutral words but stressed delivery"],
            journal: ["You wrote that breaks trigger guilt."],
          },
        },
        {
          title: "Break guilt is a blocker",
          description: "Taking recovery time feels emotionally costly, which makes burnout risk sneakier.",
          evidence: {
            quotes: [{ messageId: "m1", role: "user", text: "I keep saying I'm fine" }],
            voice: ["Stress score was elevated in this session"],
            journal: [],
          },
        },
      ],
      suggestions: [
        {
          content: "Schedule a 10-minute ‘permission break’ today. Write one sentence: what breaks protect (sleep, focus, mood).",
          rationale: "This targets break guilt directly and creates a small boundary that matches the stress signals you showed.",
          duration: 10,
          category: "break",
          linkedInsightIndexes: [2],
        },
      ],
      semanticBiomarkers: {
        stressScore: 70,
        fatigueScore: 60,
        confidence: 0.72,
        notes: "From the transcript, you sound under sustained workload pressure and describe running thin.",
        evidenceQuotes: [{ messageId: "m1", role: "user", text: "I'm honestly stretched thin." }],
      },
    }

    mockCallGeminiAPI.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(modelOutput) }],
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
    })

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.synthesis).toBeTruthy()

    expect(data.synthesis.insights[0].id).toBe("checkin_sess_123_insight1")
    expect(data.synthesis.insights[1].id).toBe("checkin_sess_123_insight2")
    expect(data.synthesis.suggestions[0].id).toBe("checkin_sess_123_suggestion1")
    expect(data.synthesis.suggestions[0].linkedInsightIds).toEqual(["checkin_sess_123_insight2"])

    expect(data.synthesis.meta.model).toBe("gemini-3-flash-preview")
    expect(data.synthesis.meta.input).toEqual({
      messagesTotal: 2,
      messagesUsed: 2,
      journalEntriesTotal: 1,
      journalEntriesUsed: 1,
      truncated: false,
    })
  })

  it("does not fail when a quote is missing messageId and cannot be matched", async () => {
    const modelOutput = {
      narrative: "Summary.",
      insights: [
        {
          title: "Insight A",
          description: "Desc A",
          evidence: { quotes: [{ role: "user", text: "This quote is not in the transcript." }], voice: [], journal: [] },
        },
        {
          title: "Insight B",
          description: "Desc B",
          evidence: { quotes: [{ messageId: "m1", role: "user", text: "stretched thin" }], voice: [], journal: [] },
        },
      ],
      suggestions: [
        {
          content: "Suggestion",
          rationale: "Rationale",
          duration: 10,
          category: "break",
          linkedInsightIndexes: [1],
        },
      ],
      semanticBiomarkers: {
        stressScore: 50,
        fatigueScore: 50,
        confidence: 0.4,
        notes: "Notes.",
        evidenceQuotes: [{ role: "user", text: "Also not in transcript" }],
      },
    }

    mockCallGeminiAPI.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(modelOutput) }],
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
    })

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.synthesis.insights[0].evidence.quotes[0].messageId).toBeUndefined()
    expect(data.synthesis.semanticBiomarkers.evidenceQuotes[0].messageId).toBeUndefined()
  })

  it("does not infer messageId for ambiguous short quotes", async () => {
    const bodyWithDuplicates = {
      ...validBody,
      session: {
        ...validBody.session,
        messages: [
          { id: "m1", role: "user", content: "I'm fine.", timestamp: nowIso },
          { id: "m2", role: "assistant", content: "Okay.", timestamp: nowIso },
          { id: "m3", role: "user", content: "I'm fine, really.", timestamp: nowIso },
          { id: "m4", role: "assistant", content: "Thanks.", timestamp: nowIso },
        ],
      },
    }

    const modelOutput = {
      narrative: "Summary.",
      insights: [
        {
          title: "Insight A",
          description: "Desc A",
          evidence: { quotes: [{ role: "user", text: "I'm fine" }], voice: [], journal: [] },
        },
        {
          title: "Insight B",
          description: "Desc B",
          evidence: { quotes: [{ messageId: "m2", role: "assistant", text: "Okay" }], voice: [], journal: [] },
        },
      ],
      suggestions: [
        {
          content: "Suggestion",
          rationale: "Rationale",
          duration: 10,
          category: "break",
          linkedInsightIndexes: [1],
        },
      ],
      semanticBiomarkers: {
        stressScore: 50,
        fatigueScore: 50,
        confidence: 0.4,
        notes: "Notes.",
        evidenceQuotes: [{ messageId: "m1", role: "user", text: "I'm fine" }],
      },
    }

    mockCallGeminiAPI.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(modelOutput) }],
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
    })

    const request = createRequest(bodyWithDuplicates, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.synthesis.insights[0].evidence.quotes[0].messageId).toBeUndefined()
  })

  it("infers messageId when a quote matches exactly one transcript message", async () => {
    const modelOutput = {
      narrative: "Summary.",
      insights: [
        {
          title: "Insight A",
          description: "Desc A",
          evidence: { quotes: [{ role: "user", text: "I'm honestly stretched thin" }], voice: [], journal: [] },
        },
        {
          title: "Insight B",
          description: "Desc B",
          evidence: { quotes: [{ messageId: "m2", role: "assistant", text: "What's been taking most of your energy" }], voice: [], journal: [] },
        },
      ],
      suggestions: [
        {
          content: "Suggestion",
          rationale: "Rationale",
          duration: 10,
          category: "break",
          linkedInsightIndexes: [1],
        },
      ],
      semanticBiomarkers: {
        stressScore: 50,
        fatigueScore: 50,
        confidence: 0.4,
        notes: "Notes.",
        evidenceQuotes: [{ messageId: "m1", role: "user", text: "stretched thin" }],
      },
    }

    mockCallGeminiAPI.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(modelOutput) }],
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
    })

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.synthesis.insights[0].evidence.quotes[0].messageId).toBe("m1")
  })

  it("sets truncation meta when inputs exceed caps", async () => {
    const bigSession = {
      ...validBody.session,
      messages: Array.from({ length: 80 }).map((_, i) => ({
        id: `m${i + 1}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`,
        timestamp: nowIso,
      })),
    }

    const bigBody = {
      ...validBody,
      session: bigSession,
      journalEntries: Array.from({ length: 10 }).map((_, i) => ({
        id: `j${i + 1}`,
        createdAt: nowIso,
        category: "reflection",
        prompt: "Prompt",
        content: `Entry ${i + 1}`,
        checkInSessionId: "sess_123",
      })),
    }

    const minimalModelOutput = {
      narrative: "Summary.",
      insights: [
        {
          title: "Insight A",
          description: "Desc A",
          evidence: { quotes: [{ messageId: "m1", role: "user", text: "Quote" }], voice: [], journal: [] },
        },
        {
          title: "Insight B",
          description: "Desc B",
          evidence: { quotes: [{ messageId: "m1", role: "user", text: "Quote" }], voice: [], journal: [] },
        },
      ],
      suggestions: [
        {
          content: "Suggestion",
          rationale: "Rationale",
          duration: 10,
          category: "break",
          linkedInsightIndexes: [1],
        },
      ],
      semanticBiomarkers: {
        stressScore: 50,
        fatigueScore: 50,
        confidence: 0.4,
        notes: "The transcript is brief and ambiguous, so this estimate is low confidence.",
        evidenceQuotes: [{ messageId: "m1", role: "user", text: "Quote" }],
      },
    }

    mockCallGeminiAPI.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(minimalModelOutput) }],
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
    })

    const request = createRequest(bigBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.synthesis.meta.input).toEqual({
      messagesTotal: 80,
      messagesUsed: 60,
      journalEntriesTotal: 10,
      journalEntriesUsed: 5,
      truncated: true,
    })
  })
})
