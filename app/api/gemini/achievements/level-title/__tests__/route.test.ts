/**
 * Level Title API Route Tests
 *
 * Locks in behavior for /api/gemini/achievements/level-title so internal refactors
 * don't change user-visible error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
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

const validBody = {
  level: 2,
  totalPoints: 110,
  currentDailyCompletionStreak: 3,
  longestDailyCompletionStreak: 5,
}

function createRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  contentLength?: number
): NextRequest {
  return new NextRequest("http://localhost:3000/api/gemini/achievements/level-title", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(contentLength !== undefined ? { "content-length": String(contentLength) } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/gemini/achievements/level-title", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for invalid request body", async () => {
    const request = createRequest({ nope: true }, { "X-Gemini-Api-Key": "AIzaTestKey123" })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("Invalid")
  })

  it("returns 401 when API key is missing", async () => {
    const request = createRequest(validBody)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain("API key")
  })

  it("returns 413 when request body is too large", async () => {
    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" }, 50_001)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(413)
    expect(data.error).toContain("too large")
  })

  it("returns 502 for Gemini API errors", async () => {
    mockCallGeminiAPI.mockRejectedValueOnce(new Error("Gemini API error (403): {\"error\":\"forbidden\"}"))

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain("External API error")
    expect(data.details).toContain("Gemini API error")
  })

  it("returns 200 with a title when Gemini succeeds", async () => {
    const modelOutput = {
      title: "Steady Builder",
      reasoning: "Test reasoning",
    }

    mockCallGeminiAPI.mockResolvedValueOnce({
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify(modelOutput) }], role: "model" },
          finishReason: "STOP",
          index: 0,
        },
      ],
    })

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe("Steady Builder")
    expect(data.reasoning).toBe("Test reasoning")
  })
})
