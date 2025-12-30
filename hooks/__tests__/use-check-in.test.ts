/**
 * Comprehensive Tests for useCheckIn Hook Reducer
 *
 * Tests all reducer actions and state transitions for the conversational check-in feature.
 * Validates proper state management, message handling, and mismatch detection.
 */

import { describe, test, expect } from "vitest"
import { checkInReducer, initialState, type CheckInAction } from "../use-check-in"
import type { CheckInMessage, CheckInSession, MismatchResult, AudioFeatures, VoiceMetrics } from "@/lib/types"

// Helper to create mock messages
function createMockMessage(overrides?: Partial<CheckInMessage>): CheckInMessage {
  return {
    id: "msg-123",
    role: "user",
    content: "I'm feeling overwhelmed",
    timestamp: Date.now(),
    ...overrides,
  }
}

// Helper to create mock session
function createMockSession(overrides?: Partial<CheckInSession>): CheckInSession {
  return {
    id: "session-123",
    startedAt: Date.now(),
    messages: [],
    mismatchCount: 0,
    ...overrides,
  }
}

// Helper to create mock mismatch result
function createMockMismatch(detected: boolean): MismatchResult {
  return {
    detected,
    confidence: detected ? 0.85 : 0.2,
    reason: detected ? "Tone doesn't match content" : undefined,
    userFeeling: detected ? "stressed" : undefined,
    userSaying: detected ? "fine" : undefined,
  }
}

