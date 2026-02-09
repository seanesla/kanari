/**
 * Summarize Thinking API Route Tests
 *
 * Locks in behavior for /api/gemini/summarize-thinking and ensures
 * non-audio runtime summarization stays on Gemini 3 Flash.
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
}))

function createRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  contentLength?: number
): NextRequest {
  return new NextRequest("http://localhost:3000/api/gemini/summarize-thinking", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(contentLength !== undefined ? { "content-length": String(contentLength) } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/gemini/summarize-thinking", () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns 401 when API key is missing", async () => {
    const request = createRequest({ thinkingText: "Valid text" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain("API key")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns 400 when thinkingText is missing", async () => {
    const request = createRequest({}, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("thinkingText")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns 400 when thinkingText is too long", async () => {
    const request = createRequest(
      { thinkingText: "x".repeat(10_001) },
      { "X-Gemini-Api-Key": "AIzaTestKey123" }
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("too long")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("uses Gemini 3 Flash and returns summary", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Thinking about pacing and checking your workload." }],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )

    const request = createRequest(
      { thinkingText: "x".repeat(300) },
      { "X-Gemini-Api-Key": "AIzaTestKey123" }
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.summary).toBe("Thinking about pacing and checking your workload.")
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [endpoint] = mockFetch.mock.calls[0]
    expect(endpoint).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"
    )
  })

  it("returns 502 when Gemini API responds with error", async () => {
    mockFetch.mockResolvedValueOnce(new Response("upstream failed", { status: 500 }))

    const request = createRequest(
      { thinkingText: "x".repeat(300) },
      { "X-Gemini-Api-Key": "AIzaTestKey123" }
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain("Failed to generate summary")
  })
})
