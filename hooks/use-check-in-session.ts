"use client"

import { useCallback, useRef } from "react"
import type { Dispatch, MutableRefObject } from "react"
import { processAudio } from "@/lib/audio/processor"
import { createGeminiHeaders } from "@/lib/utils"
import {
  type SystemContextSummary,
  type SystemTimeContext,
} from "@/lib/gemini/live-prompts"
import { buildHistoricalContext } from "@/lib/gemini/context-builder"
import { fetchCheckInContext } from "@/lib/gemini/check-in-context"
import { computeContextFingerprint } from "@/lib/gemini/context-fingerprint"
import {
  consumePreservedSession,
  clearPreservedSession,
  hasPreservedSession as checkPreservedSession,
  markSessionInvalid,
  preserveSession as storePreservedSession,
} from "@/lib/gemini/preserved-session"
import type { GeminiLiveClient, SessionContext } from "@/lib/gemini/live-client"
import type { CheckInSession, CheckInState } from "@/lib/types"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import { generateId, type CheckInAction, type CheckInData } from "./use-check-in-messages"
import type { UseCheckInAudioResult } from "./use-check-in-audio"

export interface CheckInSessionCallbacks {
  onSessionStart?: (session: CheckInSession) => void
  onSessionEnd?: (session: CheckInSession) => void
  onError?: (error: Error) => void
}

export interface PlaybackControls {
  initialize: () => Promise<void>
  cleanup: () => void
}

export interface GeminiControls {
  connect: (context?: SessionContext) => Promise<void>
  disconnect: () => void
  sendText: (text: string) => void
  getClient: () => GeminiLiveClient | null
  reattachToClient: (client: GeminiLiveClient) => void
}

export interface CheckInSessionGeminiHandlers {
  onConnected: () => void
  onDisconnected: (reason: string) => void
  onError: (error: Error) => void
}

export interface UseCheckInSessionOptions {
  data: CheckInData
  dispatch: Dispatch<CheckInAction>
  callbacksRef: MutableRefObject<CheckInSessionCallbacks>
  playbackControls: PlaybackControls
  audio: UseCheckInAudioResult
  gemini: GeminiControls
  stateRef: MutableRefObject<CheckInState>
}

export interface UseCheckInSessionResult {
  startSession: () => Promise<void>
  endSession: () => Promise<void>
  cancelSession: () => void
  getSession: () => CheckInSession | null
  preserveSession: () => void
  hasPreservedSession: () => boolean
  resumePreservedSession: () => Promise<void>
  getContextFingerprint: () => Promise<string>
  handlers: CheckInSessionGeminiHandlers
}

