"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch, MutableRefObject } from "react"
import { processAudio } from "@/lib/audio/processor"
import { db } from "@/lib/storage/db"
import { computeContextFingerprint } from "@/lib/gemini/context-fingerprint"
import { fetchCheckInContext, formatContextForAPI } from "@/lib/gemini/check-in-context"
import { logWarn } from "@/lib/logger"
import { createGeminiHeaders } from "@/lib/utils"
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

function createTimeoutError(message: string): Error {
  const err = new Error(message)
  err.name = "TimeoutError"
  return err
}

function getTimeOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  if (hour >= 17 && hour < 21) return "evening"
  return "night"
}

function formatUserLocalTime(now: Date): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(now)

  return timeZone ? `${formatted} (${timeZone})` : formatted
}

function buildFallbackTimeContext(): NonNullable<SessionContext["timeContext"]> {
  const now = new Date()
  const dayOfWeek = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now)

  return {
    currentTime: formatUserLocalTime(now),
    dayOfWeek,
    timeOfDay: getTimeOfDay(now.getHours()),
    daysSinceLastCheckIn: null,
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(createTimeoutError(timeoutMessage))
    }, ms)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

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
  startSession: (options?: { userGesture?: boolean }) => Promise<void>
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
  const startConversationSentRef = useRef(false)

  // Abort/cleanup coordination for in-flight startSession work.
  // Without this, async preflight can continue after unmount and spin up
  // playback/capture resources, leading to leaked AudioContexts and overlapping voices.
  // Pattern doc: docs/error-patterns/check-in-session-init-after-unmount.md
  const startSessionRunIdRef = useRef(0)
  const startSessionAbortRef = useRef(false)
  const unmountedRef = useRef(false)

  useEffect(() => {
    // React StrictMode (dev) may run effect cleanups and then re-run effects
    // while preserving refs. Reset this flag on (re)mount so sessions can start.
    // Pattern doc: docs/error-patterns/strictmode-effect-cleanup-preserves-refs.md
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      startSessionAbortRef.current = true
      // Invalidate any in-flight startSession runs.
      startSessionRunIdRef.current += 1
    }
  }, [])

  const startSession = useCallback(
    async (options?: { userGesture?: boolean }) => {
      logWarn("useCheckIn", "startSession invoked")
      // Track what's been initialized for proper cleanup on failure
      let playbackInitialized = false
      let captureInitialized = false

      // New startSession run supersedes any previous in-flight run.
      startSessionRunIdRef.current += 1
      const runId = startSessionRunIdRef.current
      startSessionAbortRef.current = false

      const ensureActive = () => {
        if (unmountedRef.current || startSessionAbortRef.current) {
          throw new Error("INITIALIZATION_ABORTED")
        }
        if (startSessionRunIdRef.current !== runId) {
          throw new Error("SESSION_SUPERSEDED")
        }
      }

      try {
        ensureActive()
        dispatch({ type: "START_INITIALIZING" })

        startConversationSentRef.current = false
        contextFingerprintRef.current = null

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

        // Build time context (and optional historical summary) for Gemini systemInstruction.
        // Pattern doc: docs/error-patterns/utc-local-time-mismatch-in-prompts.md
        const fallbackTimeContext = buildFallbackTimeContext()
        const contextPromise = (async () => {
          try {
            const contextData = await fetchCheckInContext()

            const timeContext = {
              currentTime: contextData.timeContext.currentTime,
              dayOfWeek: contextData.timeContext.dayOfWeek,
              timeOfDay: contextData.timeContext.timeOfDay,
              daysSinceLastCheckIn: contextData.timeContext.daysSinceLastCheckIn,
            } satisfies NonNullable<SessionContext["timeContext"]>

            // Fetch an optional context summary (Gemini Flash) for a personalized greeting.
            // Failures here should NOT block the live session starting.
            let contextSummary: SessionContext["contextSummary"] | undefined
            try {
              const requestBody = formatContextForAPI(contextData)
              const headers = await createGeminiHeaders({ "Content-Type": "application/json" })

              const response = await fetch("/api/gemini/check-in-context", {
                method: "POST",
                headers,
                body: JSON.stringify(requestBody),
              })

              if (response.ok) {
                const json = (await response.json()) as { summary?: unknown }
                const summary = (json as { summary?: unknown }).summary as
                  | { patternSummary?: unknown; keyObservations?: unknown; contextNotes?: unknown }
                  | undefined

                if (
                  summary &&
                  typeof summary.patternSummary === "string" &&
                  Array.isArray(summary.keyObservations) &&
                  typeof summary.contextNotes === "string"
                ) {
                  contextSummary = {
                    patternSummary: summary.patternSummary,
                    keyObservations: summary.keyObservations as string[],
                    contextNotes: summary.contextNotes,
                  }
                }
              }
            } catch {
              // Ignore summary failures - timeContext is still valuable.
            }

            return { timeContext, contextSummary }
          } catch {
            return { timeContext: fallbackTimeContext, contextSummary: undefined }
          }
        })()

        // If this startSession isn't called within a user activation (e.g., auto-start in a useEffect),
        // yield once so React unmount/cleanup (StrictMode) can abort before we allocate AudioContexts/worklets.
        // When called from a click/tap handler, avoid yielding before audio init to satisfy autoplay policies.
        if (!options?.userGesture) {
          await Promise.resolve()
          ensureActive()
        }

        // Compute context fingerprint in the background (never block startup).
        // This is used only for session preservation/resumption.
        void (async () => {
          try {
            const fingerprint = await withTimeout(
              computeContextFingerprint(),
              10_000,
              "Context fingerprint timed out"
            )
            // Only store if this startSession run is still active.
            if (!unmountedRef.current && startSessionRunIdRef.current === runId) {
              contextFingerprintRef.current = fingerprint
            }
          } catch (fingerprintError) {
            console.warn("[useCheckIn] Context fingerprint failed/timed out:", fingerprintError)
          }
        })()

        // Initialize playback first (needs user gesture context)
        dispatch({ type: "SET_INIT_PHASE", phase: "init_audio_playback" })
        await withTimeout(
          playbackControls.initialize(),
          20_000,
          "Audio setup timed out. If you’re on Safari/iOS, tap the screen once and try again."
        )
        playbackInitialized = true
        ensureActive()

        // Initialize audio capture AFTER playback to avoid worklet loading race
        // Some browsers can only load one AudioWorklet module at a time
        dispatch({ type: "SET_INIT_PHASE", phase: "init_audio_capture" })
        await withTimeout(
          audio.initializeAudioCapture(),
          60_000,
          "Microphone setup timed out. Check your browser mic permissions and try again."
        )
        captureInitialized = true
        ensureActive()

        dispatch({ type: "SET_INIT_PHASE", phase: "connecting_gemini" })
        dispatch({ type: "SET_CONNECTING" })

        // Load user's voice preference from settings (fast IndexedDB read)
        let voiceName: string | undefined
        try {
          const settings = await db.settings.get("default")
          voiceName = settings?.selectedGeminiVoice
        } catch {
          // If settings read fails, continue without voice preference
        }

        // Prefer full time context + optional summary (but never block startup indefinitely).
        let timeContext: NonNullable<SessionContext["timeContext"]> = fallbackTimeContext
        let contextSummary: SessionContext["contextSummary"] | undefined
        try {
          const ctx = await withTimeout(contextPromise, 15_000, "Context generation timed out")
          timeContext = ctx.timeContext ?? timeContext
          contextSummary = ctx.contextSummary
        } catch {
          // Keep fallback timeContext; proceed without summary.
        }

        const sessionContext: SessionContext = {
          timeContext,
          ...(contextSummary ? { contextSummary } : {}),
          ...(voiceName ? { voiceName } : {}),
        }

        // Connect to Gemini with voice context
        await withTimeout(
          gemini.connect(sessionContext),
          45_000,
          "Gemini connection timed out. Check your API key and network, then try again."
        )
        ensureActive()

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
          // Reset to idle so second mount can try again (avoid setState after unmount)
          if (!unmountedRef.current) {
            dispatch({ type: "RESET" })
          }
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
    startSessionAbortRef.current = true
    startConversationSentRef.current = false
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
      dispatch({ type: "SET_INIT_PHASE", phase: "init_audio_playback" })
      await withTimeout(
        playbackControls.initialize(),
        20_000,
        "Audio setup timed out. If you’re on Safari/iOS, tap the screen once and try again."
      )

      dispatch({ type: "SET_INIT_PHASE", phase: "init_audio_capture" })
      await withTimeout(
        audio.initializeAudioCapture(),
        60_000,
        "Microphone setup timed out. Check your browser mic permissions and try again."
      )

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
    dispatch({ type: "SET_INIT_PHASE", phase: "waiting_ai_response" })
    dispatch({ type: "SET_AI_GREETING" })

    // Trigger AI to speak first by sending the conversation start signal.
    // The system instruction tells the AI to greet the user when it receives this.
    if (!startConversationSentRef.current) {
      startConversationSentRef.current = true
      gemini.sendText("[START_CONVERSATION]")
    }
  }, [dispatch, gemini])

  const onDisconnected = useCallback(
    (reason: string) => {
      console.log("[useCheckIn] Disconnected:", reason)
      const currentState = stateRef.current
      const hasUserMessage = data.messages.some((m) => m.role === "user" && m.content.trim().length > 0)
      const normalizedReason = (reason || "").toLowerCase()

      // Always release microphone + playback resources on disconnect.
      audio.cleanupAudioCapture()
      playbackControls.cleanup()

      // Manual disconnects happen during end/cancel flows and should not force the UI into error/complete.
      if (normalizedReason.includes("manual disconnect")) {
        return
      }

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
        // If the user never spoke, treat disconnects as errors (common on invalid config / auth).
        if (!hasUserMessage || normalizedReason.includes("invalid argument")) {
          dispatch({
            type: "SET_ERROR",
            error: reason || "Connection lost before you could respond",
          })
        } else {
          dispatch({ type: "SET_COMPLETE" })
        }
      } else if (currentState !== "complete" && currentState !== "error") {
        // Disconnected during initialization - show error
        dispatch({
          type: "SET_ERROR",
          error: reason || "Connection failed during initialization",
        })
      }
    },
    [audio, data.messages, dispatch, playbackControls, stateRef]
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
