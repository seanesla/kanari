/**
 * Session Manager Tests
 *
 * Tests for the Gemini Live session manager singleton.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

let connectMock: ReturnType<typeof vi.fn>
let lastGoogleGenAIOptions: Record<string, unknown> | null = null

describe("GeminiSessionManager", () => {
  // Mock @google/genai module
  vi.mock("@google/genai", () => {
    connectMock = vi.fn(async ({ callbacks }) => {
      // Simulate session connection
      setTimeout(() => {
        callbacks?.onopen?.()
      }, 10)

      return {
        sendRealtimeInput: vi.fn(),
        sendClientContent: vi.fn(),
        close: vi.fn(),
      }
    })

    return {
      // Must be constructable (used via `new GoogleGenAI(...)`).
      GoogleGenAI: vi.fn().mockImplementation(function (opts: Record<string, unknown>) {
        lastGoogleGenAIOptions = opts
        return {
          live: { connect: connectMock },
        }
      }),
      Modality: { AUDIO: "audio" },
    }
  })

  beforeEach(() => {
    // No env fallback: tests must pass an explicit user-provided key.
    // Reset the global singleton between tests so sessions don't leak and trip MAX_CONCURRENT_SESSIONS.
    vi.resetModules()
    const globalForGemini = globalThis as unknown as { geminiSessionManager?: unknown }
    delete globalForGemini.geminiSessionManager
  })

  afterEach(() => {
    vi.clearAllMocks()
    lastGoogleGenAIOptions = null
  })

  it("should create a session with a secret", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    const result = await sessionManager.createSession("test-session-1", undefined, "test-api-key")

    expect(result).toHaveProperty("sessionId", "test-session-1")
    expect(result).toHaveProperty("secret")
    expect(typeof result.secret).toBe("string")
    expect(result.secret.length).toBeGreaterThan(0)
  })

  it("uses v1alpha for Live sessions (required for affective dialog)", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    await sessionManager.createSession("test-session-v1alpha", undefined, "test-api-key")

    expect(lastGoogleGenAIOptions).toEqual(
      expect.objectContaining({
        httpOptions: expect.objectContaining({ apiVersion: "v1alpha" }),
      })
    )
  })

  it("falls back to standard mode when affective dialog is rejected", async () => {
    connectMock.mockImplementationOnce(async () => {
      throw new Error(
        'Invalid JSON payload received. Unknown name "enableAffectiveDialog" at "setup.generation_config": Cannot find field.'
      )
    })

    const { sessionManager } = await import("@/lib/gemini/session-manager")

    await sessionManager.createSession("test-session-fallback", undefined, "test-api-key")

    expect(connectMock).toHaveBeenCalledTimes(2)
    expect(connectMock.mock.calls[0]?.[0]?.config?.enableAffectiveDialog).toBe(true)
    expect(connectMock.mock.calls[1]?.[0]?.config?.enableAffectiveDialog).toBeUndefined()
  })

  it("should validate correct session secret", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    const { secret } = await sessionManager.createSession("test-session-2", undefined, "test-api-key")

    expect(sessionManager.validateSecret("test-session-2", secret)).toBe(true)
  })

  it("should reject invalid session secret", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    await sessionManager.createSession("test-session-3", undefined, "test-api-key")

    expect(sessionManager.validateSecret("test-session-3", "wrong-secret")).toBe(false)
  })

  it("should reject secret for non-existent session", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    expect(sessionManager.validateSecret("nonexistent", "any-secret")).toBe(false)
  })

  it("should check if session exists", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    await sessionManager.createSession("test-session-4", undefined, "test-api-key")

    expect(sessionManager.hasSession("test-session-4")).toBe(true)
    expect(sessionManager.hasSession("nonexistent")).toBe(false)
  })

  it("should close a session", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    await sessionManager.createSession("test-session-5", undefined, "test-api-key")
    expect(sessionManager.hasSession("test-session-5")).toBe(true)

    sessionManager.closeSession("test-session-5")
    expect(sessionManager.hasSession("test-session-5")).toBe(false)
  })

  it("should throw error when creating duplicate session", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    await sessionManager.createSession("duplicate-session", undefined, "test-api-key")

    await expect(
      sessionManager.createSession("duplicate-session")
    ).rejects.toThrow("already exists")
  })

  it("should throw error when max sessions exceeded", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    // Create 10 sessions (the max)
    for (let i = 0; i < 10; i++) {
      await sessionManager.createSession(`session-${i}`, undefined, "test-api-key")
    }

    // 11th session should fail
    await expect(
      sessionManager.createSession("session-11", undefined, "test-api-key")
    ).rejects.toThrow("Maximum concurrent sessions")
  })

  it("should return session count", async () => {
    const { sessionManager } = await import("@/lib/gemini/session-manager")

    const initialCount = sessionManager.getSessionCount()

    await sessionManager.createSession("count-test-1", undefined, "test-api-key")
    expect(sessionManager.getSessionCount()).toBe(initialCount + 1)

    await sessionManager.createSession("count-test-2", undefined, "test-api-key")
    expect(sessionManager.getSessionCount()).toBe(initialCount + 2)

    sessionManager.closeSession("count-test-1")
    expect(sessionManager.getSessionCount()).toBe(initialCount + 1)
  })
})
