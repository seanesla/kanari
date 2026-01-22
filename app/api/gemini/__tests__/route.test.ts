/**
 * Suggestions API Route Tests
 *
 * Covers both legacy suggestion generation and diff-aware mode.
 * These tests lock in validation + error mapping so refactors can be done safely.
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
  generateSuggestions: vi.fn(),
  generateDiffAwareSuggestions: vi.fn(),
}))

import { generateSuggestions, generateDiffAwareSuggestions } from "@/lib/gemini/client"

const mockGenerateSuggestions = vi.mocked(generateSuggestions)
const mockGenerateDiffAwareSuggestions = vi.mocked(generateDiffAwareSuggestions)

function createRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  contentLength?: number
): NextRequest {
  return new NextRequest("http://localhost:3000/api/gemini", {
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
  stressScore: 50,
  stressLevel: "moderate",
  fatigueScore: 45,
  fatigueLevel: "normal",
  trend: "stable",
}

describe("POST /api/gemini", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 413 when request body is too large", async () => {
    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" }, 250_001)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(413)
    expect(data.error).toContain("too large")
  })

  it("returns 400 for missing required fields", async () => {
    const request = createRequest({})

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("required")
  })

  it("returns 400 when diffMode is not a boolean", async () => {
    const request = createRequest({ ...validBody, diffMode: "true" }, { "X-Gemini-Api-Key": "AIzaTestKey123" })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("diffMode")
  })

  it("returns 401 when API key is missing", async () => {
    const request = createRequest(validBody)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain("API key")
  })

  it("returns 502 for Gemini API errors", async () => {
    mockGenerateSuggestions.mockRejectedValueOnce(new Error("Gemini API error (403): {\"error\":\"forbidden\"}"))

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain("External API error")
    expect(data.details).toContain("Gemini API error")
  })

  it("returns 200 with suggestions in legacy mode", async () => {
    mockGenerateSuggestions.mockResolvedValueOnce({
      suggestions: [
        {
          content: "Take a 5 minute break.",
          rationale: "Short reset.",
          duration: 5,
          category: "break",
        },
      ],
      grounding: undefined,
    })

    const request = createRequest(validBody, { "X-Gemini-Api-Key": "AIzaTestKey123" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.suggestions)).toBe(true)
    expect(data.suggestions).toHaveLength(1)
    expect(data.suggestions[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        content: "Take a 5 minute break.",
        rationale: "Short reset.",
        duration: 5,
        category: "break",
        status: "pending",
        createdAt: expect.any(String),
      })
    )
  })

  it("returns 200 with diff suggestions when diffMode is enabled", async () => {
    mockGenerateDiffAwareSuggestions.mockResolvedValueOnce({
      suggestions: [
        {
          id: "s1",
          decision: "keep",
          content: "Existing suggestion",
          rationale: "Still good",
          duration: 10,
          category: "rest",
        },
      ],
      summary: { kept: 1, updated: 0, dropped: 0, added: 0 },
    })

    const request = createRequest(
      {
        ...validBody,
        diffMode: true,
        existingSuggestions: [
          {
            id: "existing1",
            content: "Existing suggestion",
            rationale: "Because",
            duration: 10,
            category: "rest",
            status: "pending",
            createdAt: "2026-01-15T00:00:00.000Z",
          },
        ],
      },
      { "X-Gemini-Api-Key": "AIzaTestKey123" }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.diffMode).toBe(true)
    expect(data.suggestions).toHaveLength(1)
    expect(data.summary).toEqual({ kept: 1, updated: 0, dropped: 0, added: 0 })
  })
})
