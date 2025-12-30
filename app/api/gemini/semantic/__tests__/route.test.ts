/**
 * Semantic Analysis API Route Tests
 *
 * Tests for the /api/gemini/semantic endpoint that handles emotion detection
 * from audio recordings using the Gemini API.
 *
 * These tests verify:
 * - Request validation (audio format, size limits, base64 encoding)
 * - API key handling (header only; no env fallback)
 * - Error handling for various failure scenarios
 * - Response structure matches GeminiSemanticAnalysis type
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST, GET } from "../route"

// Mock the Gemini client module
vi.mock("@/lib/gemini/client", () => ({
  validateAPIKey: vi.fn((key: string | undefined) => {
    if (!key) throw new Error("Gemini API key not configured")
    if (!key.startsWith("AIza")) throw new Error("Invalid API key format")
    return key
  }),
  getAPIKeyFromRequest: vi.fn((request: Request) => {
    return request.headers.get("X-Gemini-Api-Key") || undefined
  }),
  analyzeAudioSemantic: vi.fn(),
}))

// Import after mocking
import { analyzeAudioSemantic } from "@/lib/gemini/client"
const mockAnalyzeAudioSemantic = vi.mocked(analyzeAudioSemantic)

/**
 * Helper to create a mock NextRequest with JSON body
 */
function createRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost:3000/api/gemini/semantic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

/**
 * Helper to create valid base64-encoded audio data
 * Creates a minimal valid base64 string for testing
 */
function createValidBase64Audio(length: number = 100): string {
  // Create array of bytes and encode to base64
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = i % 256
  }
  // Use btoa with binary string
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Mock emotion analysis response matching GeminiSemanticAnalysis type
 */
const mockAnalysisResponse = {
  segments: [
    { timestamp: "00:05", content: "Hello, how are you?", emotion: "neutral" as const },
    { timestamp: "00:15", content: "I'm feeling great today!", emotion: "happy" as const },
  ],
  overallEmotion: "happy" as const,
  emotionConfidence: 0.85,
  observations: [
    {
      type: "positive_cue" as const,
      observation: "Speaker shows positive affect",
      relevance: "high" as const,
    },
  ],
  stressInterpretation: "Low stress indicators detected",
  fatigueInterpretation: "Energy levels appear normal",
  summary: "Speaker demonstrates positive emotional state with clear speech patterns.",
}

describe("POST /api/gemini/semantic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation
    mockAnalyzeAudioSemantic.mockResolvedValue(mockAnalysisResponse)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("request validation", () => {
    it("returns 400 when audio is missing", async () => {
      const request = createRequest(
        { mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("audio")
    })

    it("returns 400 when audio is not a string", async () => {
      const request = createRequest(
        { audio: 12345, mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("audio")
    })

    it("returns 400 when audio is empty string", async () => {
      const request = createRequest(
        { audio: "", mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("audio")
    })

    it("returns 400 when mimeType is missing", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio() },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("mimeType")
    })

    it("returns 400 when mimeType is not a string", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: 123 },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("mimeType")
    })
  })

  describe("audio format validation", () => {
    it("accepts audio/wav format", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it("accepts audio/webm format", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/webm" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it("accepts audio/mp3 format", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/mp3" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it("accepts audio/ogg format", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/ogg" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it("rejects unsupported audio format", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/midi" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Unsupported audio format")
    })

    it("rejects non-audio MIME types", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "image/png" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Unsupported")
    })
  })

  describe("base64 validation", () => {
    it("returns 400 for invalid base64 encoding", async () => {
      const request = createRequest(
        { audio: "not-valid-base64!!!", mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("base64")
    })

    it("accepts valid base64 with padding", async () => {
      // Valid base64 with proper padding
      const validBase64 = btoa("test audio data")
      const request = createRequest(
        { audio: validBase64, mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })

  describe("audio size limits", () => {
    it("returns 400 when audio exceeds 10MB", async () => {
      // Create base64 string larger than 10MB
      const largeBase64 = "A".repeat(11 * 1024 * 1024) // ~11MB
      const request = createRequest(
        { audio: largeBase64, mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("too large")
    })

    it("accepts audio under 10MB limit", async () => {
      // Create base64 string under limit (~5MB)
      const request = createRequest(
        { audio: createValidBase64Audio(1000), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })

  describe("API key handling", () => {
    it("returns 401 when no API key is provided", async () => {
      const request = createRequest({
        audio: createValidBase64Audio(),
        mimeType: "audio/wav",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain("API key")
    })

    it("uses API key from X-Gemini-Api-Key header", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      await POST(request)

      expect(mockAnalyzeAudioSemantic).toHaveBeenCalledWith(
        "AIzaTestKey123",
        expect.any(String),
        "audio/wav"
      )
    })
  })

  describe("successful response", () => {
    it("returns 200 with analysis results", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockAnalysisResponse)
    })

    it("returns correct emotion analysis structure", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      // Verify response matches GeminiSemanticAnalysis type
      expect(data).toHaveProperty("segments")
      expect(data).toHaveProperty("overallEmotion")
      expect(data).toHaveProperty("emotionConfidence")
      expect(data).toHaveProperty("observations")
      expect(data).toHaveProperty("stressInterpretation")
      expect(data).toHaveProperty("fatigueInterpretation")
      expect(data).toHaveProperty("summary")
    })

    it("segments have correct structure", async () => {
      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(Array.isArray(data.segments)).toBe(true)
      if (data.segments.length > 0) {
        const segment = data.segments[0]
        expect(segment).toHaveProperty("timestamp")
        expect(segment).toHaveProperty("content")
        expect(segment).toHaveProperty("emotion")
      }
    })
  })

  describe("error handling", () => {
    it("returns 502 for Gemini API errors", async () => {
      mockAnalyzeAudioSemantic.mockRejectedValue(
        new Error("Gemini API error: Rate limit exceeded")
      )

      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.error).toContain("External API error")
    })

    it("returns 502 for structured output parsing errors", async () => {
      mockAnalyzeAudioSemantic.mockRejectedValue(
        new Error("Gemini response parse error: Missing segments")
      )

      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.error).toContain("External API error")
    })

    it("returns 500 for unknown errors", async () => {
      mockAnalyzeAudioSemantic.mockRejectedValue(new Error("Unknown error"))

      const request = createRequest(
        { audio: createValidBase64Audio(), mimeType: "audio/wav" },
        { "X-Gemini-Api-Key": "AIzaTestKey123" }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Internal server error")
    })
  })
})

describe("GET /api/gemini/semantic", () => {
  it("returns health check status", async () => {
    const request = new NextRequest("http://localhost:3000/api/gemini/semantic", {
      method: "GET",
      headers: {
        "X-Gemini-Api-Key": "AIzaTestKey123",
      },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe("ok")
    expect(data.endpoint).toBe("/api/gemini/semantic")
    expect(data.methods).toContain("POST")
  })

  it("indicates API key is configured when present", async () => {
    const request = new NextRequest("http://localhost:3000/api/gemini/semantic", {
      method: "GET",
      headers: {
        "X-Gemini-Api-Key": "AIzaTestKey123",
      },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(data.configured).toBe(true)
  })

  it("indicates API key is not configured when missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/gemini/semantic", {
      method: "GET",
    })

    const response = await GET(request)
    const data = await response.json()

    expect(data.configured).toBe(false)
    expect(data.source).toBe("none")
  })
})