describe("checkInReducer", () => {
  describe("state transitions", () => {
    test("START_INITIALIZING - resets to initializing state", () => {
      const dirtyState = {
        ...initialState,
        state: "listening" as const,
        messages: [createMockMessage()],
        error: "previous error",
      }

      const newState = checkInReducer(dirtyState, { type: "START_INITIALIZING" })

      expect(newState.state).toBe("initializing")
      expect(newState.messages).toEqual([])
      expect(newState.error).toBeNull()
    })

    test("SET_CONNECTING - transitions to connecting", () => {
      const newState = checkInReducer(initialState, { type: "SET_CONNECTING" })

      expect(newState.state).toBe("connecting")
      expect(newState.isActive).toBe(false)
    })

    test("SET_READY - transitions to ready and activates session", () => {
      const newState = checkInReducer(initialState, { type: "SET_READY" })

      expect(newState.state).toBe("ready")
      expect(newState.isActive).toBe(true)
    })

    test("SET_LISTENING - transitions to listening", () => {
      const newState = checkInReducer(initialState, { type: "SET_LISTENING" })

      expect(newState.state).toBe("listening")
    })

    test("SET_USER_SPEAKING - transitions to user_speaking", () => {
      const newState = checkInReducer(initialState, { type: "SET_USER_SPEAKING" })

      expect(newState.state).toBe("user_speaking")
    })

    test("SET_PROCESSING - transitions to processing", () => {
      const newState = checkInReducer(initialState, { type: "SET_PROCESSING" })

      expect(newState.state).toBe("processing")
    })

    test("SET_ASSISTANT_SPEAKING - transitions to assistant_speaking", () => {
      const newState = checkInReducer(initialState, { type: "SET_ASSISTANT_SPEAKING" })

      expect(newState.state).toBe("assistant_speaking")
    })

    test("SET_ENDING - transitions to ending", () => {
      const newState = checkInReducer(initialState, { type: "SET_ENDING" })

      expect(newState.state).toBe("ending")
    })

    test("SET_COMPLETE - transitions to complete and deactivates", () => {
      const activeState = { ...initialState, isActive: true }
      const newState = checkInReducer(activeState, { type: "SET_COMPLETE" })

      expect(newState.state).toBe("complete")
      expect(newState.isActive).toBe(false)
    })

    test("SET_ERROR - transitions to error state with message", () => {
      const newState = checkInReducer(initialState, {
        type: "SET_ERROR",
        error: "Connection failed",
      })

      expect(newState.state).toBe("error")
      expect(newState.isActive).toBe(false)
      expect(newState.error).toBe("Connection failed")
    })

    test("RESET - returns to initial state", () => {
      const dirtyState = {
        ...initialState,
        state: "listening" as const,
        isActive: true,
        messages: [createMockMessage()],
        mismatchCount: 5,
        error: "error",
      }

      const newState = checkInReducer(dirtyState, { type: "RESET" })

      expect(newState).toEqual(initialState)
    })
  })

  describe("session management", () => {
    test("SET_SESSION - sets session", () => {
      const session = createMockSession()
      const newState = checkInReducer(initialState, {
        type: "SET_SESSION",
        session,
      })

      expect(newState.session).toEqual(session)
    })

    test("SET_SESSION - replaces existing session", () => {
      const oldSession = createMockSession({ id: "old-session" })
      const newSession = createMockSession({ id: "new-session" })

      const stateWithSession = { ...initialState, session: oldSession }
      const newState = checkInReducer(stateWithSession, {
        type: "SET_SESSION",
        session: newSession,
      })

      expect(newState.session?.id).toBe("new-session")
    })
  })

  describe("message management", () => {
    test("ADD_MESSAGE - adds message to empty list", () => {
      const message = createMockMessage()
      const newState = checkInReducer(initialState, {
        type: "ADD_MESSAGE",
        message,
      })

      expect(newState.messages).toHaveLength(1)
      expect(newState.messages[0]).toEqual(message)
    })

    test("ADD_MESSAGE - appends to existing messages", () => {
      const message1 = createMockMessage({ id: "msg-1" })
      const message2 = createMockMessage({ id: "msg-2" })

      const stateWithMessage = { ...initialState, messages: [message1] }
      const newState = checkInReducer(stateWithMessage, {
        type: "ADD_MESSAGE",
        message: message2,
      })

      expect(newState.messages).toHaveLength(2)
      expect(newState.messages[0].id).toBe("msg-1")
      expect(newState.messages[1].id).toBe("msg-2")
    })

    test("ADD_MESSAGE - updates session messages if session exists", () => {
      const message = createMockMessage()
      const session = createMockSession({ messages: [] })
      const stateWithSession = { ...initialState, session }

      const newState = checkInReducer(stateWithSession, {
        type: "ADD_MESSAGE",
        message,
      })

      expect(newState.session?.messages).toHaveLength(1)
      expect(newState.session?.messages[0]).toEqual(message)
    })

    test("ADD_MESSAGE - does NOT increment mismatch count", () => {
      const message = createMockMessage()
      const newState = checkInReducer(initialState, {
        type: "ADD_MESSAGE",
        message,
      })

      // Mismatch count should NOT increase here - it increases in UPDATE_MESSAGE_FEATURES
      expect(newState.mismatchCount).toBe(0)
    })

    test("ADD_MESSAGE - tracks streaming ID for assistant messages only", () => {
      const assistantStreaming: CheckInMessage = {
        id: "asst-1",
        role: "assistant",
        content: "Hello",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      }

      const userStreaming: CheckInMessage = {
        id: "user-1",
        role: "user",
        content: "Hi",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      }

      const stateAfterUser = checkInReducer(initialState, {
        type: "ADD_MESSAGE",
        message: userStreaming,
      })
      expect(stateAfterUser.currentStreamingMessageId).toBeNull()

      const stateAfterAssistant = checkInReducer(initialState, {
        type: "ADD_MESSAGE",
        message: assistantStreaming,
      })
      expect(stateAfterAssistant.currentStreamingMessageId).toBe("asst-1")
    })

    test("UPDATE_MESSAGE_CONTENT - updates message content (and session, if present)", () => {
      const message: CheckInMessage = {
        id: "msg-1",
        role: "user",
        content: "Old",
        timestamp: new Date().toISOString(),
      }

      const session: CheckInSession = {
        id: "session-1",
        startedAt: new Date().toISOString(),
        messages: [message],
      }

      const stateWithSession = { ...initialState, messages: [message], session }

      const newState = checkInReducer(stateWithSession, {
        type: "UPDATE_MESSAGE_CONTENT",
        messageId: "msg-1",
        content: "New",
      })

      expect(newState.messages[0].content).toBe("New")
      expect(newState.session?.messages[0].content).toBe("New")
    })

    test("SET_MESSAGE_STREAMING - toggles isStreaming (and session, if present)", () => {
      const message: CheckInMessage = {
        id: "msg-1",
        role: "user",
        content: "Hello",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      }

      const session: CheckInSession = {
        id: "session-1",
        startedAt: new Date().toISOString(),
        messages: [message],
      }

      const stateWithSession = { ...initialState, messages: [message], session }

      const newState = checkInReducer(stateWithSession, {
        type: "SET_MESSAGE_STREAMING",
        messageId: "msg-1",
        isStreaming: false,
      })

      expect(newState.messages[0].isStreaming).toBe(false)
      expect(newState.session?.messages[0].isStreaming).toBe(false)
    })

    test("UPDATE_MESSAGE_FEATURES - updates message with features and metrics", () => {
      const message = createMockMessage({ id: "msg-123" })
      const stateWithMessage = { ...initialState, messages: [message] }

      const features: AudioFeatures = {
        mfcc: [1, 2, 3],
        spectralCentroid: 500,
        zcr: 0.1,
        energy: 0.5,
        pitch: 200,
      }

      const metrics: VoiceMetrics = {
        meanPitch: 200,
        pitchVariation: 50,
        energyMean: 0.5,
        energyVariation: 0.1,
        speechRate: 150,
        pauseRatio: 0.2,
      }

      const mismatch = createMockMismatch(false)

      const newState = checkInReducer(stateWithMessage, {
        type: "UPDATE_MESSAGE_FEATURES",
        messageId: "msg-123",
        features,
        metrics,
        mismatch,
      })

      const updatedMessage = newState.messages[0]
      expect(updatedMessage.features).toEqual(features)
      expect(updatedMessage.metrics).toEqual(metrics)
      expect(updatedMessage.mismatch).toEqual(mismatch)
    })

    test("UPDATE_MESSAGE_FEATURES - increments mismatch count when detected", () => {
      const message = createMockMessage({ id: "msg-123" })
      const stateWithMessage = { ...initialState, messages: [message] }

      const features: AudioFeatures = {
        mfcc: [1, 2, 3],
        spectralCentroid: 500,
        zcr: 0.1,
        energy: 0.5,
        pitch: 200,
      }

      const metrics: VoiceMetrics = {
        meanPitch: 200,
        pitchVariation: 50,
        energyMean: 0.5,
        energyVariation: 0.1,
        speechRate: 150,
        pauseRatio: 0.2,
      }

      const mismatch = createMockMismatch(true)

      const newState = checkInReducer(stateWithMessage, {
        type: "UPDATE_MESSAGE_FEATURES",
        messageId: "msg-123",
        features,
        metrics,
        mismatch,
      })

      expect(newState.mismatchCount).toBe(1)
    })

    test("UPDATE_MESSAGE_FEATURES - does NOT increment count when no mismatch", () => {
      const message = createMockMessage({ id: "msg-123" })
      const stateWithMessage = { ...initialState, messages: [message] }

      const features: AudioFeatures = {
        mfcc: [1, 2, 3],
        spectralCentroid: 500,
        zcr: 0.1,
        energy: 0.5,
        pitch: 200,
      }

      const metrics: VoiceMetrics = {
        meanPitch: 200,
        pitchVariation: 50,
        energyMean: 0.5,
        energyVariation: 0.1,
        speechRate: 150,
        pauseRatio: 0.2,
      }

      const mismatch = createMockMismatch(false)

      const newState = checkInReducer(stateWithMessage, {
        type: "UPDATE_MESSAGE_FEATURES",
        messageId: "msg-123",
        features,
        metrics,
        mismatch,
      })

      expect(newState.mismatchCount).toBe(0)
    })

    test("UPDATE_MESSAGE_FEATURES - updates session when session exists", () => {
      const message = createMockMessage({ id: "msg-123" })
      const session = createMockSession({ messages: [message], mismatchCount: 0 })
      const stateWithSession = { ...initialState, session, messages: [message] }

      const features: AudioFeatures = {
        mfcc: [1, 2, 3],
        spectralCentroid: 500,
        zcr: 0.1,
        energy: 0.5,
        pitch: 200,
      }

      const metrics: VoiceMetrics = {
        meanPitch: 200,
        pitchVariation: 50,
        energyMean: 0.5,
        energyVariation: 0.1,
        speechRate: 150,
        pauseRatio: 0.2,
      }

      const mismatch = createMockMismatch(true)

      const newState = checkInReducer(stateWithSession, {
        type: "UPDATE_MESSAGE_FEATURES",
        messageId: "msg-123",
        features,
        metrics,
        mismatch,
      })

      expect(newState.session?.mismatchCount).toBe(1)
      expect(newState.session?.messages[0].mismatch).toEqual(mismatch)
    })

    test("UPDATE_MESSAGE_FEATURES - only updates matching message", () => {
      const message1 = createMockMessage({ id: "msg-1", content: "First" })
      const message2 = createMockMessage({ id: "msg-2", content: "Second" })
      const stateWithMessages = { ...initialState, messages: [message1, message2] }

      const features: AudioFeatures = {
        mfcc: [1, 2, 3],
        spectralCentroid: 500,
        zcr: 0.1,
        energy: 0.5,
        pitch: 200,
      }

      const metrics: VoiceMetrics = {
        meanPitch: 200,
        pitchVariation: 50,
        energyMean: 0.5,
        energyVariation: 0.1,
        speechRate: 150,
        pauseRatio: 0.2,
      }

      const mismatch = createMockMismatch(false)

      const newState = checkInReducer(stateWithMessages, {
        type: "UPDATE_MESSAGE_FEATURES",
        messageId: "msg-1",
        features,
        metrics,
        mismatch,
      })

      expect(newState.messages[0].features).toEqual(features)
      expect(newState.messages[1].features).toBeUndefined()
    })
  })

  describe("transcript management", () => {
    test("SET_USER_TRANSCRIPT - sets user transcript", () => {
      const newState = checkInReducer(initialState, {
        type: "SET_USER_TRANSCRIPT",
        text: "I'm feeling stressed",
      })

      expect(newState.currentUserTranscript).toBe("I'm feeling stressed")
    })

    test("SET_USER_TRANSCRIPT - replaces existing transcript", () => {
      const stateWithTranscript = {
        ...initialState,
        currentUserTranscript: "Old text",
      }

      const newState = checkInReducer(stateWithTranscript, {
        type: "SET_USER_TRANSCRIPT",
        text: "New text",
      })

      expect(newState.currentUserTranscript).toBe("New text")
    })

    test("SET_ASSISTANT_TRANSCRIPT - sets assistant transcript", () => {
      const newState = checkInReducer(initialState, {
        type: "SET_ASSISTANT_TRANSCRIPT",
        text: "How can I help?",
      })

      expect(newState.currentAssistantTranscript).toBe("How can I help?")
    })

    test("APPEND_ASSISTANT_TRANSCRIPT - appends to existing transcript", () => {
      const stateWithTranscript = {
        ...initialState,
        currentAssistantTranscript: "Hello",
      }

      const newState = checkInReducer(stateWithTranscript, {
        type: "APPEND_ASSISTANT_TRANSCRIPT",
        text: " world",
      })

      expect(newState.currentAssistantTranscript).toBe("Hello world")
    })

    test("APPEND_ASSISTANT_TRANSCRIPT - appends to empty transcript", () => {
      const newState = checkInReducer(initialState, {
        type: "APPEND_ASSISTANT_TRANSCRIPT",
        text: "Hello",
      })

      expect(newState.currentAssistantTranscript).toBe("Hello")
    })

    test("APPEND_ASSISTANT_TRANSCRIPT - handles rapid sequential appends", () => {
      let state = initialState

      // Simulate rapid streaming chunks
      const chunks = ["How", " can", " I", " help", " you", " today?"]
      for (const chunk of chunks) {
        state = checkInReducer(state, {
          type: "APPEND_ASSISTANT_TRANSCRIPT",
          text: chunk,
        })
      }

      expect(state.currentAssistantTranscript).toBe("How can I help you today?")
    })

    test("SET_ASSISTANT_THINKING - sets thinking text", () => {
      const newState = checkInReducer(initialState, {
        type: "SET_ASSISTANT_THINKING",
        text: "Analyzing emotional state...",
      })

      expect(newState.currentAssistantThinking).toBe("Analyzing emotional state...")
    })

    test("APPEND_ASSISTANT_THINKING - appends to existing thinking", () => {
      const stateWithThinking = {
        ...initialState,
        currentAssistantThinking: "Analyzing",
      }

      const newState = checkInReducer(stateWithThinking, {
        type: "APPEND_ASSISTANT_THINKING",
        text: " patterns",
      })

      expect(newState.currentAssistantThinking).toBe("Analyzing patterns")
    })

    test("APPEND_ASSISTANT_THINKING - handles rapid sequential appends", () => {
      let state = initialState

      const chunks = ["Detecting", " potential", " mismatch", "..."]
      for (const chunk of chunks) {
        state = checkInReducer(state, {
          type: "APPEND_ASSISTANT_THINKING",
          text: chunk,
        })
      }

      expect(state.currentAssistantThinking).toBe("Detecting potential mismatch...")
    })

    test("CLEAR_CURRENT_TRANSCRIPTS - clears all current transcripts", () => {
      const stateWithTranscripts = {
        ...initialState,
        currentUserTranscript: "User text",
        currentAssistantTranscript: "Assistant text",
        currentAssistantThinking: "Thinking text",
      }

      const newState = checkInReducer(stateWithTranscripts, {
        type: "CLEAR_CURRENT_TRANSCRIPTS",
      })

      expect(newState.currentUserTranscript).toBe("")
      expect(newState.currentAssistantTranscript).toBe("")
      expect(newState.currentAssistantThinking).toBe("")
    })

    test("CLEAR_CURRENT_TRANSCRIPTS - preserves other state", () => {
      const stateWithData = {
        ...initialState,
        state: "listening" as const,
        messages: [createMockMessage()],
        mismatchCount: 2,
        currentUserTranscript: "User text",
        currentAssistantTranscript: "Assistant text",
      }

      const newState = checkInReducer(stateWithData, {
        type: "CLEAR_CURRENT_TRANSCRIPTS",
      })

      expect(newState.state).toBe("listening")
      expect(newState.messages).toHaveLength(1)
      expect(newState.mismatchCount).toBe(2)
    })
  })

  describe("mismatch detection", () => {
    test("SET_MISMATCH - sets latest mismatch result", () => {
      const mismatch = createMockMismatch(true)
      const newState = checkInReducer(initialState, {
        type: "SET_MISMATCH",
        result: mismatch,
      })

      expect(newState.latestMismatch).toEqual(mismatch)
    })

    test("SET_MISMATCH - replaces previous mismatch", () => {
      const oldMismatch = createMockMismatch(true)
      const newMismatch = createMockMismatch(false)

      const stateWithMismatch = { ...initialState, latestMismatch: oldMismatch }
      const newState = checkInReducer(stateWithMismatch, {
        type: "SET_MISMATCH",
        result: newMismatch,
      })

      expect(newState.latestMismatch).toEqual(newMismatch)
    })
  })

  describe("audio levels", () => {
    test("SET_INPUT_LEVEL - sets input level", () => {
      const newState = checkInReducer(initialState, {
        type: "SET_INPUT_LEVEL",
        level: 0.75,
      })

      expect(newState.audioLevels.input).toBe(0.75)
      expect(newState.audioLevels.output).toBe(0) // unchanged
    })

    test("SET_OUTPUT_LEVEL - sets output level", () => {
      const newState = checkInReducer(initialState, {
        type: "SET_OUTPUT_LEVEL",
        level: 0.5,
      })

      expect(newState.audioLevels.output).toBe(0.5)
      expect(newState.audioLevels.input).toBe(0) // unchanged
    })

    test("SET_INPUT_LEVEL - updates existing level", () => {
      const stateWithLevels = {
        ...initialState,
        audioLevels: { input: 0.3, output: 0.6 },
      }

      const newState = checkInReducer(stateWithLevels, {
        type: "SET_INPUT_LEVEL",
        level: 0.9,
      })

      expect(newState.audioLevels.input).toBe(0.9)
      expect(newState.audioLevels.output).toBe(0.6)
    })
  })

  describe("connection state", () => {
    test("SET_CONNECTION_STATE - sets connection state", () => {
      const newState = checkInReducer(initialState, {
        type: "SET_CONNECTION_STATE",
        state: "connecting",
      })

      expect(newState.connectionState).toBe("connecting")
    })

    test("SET_CONNECTION_STATE - updates existing state", () => {
      const stateWithConnection = {
        ...initialState,
        connectionState: "connecting" as const,
      }

      const newState = checkInReducer(stateWithConnection, {
        type: "SET_CONNECTION_STATE",
        state: "ready",
      })

      expect(newState.connectionState).toBe("ready")
    })
  })

  describe("edge cases", () => {
    test("preserves unrelated state when updating", () => {
      const complexState = {
        ...initialState,
        state: "listening" as const,
        isActive: true,
        messages: [createMockMessage()],
        currentUserTranscript: "User text",
        mismatchCount: 3,
        audioLevels: { input: 0.5, output: 0.7 },
        connectionState: "ready" as const,
      }

      // Update just the assistant transcript
      const newState = checkInReducer(complexState, {
        type: "SET_ASSISTANT_TRANSCRIPT",
        text: "New transcript",
      })

      // All other state should be preserved
      expect(newState.state).toBe("listening")
      expect(newState.isActive).toBe(true)
      expect(newState.messages).toHaveLength(1)
      expect(newState.currentUserTranscript).toBe("User text")
      expect(newState.mismatchCount).toBe(3)
      expect(newState.audioLevels).toEqual({ input: 0.5, output: 0.7 })
      expect(newState.connectionState).toBe("ready")
    })

    test("handles empty string transcripts", () => {
      const newState = checkInReducer(initialState, {
        type: "SET_ASSISTANT_TRANSCRIPT",
        text: "",
      })

      expect(newState.currentAssistantTranscript).toBe("")
    })

    test("handles zero audio levels", () => {
      const newState1 = checkInReducer(initialState, {
        type: "SET_INPUT_LEVEL",
        level: 0,
      })
      const newState2 = checkInReducer(initialState, {
        type: "SET_OUTPUT_LEVEL",
        level: 0,
      })

      expect(newState1.audioLevels.input).toBe(0)
      expect(newState2.audioLevels.output).toBe(0)
    })
  })
})
