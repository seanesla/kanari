/**
 * Check-In Context API Route Tests
 *
 * Tests for the /api/gemini/check-in-context endpoint that generates a
 * context summary for AI-initiated check-in conversations.
 *
 * These tests verify:
 * - Request validation
 * - API key handling (header only; no env fallback)
 * - Error mapping for timeouts/network failures
 * - Successful response shape
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
  return new NextRequest("http://localhost:3000/api/gemini/check-in-context", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(contentLength !== undefined ? { "content-length": String(contentLength) } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

const validBody = {
  sessionCount: 0,
  sessionSummaries: [],
  timeContext: {
    currentTime: "2025-12-30 1:53 PM",
    dayOfWeek: "Tuesday",
    timeOfDay: "afternoon",
    daysSinceLastCheckIn: 1,
  },
  voiceTrends: {},
}

describe("POST /api/gemini/check-in-context", () => {
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
    expect(data.error).toContain("Invalid context request format")
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
      500_001
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(413)
    expect(data.error).toContain("too large")
  })

  it("returns 504 on Gemini timeout", async () => {
    mockCallGeminiAPI.mockRejectedValueOnce(
      new Error("Gemini API request timed out after 30000ms")
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

  it("returns 200 with summary when Gemini succeeds", async () => {
    const summary = {
      patternSummary: "Afternoon check-in, first session.",
      keyObservations: [],
      suggestedOpener: "Hey! How are you doing this afternoon?",
      contextNotes: "Keep it warm and low-pressure.",
    }

    mockCallGeminiAPI.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(summary) }],
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
    expect(data.summary).toEqual(summary)
  })
})

