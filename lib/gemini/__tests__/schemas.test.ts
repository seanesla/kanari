/**
 * Schema Validation Tests
 *
 * Comprehensive tests for Zod schemas used in Gemini Live API communication.
 * Validates type safety and error handling for all message types.
 */

import { describe, test, expect, vi } from "vitest"
import {
  ServerMessageSchema,
  validateServerMessage,
  SessionInfoSchema,
  AudioInputRequestSchema,
  ToolResponseRequestSchema,
  ScheduleActivityArgsSchema,
  BreathingExerciseArgsSchema,
  StressGaugeArgsSchema,
  QuickActionsArgsSchema,
  JournalPromptArgsSchema,
} from "../schemas"

describe("ServerMessageSchema", () => {
  describe("valid messages", () => {
    test("should validate setupComplete message", () => {
      const message = { setupComplete: true }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.setupComplete).toBe(true)
      }
    })

    test("should validate setupComplete message (SDK object form)", () => {
      const message = { setupComplete: { sessionId: "sess_123" } }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.setupComplete).toEqual({ sessionId: "sess_123" })
      }
    })

    test("should validate serverContent with audio (inlineData)", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm",
                  data: "base64audiodata==",
                },
              },
            ],
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        const part = result.data.serverContent?.modelTurn?.parts?.[0]
        expect(part).toHaveProperty("inlineData")
        if (part && "inlineData" in part) {
          expect(part.inlineData.mimeType).toBe("audio/pcm")
          expect(part.inlineData.data).toBe("base64audiodata==")
        }
      }
    })

    test("should validate serverContent with text", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [
              {
                text: "Hello, how are you feeling today?",
              },
            ],
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        const part = result.data.serverContent?.modelTurn?.parts?.[0]
        expect(part).toHaveProperty("text")
        if (part && "text" in part) {
          expect(part.text).toBe("Hello, how are you feeling today?")
        }
      }
    })

    test("should validate serverContent with output transcription", () => {
      const message = {
        serverContent: {
          outputTranscription: {
            text: "Hello, how are you feeling today?",
            finished: false,
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.serverContent?.outputTranscription?.text).toBe(
          "Hello, how are you feeling today?"
        )
        expect(result.data.serverContent?.outputTranscription?.finished).toBe(false)
      }
    })

    test("should validate turnComplete signal", () => {
      const message = {
        serverContent: {
          turnComplete: true,
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.serverContent?.turnComplete).toBe(true)
      }
    })

    test("should validate interrupted signal", () => {
      const message = {
        serverContent: {
          interrupted: true,
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.serverContent?.interrupted).toBe(true)
      }
    })

    test("should validate inputTranscription (user speech)", () => {
      const message = {
        inputTranscription: {
          text: "I'm feeling a bit overwhelmed",
          isFinal: false,
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.inputTranscription?.text).toBe("I'm feeling a bit overwhelmed")
        expect(result.data.inputTranscription?.isFinal).toBe(false)
      }
    })

    test("should validate final inputTranscription", () => {
      const message = {
        inputTranscription: {
          text: "I'm feeling a bit overwhelmed",
          isFinal: true,
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.inputTranscription?.isFinal).toBe(true)
      }
    })

    test("should validate toolCall message", () => {
      const message = {
        toolCall: {
          functionCalls: [
            {
              name: "analyzeBurnoutRisk",
              args: { score: 7.5, factors: ["workload", "sleep"] },
            },
          ],
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        const call = result.data.toolCall?.functionCalls?.[0]
        expect(call?.name).toBe("analyzeBurnoutRisk")
        expect(call?.args).toEqual({ score: 7.5, factors: ["workload", "sleep"] })
      }
    })

    test("should validate toolResponse message", () => {
      const message = {
        toolResponse: {
          functionResponses: [
            {
              id: "call_123",
              name: "analyzeBurnoutRisk",
              response: { risk: "high", confidence: 0.85 },
            },
          ],
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        const response = result.data.toolResponse?.functionResponses?.[0]
        expect(response?.id).toBe("call_123")
        expect(response?.name).toBe("analyzeBurnoutRisk")
        expect(response?.response).toEqual({ risk: "high", confidence: 0.85 })
      }
    })

    test("should validate error message", () => {
      const message = {
        error: {
          code: 429,
          message: "Rate limit exceeded",
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.error?.code).toBe(429)
        expect(result.data.error?.message).toBe("Rate limit exceeded")
      }
    })

    test("should validate complex message with multiple fields", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [
              { text: "I understand." },
              {
                inlineData: {
                  mimeType: "audio/pcm",
                  data: "base64==",
                },
              },
            ],
          },
          outputTranscription: {
            text: "I understand.",
            finished: true,
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
    })

    test("should validate empty message (all fields optional)", () => {
      const message = {}
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
    })
  })

  describe("invalid messages", () => {
    test("should reject setupComplete with wrong type", () => {
      const message = { setupComplete: "true" } // should be boolean or object
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should reject inlineData without mimeType", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: {
                  data: "base64==", // missing mimeType
                },
              },
            ],
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should reject inlineData without data", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm", // missing data
                },
              },
            ],
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should reject part with both text and inlineData", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [
              {
                text: "Hello",
                inlineData: {
                  mimeType: "audio/pcm",
                  data: "base64==",
                },
              },
            ],
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      // Union schema should reject having both fields defined
      expect(result.success).toBe(false)
    })

    test("should reject text part with wrong type", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [{ text: 123 }], // should be string
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should reject outputTranscription.finished with wrong type", () => {
      const message = {
        serverContent: {
          outputTranscription: {
            text: "Hello",
            finished: "true", // should be boolean
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should reject inputTranscription.isFinal with wrong type", () => {
      const message = {
        inputTranscription: {
          text: "Hello",
          isFinal: 1, // should be boolean
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should reject turnComplete with wrong type", () => {
      const message = {
        serverContent: {
          turnComplete: "yes", // should be boolean
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should reject toolCall with missing name", () => {
      const message = {
        toolCall: {
          functionCalls: [
            {
              args: { foo: "bar" }, // missing name
            },
          ],
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should accept toolCall with missing args", () => {
      const message = {
        toolCall: {
          functionCalls: [
            {
              name: "test", // missing args
            },
          ],
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
    })

    test("should reject toolResponse with missing required fields", () => {
      const message = {
        toolResponse: {
          functionResponses: [
            {
              id: "123",
              // missing name and response
            },
          ],
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should reject error with wrong code type", () => {
      const message = {
        error: {
          code: "429", // should be number
          message: "Rate limit",
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })
  })

  describe("edge cases", () => {
    test("should accept empty parts array", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [],
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
    })

    test("should accept empty string in text part", () => {
      const message = {
        serverContent: {
          modelTurn: {
            parts: [{ text: "" }],
          },
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
    })

    test("should accept empty functionCalls array", () => {
      const message = {
        toolCall: {
          functionCalls: [],
        },
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(true)
    })

    test("should reject null values", () => {
      const message = {
        setupComplete: null,
      }
      const result = ServerMessageSchema.safeParse(message)

      expect(result.success).toBe(false)
    })

    test("should handle undefined vs missing fields correctly", () => {
      const message = {
        setupComplete: undefined, // explicitly undefined
      }
      const result = ServerMessageSchema.safeParse(message)

      // Zod treats undefined as optional, so this should succeed
      expect(result.success).toBe(true)
    })
  })
})

describe("Gemini widget tool arg schemas", () => {
  test("ScheduleActivityArgsSchema should validate valid args", () => {
    const result = ScheduleActivityArgsSchema.safeParse({
      title: "Take a short walk",
      category: "exercise",
      date: "2025-12-31",
      time: "15:30",
      duration: 10,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe("exercise")
      expect(result.data.duration).toBe(10)
    }
  })

  test("ScheduleActivityArgsSchema should reject invalid category", () => {
    const result = ScheduleActivityArgsSchema.safeParse({
      title: "Break",
      category: "work",
      date: "2025-12-31",
      time: "15:30",
      duration: 10,
    })

    expect(result.success).toBe(false)
  })

  test("BreathingExerciseArgsSchema should validate valid args", () => {
    const result = BreathingExerciseArgsSchema.safeParse({
      type: "box",
      duration: 120,
    })

    expect(result.success).toBe(true)
  })

  test("BreathingExerciseArgsSchema should reject invalid type", () => {
    const result = BreathingExerciseArgsSchema.safeParse({
      type: "alternate",
      duration: 120,
    })

    expect(result.success).toBe(false)
  })

  test("StressGaugeArgsSchema should validate valid args", () => {
    const result = StressGaugeArgsSchema.safeParse({
      stressLevel: 55,
      fatigueLevel: 40,
      message: "You're carrying a bit of tension — a short reset could help.",
    })

    expect(result.success).toBe(true)
  })

  test("StressGaugeArgsSchema should reject out-of-range values", () => {
    const result = StressGaugeArgsSchema.safeParse({
      stressLevel: 120,
      fatigueLevel: -1,
    })

    expect(result.success).toBe(false)
  })

  test("QuickActionsArgsSchema should validate valid args", () => {
    const result = QuickActionsArgsSchema.safeParse({
      options: [
        { label: "Try a breathing exercise", action: "Let's do a breathing exercise." },
        { label: "Schedule a 10-minute break", action: "Schedule a 10-minute break today." },
      ],
    })

    expect(result.success).toBe(true)
  })

  test("QuickActionsArgsSchema should reject empty options", () => {
    const result = QuickActionsArgsSchema.safeParse({ options: [] })
    expect(result.success).toBe(false)
  })

  test("JournalPromptArgsSchema should validate valid args", () => {
    const result = JournalPromptArgsSchema.safeParse({
      prompt: "What feels most important to name right now?",
      placeholder: "A few sentences is enough...",
      category: "reflection",
    })

    expect(result.success).toBe(true)
  })

  test("JournalPromptArgsSchema should reject empty prompt", () => {
    const result = JournalPromptArgsSchema.safeParse({ prompt: "" })
    expect(result.success).toBe(false)
  })
})

describe("validateServerMessage()", () => {
  test("should return parsed data for valid message", () => {
    const input = { setupComplete: true }
    const result = validateServerMessage(input)

    expect(result).not.toBeNull()
    expect(result?.setupComplete).toBe(true)
  })

  test("should accept SDK setupComplete object form", () => {
    const input = { setupComplete: { sessionId: "sess_123" } }
    const result = validateServerMessage(input)

    expect(result).not.toBeNull()
    expect(result?.setupComplete).toEqual({ sessionId: "sess_123" })
  })

  test("should return null for invalid message", () => {
    const input = { setupComplete: "not a boolean or object" }
    const result = validateServerMessage(input)

    expect(result).toBeNull()
  })

  test("should handle non-object input", () => {
    const result1 = validateServerMessage(null)
    const result2 = validateServerMessage(undefined)
    const result3 = validateServerMessage("string")
    const result4 = validateServerMessage(123)

    expect(result1).toBeNull()
    expect(result2).toBeNull()
    expect(result3).toBeNull()
    expect(result4).toBeNull()
  })

  test("should log errors for invalid messages", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    validateServerMessage({ setupComplete: "wrong type" })

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Gemini Schema] Invalid server message:",
      expect.any(Array)
    )

    consoleSpy.mockRestore()
  })
})

describe("SessionInfoSchema", () => {
  test("should validate valid session info", () => {
    const sessionInfo = {
      sessionId: "session-123-abc",
      streamUrl: "https://example.com/api/gemini/live/stream?sessionId=session-123-abc",
      audioUrl: "https://example.com/api/gemini/live/audio",
      secret: "base64secret==",
    }
    const result = SessionInfoSchema.safeParse(sessionInfo)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sessionId).toBe("session-123-abc")
      expect(result.data.streamUrl).toContain("session-123-abc")
      expect(result.data.secret).toBe("base64secret==")
    }
  })

  test("should reject missing sessionId", () => {
    const sessionInfo = {
      streamUrl: "https://example.com/stream",
      audioUrl: "https://example.com/audio",
      secret: "secret",
    }
    const result = SessionInfoSchema.safeParse(sessionInfo)

    expect(result.success).toBe(false)
  })

  test("should reject missing streamUrl", () => {
    const sessionInfo = {
      sessionId: "123",
      audioUrl: "https://example.com/audio",
      secret: "secret",
    }
    const result = SessionInfoSchema.safeParse(sessionInfo)

    expect(result.success).toBe(false)
  })

  test("should reject missing audioUrl", () => {
    const sessionInfo = {
      sessionId: "123",
      streamUrl: "https://example.com/stream",
      secret: "secret",
    }
    const result = SessionInfoSchema.safeParse(sessionInfo)

    expect(result.success).toBe(false)
  })

  test("should reject missing secret", () => {
    const sessionInfo = {
      sessionId: "123",
      streamUrl: "https://example.com/stream",
      audioUrl: "https://example.com/audio",
    }
    const result = SessionInfoSchema.safeParse(sessionInfo)

    expect(result.success).toBe(false)
  })

  test("should reject invalid streamUrl (not a URL)", () => {
    const sessionInfo = {
      sessionId: "123",
      streamUrl: "not-a-url",
      audioUrl: "https://example.com/audio",
      secret: "secret",
    }
    const result = SessionInfoSchema.safeParse(sessionInfo)

    expect(result.success).toBe(false)
  })

  test("should reject invalid audioUrl (not a URL)", () => {
    const sessionInfo = {
      sessionId: "123",
      streamUrl: "https://example.com/stream",
      audioUrl: "not-a-url",
      secret: "secret",
    }
    const result = SessionInfoSchema.safeParse(sessionInfo)

    expect(result.success).toBe(false)
  })

  test("should accept localhost URLs in development", () => {
    const sessionInfo = {
      sessionId: "123",
      streamUrl: "http://localhost:3000/api/gemini/live/stream",
      audioUrl: "http://localhost:3000/api/gemini/live/audio",
      secret: "secret",
    }
    const result = SessionInfoSchema.safeParse(sessionInfo)

    expect(result.success).toBe(true)
  })
})

describe("AudioInputRequestSchema", () => {
  test("should validate audio input request", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      audio: "base64pcmdata==",
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sessionId).toBe("session-123")
      expect(result.data.secret).toBe("secret-abc")
      expect(result.data.audio).toBe("base64pcmdata==")
    }
  })

  test("should validate text input request", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      text: "Hello, I need help",
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.text).toBe("Hello, I need help")
    }
  })

  test("should validate audioEnd signal", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      audioEnd: true,
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.audioEnd).toBe(true)
    }
  })

  test("should validate request with multiple optional fields", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      audio: "base64data==",
      text: "Context injection",
      audioEnd: false,
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(true)
  })

  test("should validate request with only required fields", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(true)
  })

  test("should reject missing sessionId", () => {
    const request = {
      secret: "secret-abc",
      audio: "base64==",
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(false)
  })

  test("should reject missing secret", () => {
    const request = {
      sessionId: "session-123",
      audio: "base64==",
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(false)
  })

  test("should reject wrong type for audio", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      audio: 123, // should be string
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(false)
  })

  test("should reject wrong type for text", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      text: true, // should be string
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(false)
  })

  test("should reject wrong type for audioEnd", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      audioEnd: "true", // should be boolean
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(false)
  })

  test("should accept empty strings for optional fields", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      audio: "",
      text: "",
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(true)
  })

  test("should reject overly large audio payloads", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      audio: "a".repeat(1_000_001),
    }
    const result = AudioInputRequestSchema.safeParse(request)

    expect(result.success).toBe(false)
  })
})

describe("ToolResponseRequestSchema", () => {
  test("should validate tool response request", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
      functionResponses: [
        {
          id: "call_123",
          name: "stay_silent",
          response: { ok: true },
        },
      ],
    }

    const result = ToolResponseRequestSchema.safeParse(request)
    expect(result.success).toBe(true)
  })

  test("should reject missing functionResponses", () => {
    const request = {
      sessionId: "session-123",
      secret: "secret-abc",
    }

    const result = ToolResponseRequestSchema.safeParse(request)
    expect(result.success).toBe(false)
  })
})
