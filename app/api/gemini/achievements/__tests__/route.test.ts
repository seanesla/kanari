/**
 * Achievements API Route Tests
 *
 * Locks in behavior for /api/gemini/achievements so internal refactors
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

const validStats = {
  todayISO: "2026-01-15",
  timeZone: "UTC",
  requestedCount: 2,
  carryOverCount: 0,
  totalCheckIns: 5,
  checkInsToday: 1,
  checkInStreak: 2,
  longestCheckInStreak: 4,
  daysActive: 4,
  averageStressScore: 55,
  averageFatigueScore: 48,
  stressTrend: "stable",
  fatigueTrend: "improving",
  activeSuggestionsCount: 3,
  suggestionsCompletedTotal: 7,
  suggestionsCompletedToday: 1,
  suggestionsScheduledToday: 0,
  favoriteCategory: null,
  completionRate: 0.5,
  totalPoints: 90,
  level: 1,
  currentDailyCompletionStreak: 0,
  recentDailyTitles: ["First Check-In"],
}

function createRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  contentLength?: number
): NextRequest {
  return new NextRequest("http://localhost:3000/api/gemini/achievements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(contentLength !== undefined ? { "content-length": String(contentLength) } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/gemini/achievements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for invalid request body", async () => {
    const request = createRequest({ not: "valid" }, { "X-Gemini-Api-Key": "AIzaTestKey123" })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("Invalid user stats")
  })

  it("returns 401 when API key is missing", async () => {
    const request = createRequest(validStats)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain("API key")
  })

  it("returns 413 when request body is too large", async () => {
    const request = createRequest(validStats, { "X-Gemini-Api-Key": "AIzaTestKey123" }, 100_001)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(413)
    expect(data.error).toContain("too large")
  })

  it("returns 502 for Gemini API errors", async () => {
    mockCallGeminiAPI.mockRejectedValueOnce(new Error("Gemini API error (403): {\"error\":\"forbidden\"}"))

    const request = createRequest(validStats, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain("External API error")
    expect(data.details).toContain("Gemini API error")
  })

  it("returns 200 with achievements when Gemini succeeds", async () => {
    const modelOutput = {
      achievements: [
        {
          type: "challenge",
          category: "consistency",
          title: "Do a check-in",
          description: "Record one check-in today.",
          emoji: "\ud83c\udfc6",
          points: 20,
          tracking: { key: "do_check_in", target: 1 },
        },
        {
          type: "badge",
          category: "recovery",
          title: "Small Reset",
          description: "You made space for recovery.",
          emoji: "\ud83c\udf3f",
          points: 15,
        },
      ],
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

    const request = createRequest(validStats, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.achievements).toHaveLength(2)
    expect(data.reasoning).toBe("Test reasoning")
  })
})