export function useCheckInSession(options: UseCheckInSessionOptions): UseCheckInSessionResult {
  const { data, dispatch, callbacksRef, playbackControls, audio, gemini, stateRef } = options

  const sessionStartRef = useRef<string | null>(null)

  // Context fingerprint for session preservation
  const contextFingerprintRef = useRef<string | null>(null)

  const startSession = useCallback(
    async () => {
      // Track what's been initialized for proper cleanup on failure
      let playbackInitialized = false
      let captureInitialized = false

      try {
        dispatch({ type: "START_INITIALIZING" })

        // Reset the cleanup abort flag for this new session
        audio.resetCleanupRequestedFlag()

        // Create new session
        const session: CheckInSession = {
          id: generateId(),
          startedAt: new Date().toISOString(),
          messages: [],
        }
        dispatch({ type: "SET_SESSION", session })
        sessionStartRef.current = session.startedAt

        // Compute context fingerprint for session preservation
        // This allows us to detect if data changed while session was preserved
        contextFingerprintRef.current = await computeContextFingerprint()

        // Fetch context for AI-initiated conversation
        let sessionContext: SessionContext | undefined
        try {
          const contextData = await fetchCheckInContext()
          const formattedContext = buildHistoricalContext(contextData)

          // Always include time context in the system instruction (even if context-summary generation fails).
          sessionContext = {
            timeContext: {
              currentTime: contextData.timeContext.currentTime,
              dayOfWeek: contextData.timeContext.dayOfWeek,
              timeOfDay: contextData.timeContext.timeOfDay,
              daysSinceLastCheckIn: contextData.timeContext.daysSinceLastCheckIn,
            } as SystemTimeContext,
          }

          // Best-effort: generate a richer context summary using Gemini 3
          try {
            const headers = await createGeminiHeaders({
              "Content-Type": "application/json",
            })

            const contextResponse = await fetch("/api/gemini/check-in-context", {
              method: "POST",
              headers,
              body: JSON.stringify(formattedContext),
            })

            if (contextResponse.ok) {
              const { summary } = await contextResponse.json()
              sessionContext.contextSummary = summary as SystemContextSummary
              console.log("[useCheckIn] Context summary prepared for AI-initiated conversation")
            } else {
              console.warn("[useCheckIn] Context summary request failed, using time-only context")
            }
          } catch (summaryError) {
            console.warn(
              "[useCheckIn] Context summary request errored, using time-only context:",
              summaryError
            )
          }

        } catch (contextError) {
          // Context generation failed - proceed without it (AI will use default greeting)
          console.warn("[useCheckIn] Context generation failed, using default greeting:", contextError)
        }

        // Initialize playback first (needs user gesture context)
        await playbackControls.initialize()
        playbackInitialized = true

        // Initialize audio capture AFTER playback to avoid worklet loading race
        // Some browsers can only load one AudioWorklet module at a time
        await audio.initializeAudioCapture()
        captureInitialized = true

        dispatch({ type: "SET_CONNECTING" })

        // Connect to Gemini with session context for AI-initiated greeting
        await gemini.connect(sessionContext)

        callbacksRef.current.onSessionStart?.(session)
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to start session")

        // INITIALIZATION_ABORTED is expected in React StrictMode
        if (err.message === "INITIALIZATION_ABORTED") {
          console.log("[useCheckIn] Session initialization aborted (StrictMode cleanup)")
          // Cleanup only what was initialized (in reverse order)
          if (captureInitialized) {
            audio.cleanupAudioCapture()
          }
          if (playbackInitialized) {
            playbackControls.cleanup()
          }
          // Reset to idle so second mount can try again
          dispatch({ type: "RESET" })
          return
        }

        // SESSION_SUPERSEDED means a newer session started while this one was initializing.
        if (err.message === "SESSION_SUPERSEDED") {
          console.log("[useCheckIn] Session superseded by newer initialization")
          // Don't cleanup - the new session owns the resources now
          // Don't dispatch anything - let the new session handle state
          return
        }

        // Real errors get shown to the user
        dispatch({ type: "SET_ERROR", error: err.message })
        callbacksRef.current.onError?.(err)

        // Cleanup only what was initialized (in reverse order)
        if (captureInitialized) {
          audio.cleanupAudioCapture()
        }
        if (playbackInitialized) {
          playbackControls.cleanup()
        }
      }
    },
    [audio, callbacksRef, dispatch, gemini, playbackControls]
  )

  const endSession = useCallback(async () => {
    dispatch({ type: "SET_ENDING" })

    // Clear any preserved session (user explicitly ended, don't preserve)
    clearPreservedSession(false) // false = don't disconnect, we'll do it below

    const sessionAudio = audio.getSessionAudio()
    const sessionAudioData = sessionAudio ? Array.from(sessionAudio) : undefined
    const sessionSampleRate = sessionAudio ? 16000 : undefined

    let acousticMetrics = data.session?.acousticMetrics
    if (!acousticMetrics && sessionAudio) {
      try {
        const processed = await processAudio(sessionAudio, {
          sampleRate: 16000,
          enableVAD: true,
        })
        const metrics = analyzeVoiceMetrics(processed.features)
        acousticMetrics = {
          stressScore: metrics.stressScore,
          fatigueScore: metrics.fatigueScore,
          stressLevel: metrics.stressLevel,
          fatigueLevel: metrics.fatigueLevel,
          confidence: metrics.confidence,
          analyzedAt: metrics.analyzedAt,
          features: processed.features,
        }

        dispatch({ type: "SET_SESSION_ACOUSTIC_METRICS", metrics: acousticMetrics })
      } catch (error) {
        console.warn("[useCheckIn] Failed to compute session-level metrics:", error)
      }
    }

    // Calculate session duration
    const duration = sessionStartRef.current
      ? (Date.now() - new Date(sessionStartRef.current).getTime()) / 1000
      : 0

    // Update session with final data
    const finalSession: CheckInSession | null = data.session
      ? {
          ...data.session,
          endedAt: new Date().toISOString(),
          messages: data.messages,
          mismatchCount: data.mismatchCount,
          duration,
          acousticMetrics: acousticMetrics ?? data.session.acousticMetrics,
          audioData: sessionAudioData,
          sampleRate: sessionSampleRate,
        }
      : null

    // Cleanup with error handling - continue cleanup even if one fails
    const cleanupErrors: Error[] = []

    try {
      audio.cleanupAudioCapture()
    } catch (error) {
      cleanupErrors.push(error instanceof Error ? error : new Error("Audio capture cleanup failed"))
    }

    try {
      playbackControls.cleanup()
    } catch (error) {
      cleanupErrors.push(error instanceof Error ? error : new Error("Playback cleanup failed"))
    }

    try {
      gemini.disconnect()
    } catch (error) {
      cleanupErrors.push(error instanceof Error ? error : new Error("Gemini disconnect failed"))
    }

    // Log cleanup errors but don't fail the session end
    if (cleanupErrors.length > 0) {
      console.error("[useCheckIn] Cleanup errors:", cleanupErrors)
    }

    dispatch({ type: "SET_COMPLETE" })

    if (finalSession) {
      callbacksRef.current.onSessionEnd?.(finalSession)
    }
  }, [audio, callbacksRef, data.messages, data.mismatchCount, data.session, dispatch, gemini, playbackControls])

  const cancelSession = useCallback(() => {
    audio.cleanupAudioCapture()
    playbackControls.cleanup()
    gemini.disconnect()
    dispatch({ type: "RESET" })
  }, [audio, dispatch, gemini, playbackControls])

  const getSession = useCallback(() => {
    if (!data.session) return null

    const duration = sessionStartRef.current ? (Date.now() - new Date(sessionStartRef.current).getTime()) / 1000 : 0

    return {
      ...data.session,
      endedAt: data.session.endedAt || new Date().toISOString(),
      messages: data.messages,
      mismatchCount: data.mismatchCount,
      duration,
    }
  }, [data.messages, data.mismatchCount, data.session])

  // ========================================
  // Session Preservation
  // ========================================

  const preserveSession = useCallback(() => {
    const client = gemini.getClient()
    if (!client || !client.isConnectionHealthy()) {
      console.warn("[useCheckIn] Cannot preserve - no healthy connection")
      return
    }

    if (!contextFingerprintRef.current) {
      console.warn("[useCheckIn] Cannot preserve - no context fingerprint")
      return
    }

    // Detach event handlers from the client (stops React from receiving events)
    client.detachEventHandlers()

    // Store the session in the preservation store
    storePreservedSession(client, data, contextFingerprintRef.current)

    // Cleanup local audio resources (but keep Gemini connected)
    audio.cleanupAudioCapture()
    playbackControls.cleanup()

    // Reset local state (session is now preserved externally)
    dispatch({ type: "RESET" })

    console.log("[useCheckIn] Session preserved")
  }, [audio, data, dispatch, gemini, playbackControls])

  const hasPreservedSession = useCallback(() => {
    return checkPreservedSession()
  }, [])

  const resumePreservedSession = useCallback(async () => {
    const preserved = consumePreservedSession()
    if (!preserved) {
      console.warn("[useCheckIn] No preserved session to resume")
      return
    }

    try {
      // Check if the connection is still healthy
      if (!preserved.client.isConnectionHealthy()) {
        console.warn("[useCheckIn] Preserved connection is no longer healthy")
        markSessionInvalid()
        throw new Error("Preserved connection lost")
      }

      // Restore the reducer state from the preserved snapshot
      dispatch({ type: "START_INITIALIZING" })

      // Allow audio capture re-initialization after prior cleanup (e.g., preserveSession).
      audio.resetCleanupRequestedFlag()

      // Initialize audio resources
      await playbackControls.initialize()
      await audio.initializeAudioCapture()

      // Reattach to the existing Gemini client
      gemini.reattachToClient(preserved.client)

      // Restore the context fingerprint
      contextFingerprintRef.current = preserved.contextFingerprint

      // Restore session data
      if (preserved.checkInData.session) {
        dispatch({ type: "SET_SESSION", session: preserved.checkInData.session })
        sessionStartRef.current = preserved.checkInData.session.startedAt
      }

      // Restore messages by replaying them
      for (const message of preserved.checkInData.messages) {
        dispatch({ type: "ADD_MESSAGE", message })
      }

      // Restore active widgets
      for (const widget of preserved.checkInData.widgets) {
        dispatch({ type: "ADD_WIDGET", widget })
      }

      // Set the appropriate state based on what was preserved
      dispatch({ type: "SET_READY" })
      dispatch({ type: "SET_LISTENING" })

      console.log("[useCheckIn] Session resumed successfully")
    } catch (error) {
      console.error("[useCheckIn] Failed to resume session:", error)
      // If resume fails, clean up and let caller handle
      audio.cleanupAudioCapture()
      playbackControls.cleanup()
      dispatch({ type: "RESET" })
      throw error
    }
  }, [audio, dispatch, gemini, playbackControls])

  const getContextFingerprint = useCallback(async () => {
    return computeContextFingerprint()
  }, [])

  const onConnected = useCallback(() => {
    dispatch({ type: "SET_READY" })
    dispatch({ type: "SET_AI_GREETING" })

    // Trigger AI to speak first by sending the conversation start signal.
    // The system instruction tells the AI to greet the user when it receives this.
    gemini.sendText("[START_CONVERSATION]")
  }, [dispatch, gemini])

  const onDisconnected = useCallback(
    (reason: string) => {
      console.log("[useCheckIn] Disconnected:", reason)
      const currentState = stateRef.current

      // Always release microphone + playback resources on disconnect.
      audio.cleanupAudioCapture()
      playbackControls.cleanup()

      // Only auto-complete if we were in an active state (user had chance to interact)
      const activeStates: CheckInState[] = [
        "ready",
        "ai_greeting",
        "listening",
        "user_speaking",
        "processing",
        "assistant_speaking",
      ]

      if (activeStates.includes(currentState)) {
        dispatch({ type: "SET_COMPLETE" })
      } else if (currentState !== "complete" && currentState !== "error") {
        // Disconnected during initialization - show error
        dispatch({
          type: "SET_ERROR",
          error: reason || "Connection failed during initialization",
        })
      }
    },
    [audio, dispatch, playbackControls, stateRef]
  )

  const onError = useCallback(
    (error: Error) => {
      dispatch({ type: "SET_ERROR", error: error.message })
      callbacksRef.current.onError?.(error)
    },
    [callbacksRef, dispatch]
  )

  const handlers: CheckInSessionGeminiHandlers = {
    onConnected,
    onDisconnected,
    onError,
  }

  return {
    startSession,
    endSession,
    cancelSession,
    getSession,
    preserveSession,
    hasPreservedSession,
    resumePreservedSession,
    getContextFingerprint,
    handlers,
  }
}
