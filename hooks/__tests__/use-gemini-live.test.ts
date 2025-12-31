/**
 * useGeminiLive Hook Tests
 *
 * Tests the geminiReducer state management for Gemini Live API connection.
 * Covers all action types, state transitions, and edge cases.
 */

import { describe, test, expect, beforeEach, vi } from "vitest"

// Unmock the module to access the actual reducer for testing
vi.unmock("@/hooks/use-gemini-live")

import {
  geminiReducer,
  initialState,
  type GeminiAction,
  type GeminiLiveData,
} from "@/hooks/use-gemini-live"

describe("geminiReducer", () => {
  let state: GeminiLiveData

  beforeEach(() => {
    state = { ...initialState }
  })

  // ============================================
  // State Transitions
  // ============================================

  describe("State Transitions", () => {
    test("START_CONNECTING resets to initial state with connecting status", () => {
      // Start from a dirty state
      const dirtyState: GeminiLiveData = {
        state: "ready",
        isReady: true,
        isModelSpeaking: true,
        isUserSpeaking: true,
        userTranscript: "previous transcript",
        modelTranscript: "previous model transcript",
        error: "previous error",
      }

      const action: GeminiAction = { type: "START_CONNECTING" }
      const result = geminiReducer(dirtyState, action)

      expect(result).toEqual({
        ...initialState,
        state: "connecting",
      })
      expect(result.isReady).toBe(false)
      expect(result.userTranscript).toBe("")
      expect(result.modelTranscript).toBe("")
      expect(result.error).toBe(null)
    })

    test("CONNECTED transitions from connecting to connected", () => {
      state.state = "connecting"
      const action: GeminiAction = { type: "CONNECTED" }
      const result = geminiReducer(state, action)

      expect(result.state).toBe("connected")
      expect(result.isReady).toBe(false) // Not ready until READY action
    })

    test("READY transitions to ready state and sets isReady flag", () => {
      state.state = "connected"
      const action: GeminiAction = { type: "READY" }
      const result = geminiReducer(state, action)

      expect(result.state).toBe("ready")
      expect(result.isReady).toBe(true)
    })

    test("ERROR transitions to error state and clears isReady", () => {
      state.state = "ready"
      state.isReady = true
      const action: GeminiAction = { type: "ERROR", error: "Connection failed" }
      const result = geminiReducer(state, action)

      expect(result.state).toBe("error")
      expect(result.isReady).toBe(false)
      expect(result.error).toBe("Connection failed")
    })

    test("DISCONNECTED transitions to disconnected and clears all active states", () => {
      state.state = "ready"
      state.isReady = true
      state.isModelSpeaking = true
      state.isUserSpeaking = true
      const action: GeminiAction = { type: "DISCONNECTED" }
      const result = geminiReducer(state, action)

      expect(result.state).toBe("disconnected")
      expect(result.isReady).toBe(false)
      expect(result.isModelSpeaking).toBe(false)
      expect(result.isUserSpeaking).toBe(false)
    })

    test("RESET returns to initial state completely", () => {
      const dirtyState: GeminiLiveData = {
        state: "ready",
        isReady: true,
        isModelSpeaking: true,
        isUserSpeaking: true,
        userTranscript: "some text",
        modelTranscript: "model response",
        error: "error message",
      }

      const action: GeminiAction = { type: "RESET" }
      const result = geminiReducer(dirtyState, action)

      expect(result).toEqual(initialState)
    })
  })

  // ============================================
  // Speech Detection
  // ============================================

  describe("Speech Detection", () => {
    test("USER_SPEECH_START sets isUserSpeaking to true", () => {
      const action: GeminiAction = { type: "USER_SPEECH_START" }
      const result = geminiReducer(state, action)

      expect(result.isUserSpeaking).toBe(true)
      expect(result).toEqual({
        ...state,
        isUserSpeaking: true,
      })
    })

    test("USER_SPEECH_END sets isUserSpeaking to false", () => {
      state.isUserSpeaking = true
      const action: GeminiAction = { type: "USER_SPEECH_END" }
      const result = geminiReducer(state, action)

      expect(result.isUserSpeaking).toBe(false)
    })

    test("MODEL_SPEECH_START sets isModelSpeaking to true", () => {
      const action: GeminiAction = { type: "MODEL_SPEECH_START" }
      const result = geminiReducer(state, action)

      expect(result.isModelSpeaking).toBe(true)
      expect(result).toEqual({
        ...state,
        isModelSpeaking: true,
      })
    })

    test("MODEL_SPEECH_END sets isModelSpeaking to false", () => {
      state.isModelSpeaking = true
      const action: GeminiAction = { type: "MODEL_SPEECH_END" }
      const result = geminiReducer(state, action)

      expect(result.isModelSpeaking).toBe(false)
    })

    test("Both user and model can speak simultaneously", () => {
      let result = geminiReducer(state, { type: "USER_SPEECH_START" })
      result = geminiReducer(result, { type: "MODEL_SPEECH_START" })

      expect(result.isUserSpeaking).toBe(true)
      expect(result.isModelSpeaking).toBe(true)
    })
  })

  // ============================================
  // Transcript Management
  // ============================================

  describe("Transcript Management", () => {
    test("USER_TRANSCRIPT updates user transcript with partial text", () => {
      const action: GeminiAction = {
        type: "USER_TRANSCRIPT",
        text: "Hello, how are",
        isFinal: false,
      }
      const result = geminiReducer(state, action)

      expect(result.userTranscript).toBe("Hello, how are")
    })

    test("USER_TRANSCRIPT updates user transcript with final text", () => {
      const action: GeminiAction = {
        type: "USER_TRANSCRIPT",
        text: "Hello, how are you?",
        isFinal: true,
      }
      const result = geminiReducer(state, action)

      expect(result.userTranscript).toBe("Hello, how are you?")
    })

    test("USER_TRANSCRIPT replaces previous transcript (not append)", () => {
      state.userTranscript = "Previous text"
      const action: GeminiAction = {
        type: "USER_TRANSCRIPT",
        text: "New text",
        isFinal: false,
      }
      const result = geminiReducer(state, action)

      expect(result.userTranscript).toBe("New text")
    })

    test("MODEL_TRANSCRIPT appends to existing model transcript", () => {
      state.modelTranscript = "Hello, "
      const action: GeminiAction = {
        type: "MODEL_TRANSCRIPT",
        text: "how can I help you?",
      }
      const result = geminiReducer(state, action)

      expect(result.modelTranscript).toBe("Hello, how can I help you?")
    })

    test("MODEL_TRANSCRIPT starts new transcript when empty", () => {
      const action: GeminiAction = {
        type: "MODEL_TRANSCRIPT",
        text: "First response",
      }
      const result = geminiReducer(state, action)

      expect(result.modelTranscript).toBe("First response")
    })

    test("MODEL_TRANSCRIPT truncates when exceeding MAX_TRANSCRIPT_LENGTH", () => {
      const MAX_TRANSCRIPT_LENGTH = 10000
      // Create transcript that's already at max length
      const longTranscript = "a".repeat(MAX_TRANSCRIPT_LENGTH)
      state.modelTranscript = longTranscript

      const action: GeminiAction = {
        type: "MODEL_TRANSCRIPT",
        text: "bcdefghij", // Adding 9 chars
      }
      const result = geminiReducer(state, action)

      // Should truncate from the beginning to keep last 10000 chars
      expect(result.modelTranscript.length).toBe(MAX_TRANSCRIPT_LENGTH)
      // Combined is 10009 chars, slice(-10000) keeps last 10000
      // Result: "a".repeat(9991) + "bcdefghij"
      const newTranscript = longTranscript + "bcdefghij"
      expect(result.modelTranscript).toBe(newTranscript.slice(-MAX_TRANSCRIPT_LENGTH))
      // Should end with the new text
      expect(result.modelTranscript.endsWith("bcdefghij")).toBe(true)
    })

    test("MODEL_TRANSCRIPT preserves transcript under MAX_TRANSCRIPT_LENGTH", () => {
      state.modelTranscript = "Short text"
      const action: GeminiAction = {
        type: "MODEL_TRANSCRIPT",
        text: " more text",
      }
      const result = geminiReducer(state, action)

      expect(result.modelTranscript).toBe("Short text more text")
      expect(result.modelTranscript.length).toBeLessThan(10000)
    })

    test("CLEAR_TRANSCRIPTS clears both user and model transcripts", () => {
      state.userTranscript = "User said something"
      state.modelTranscript = "Model responded"
      const action: GeminiAction = { type: "CLEAR_TRANSCRIPTS" }
      const result = geminiReducer(state, action)

      expect(result.userTranscript).toBe("")
      expect(result.modelTranscript).toBe("")
      // Should preserve other state
      expect(result.state).toBe(state.state)
      expect(result.isReady).toBe(state.isReady)
    })
  })

  // ============================================
  // Error Handling
  // ============================================

  describe("Error Handling", () => {
    test("ERROR action sets error message", () => {
      const action: GeminiAction = {
        type: "ERROR",
        error: "WebSocket connection failed",
      }
      const result = geminiReducer(state, action)

      expect(result.error).toBe("WebSocket connection failed")
    })

    test("ERROR action clears isReady flag", () => {
      state.isReady = true
      const action: GeminiAction = {
        type: "ERROR",
        error: "Network error",
      }
      const result = geminiReducer(state, action)

      expect(result.isReady).toBe(false)
    })

    test("ERROR action preserves transcripts", () => {
      state.userTranscript = "User input"
      state.modelTranscript = "Model response"
      const action: GeminiAction = {
        type: "ERROR",
        error: "API error",
      }
      const result = geminiReducer(state, action)

      expect(result.userTranscript).toBe("User input")
      expect(result.modelTranscript).toBe("Model response")
    })

    test("ERROR from ready state preserves speaking states initially", () => {
      state.state = "ready"
      state.isUserSpeaking = true
      state.isModelSpeaking = true
      const action: GeminiAction = {
        type: "ERROR",
        error: "Connection lost",
      }
      const result = geminiReducer(state, action)

      // Speaking states are preserved (only cleared on DISCONNECTED)
      expect(result.isUserSpeaking).toBe(true)
      expect(result.isModelSpeaking).toBe(true)
    })

    test("Subsequent START_CONNECTING clears previous error", () => {
      state.error = "Previous error"
      state.state = "error"
      const action: GeminiAction = { type: "START_CONNECTING" }
      const result = geminiReducer(state, action)

      expect(result.error).toBe(null)
      expect(result.state).toBe("connecting")
    })
  })

  // ============================================
  // Edge Cases
  // ============================================

  describe("Edge Cases", () => {
    test("Empty string transcripts are valid", () => {
      const action1: GeminiAction = {
        type: "USER_TRANSCRIPT",
        text: "",
        isFinal: false,
      }
      const result1 = geminiReducer(state, action1)
      expect(result1.userTranscript).toBe("")

      const action2: GeminiAction = {
        type: "MODEL_TRANSCRIPT",
        text: "",
      }
      const result2 = geminiReducer(state, action2)
      expect(result2.modelTranscript).toBe("")
    })

    test("Empty error string is valid", () => {
      const action: GeminiAction = {
        type: "ERROR",
        error: "",
      }
      const result = geminiReducer(state, action)

      expect(result.error).toBe("")
      expect(result.state).toBe("error")
    })

    test("Multiple state transitions preserve independence", () => {
      let result = state

      // Connect
      result = geminiReducer(result, { type: "START_CONNECTING" })
      expect(result.state).toBe("connecting")

      // Ready
      result = geminiReducer(result, { type: "READY" })
      expect(result.state).toBe("ready")
      expect(result.isReady).toBe(true)

      // User starts speaking
      result = geminiReducer(result, { type: "USER_SPEECH_START" })
      expect(result.isUserSpeaking).toBe(true)
      expect(result.state).toBe("ready") // State unchanged

      // Add user transcript
      result = geminiReducer(result, {
        type: "USER_TRANSCRIPT",
        text: "Hello",
        isFinal: false,
      })
      expect(result.userTranscript).toBe("Hello")
      expect(result.isUserSpeaking).toBe(true) // Speaking state preserved

      // Model starts responding
      result = geminiReducer(result, { type: "MODEL_SPEECH_START" })
      expect(result.isModelSpeaking).toBe(true)
      expect(result.isUserSpeaking).toBe(true) // Both can speak

      // Model transcript
      result = geminiReducer(result, { type: "MODEL_TRANSCRIPT", text: "Hi" })
      expect(result.modelTranscript).toBe("Hi")

      // User stops
      result = geminiReducer(result, { type: "USER_SPEECH_END" })
      expect(result.isUserSpeaking).toBe(false)
      expect(result.isModelSpeaking).toBe(true) // Model still speaking

      // Model stops
      result = geminiReducer(result, { type: "MODEL_SPEECH_END" })
      expect(result.isModelSpeaking).toBe(false)

      // Clear transcripts
      result = geminiReducer(result, { type: "CLEAR_TRANSCRIPTS" })
      expect(result.userTranscript).toBe("")
      expect(result.modelTranscript).toBe("")
      expect(result.state).toBe("ready") // State preserved
    })

    test("Unknown action returns state unchanged", () => {
      const result = geminiReducer(state, { type: "UNKNOWN" } as unknown as GeminiAction)
      expect(result).toEqual(state)
    })

    test("State immutability - original state not modified", () => {
      const originalState = { ...initialState }
      const action: GeminiAction = { type: "START_CONNECTING" }

      geminiReducer(originalState, action)

      // Original should be unchanged
      expect(originalState).toEqual(initialState)
    })
  })

  // ============================================
  // Complex Scenarios
  // ============================================

  describe("Complex Scenarios", () => {
    test("Connection failure and retry flow", () => {
      // First connection attempt
      let result = geminiReducer(state, { type: "START_CONNECTING" })
      expect(result.state).toBe("connecting")

      // Connection fails
      result = geminiReducer(result, {
        type: "ERROR",
        error: "Network timeout",
      })
      expect(result.state).toBe("error")
      expect(result.error).toBe("Network timeout")

      // Retry connection
      result = geminiReducer(result, { type: "START_CONNECTING" })
      expect(result.state).toBe("connecting")
      expect(result.error).toBe(null) // Error cleared

      // Successful connection
      result = geminiReducer(result, { type: "CONNECTED" })
      result = geminiReducer(result, { type: "READY" })
      expect(result.state).toBe("ready")
      expect(result.isReady).toBe(true)
    })

    test("Full conversation lifecycle", () => {
      let result = state

      // 1. Connect
      result = geminiReducer(result, { type: "START_CONNECTING" })
      result = geminiReducer(result, { type: "CONNECTED" })
      result = geminiReducer(result, { type: "READY" })

      // 2. User speaks
      result = geminiReducer(result, { type: "USER_SPEECH_START" })
      result = geminiReducer(result, {
        type: "USER_TRANSCRIPT",
        text: "What is the weather?",
        isFinal: true,
      })
      result = geminiReducer(result, { type: "USER_SPEECH_END" })

      // 3. Model responds
      result = geminiReducer(result, { type: "MODEL_SPEECH_START" })
      result = geminiReducer(result, {
        type: "MODEL_TRANSCRIPT",
        text: "The weather today is sunny.",
      })
      result = geminiReducer(result, { type: "MODEL_SPEECH_END" })

      // 4. Clear for next turn
      result = geminiReducer(result, { type: "CLEAR_TRANSCRIPTS" })

      expect(result.state).toBe("ready")
      expect(result.userTranscript).toBe("")
      expect(result.modelTranscript).toBe("")
      expect(result.isUserSpeaking).toBe(false)
      expect(result.isModelSpeaking).toBe(false)

      // 5. Disconnect
      result = geminiReducer(result, { type: "DISCONNECTED" })
      expect(result.state).toBe("disconnected")
      expect(result.isReady).toBe(false)
    })

    test("User interrupts model mid-response", () => {
      let result = state
      result.state = "ready"
      result.isReady = true

      // Model starts speaking
      result = geminiReducer(result, { type: "MODEL_SPEECH_START" })
      result = geminiReducer(result, {
        type: "MODEL_TRANSCRIPT",
        text: "Let me tell you about",
      })

      // User interrupts
      result = geminiReducer(result, { type: "USER_SPEECH_START" })
      expect(result.isUserSpeaking).toBe(true)
      expect(result.isModelSpeaking).toBe(true) // Both speaking

      // Model stops when interrupted
      result = geminiReducer(result, { type: "MODEL_SPEECH_END" })
      expect(result.isModelSpeaking).toBe(false)
      expect(result.isUserSpeaking).toBe(true) // User still speaking
    })

    test("Disconnect while actively conversing", () => {
      let result = state
      result.state = "ready"
      result.isReady = true
      result.isUserSpeaking = true
      result.isModelSpeaking = true
      result.userTranscript = "Active input"
      result.modelTranscript = "Active response"

      result = geminiReducer(result, { type: "DISCONNECTED" })

      expect(result.state).toBe("disconnected")
      expect(result.isReady).toBe(false)
      expect(result.isUserSpeaking).toBe(false)
      expect(result.isModelSpeaking).toBe(false)
      // Transcripts preserved
      expect(result.userTranscript).toBe("Active input")
      expect(result.modelTranscript).toBe("Active response")
    })
  })
})
