"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch, MutableRefObject } from "react"
import { processAudio, validateAudioData } from "@/lib/audio/processor"
import { db, fromCommitment } from "@/lib/storage/db"
import { computeContextFingerprint } from "@/lib/gemini/context-fingerprint"
import { fetchCheckInContext, formatContextForAPI } from "@/lib/gemini/check-in-context"
import { logDebug, logWarn } from "@/lib/logger"
import { createGeminiHeaders } from "@/lib/utils"
import {
  consumePreservedSession,
  clearPreservedSession,
  hasPreservedSession as checkPreservedSession,
  markSessionInvalid,
  preserveSession as storePreservedSession,
} from "@/lib/gemini/preserved-session"
import type { GeminiLiveClient, SessionContext } from "@/lib/gemini/live-client"
import type {
  AccountabilityMode,
  CheckInMessage,
  CheckInSession,
  CheckInState,
  Commitment,
  CommitmentToolArgs,
  Suggestion,
} from "@/lib/types"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import { blendAcousticAndSemanticBiomarkers, inferSemanticBiomarkersFromText } from "@/lib/ml/biomarker-fusion"
import { VALIDATION } from "@/lib/ml/thresholds"
import { generateId, type CheckInAction, type CheckInData } from "./use-check-in-messages"
import type { UseCheckInAudioResult } from "./use-check-in-audio"

const ACTIVE_CHECK_IN_STATES: ReadonlyArray<CheckInState> = [
  "ready",
  "ai_greeting",
  "listening",
  "user_speaking",
  "processing",
  "assistant_speaking",
]

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

type ContextPreloadResult = {
  timeContext: NonNullable<SessionContext["timeContext"]>
  contextSummary: SessionContext["contextSummary"] | undefined
  pendingCommitments: Commitment[]
  recentSuggestions: Suggestion[]
}

async function preloadSessionContext(options: {
  fallbackTimeContext: NonNullable<SessionContext["timeContext"]>
}): Promise<ContextPreloadResult> {
  const { fallbackTimeContext } = options

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

    return {
      timeContext,
      contextSummary,
      pendingCommitments: contextData.pendingCommitments ?? [],
      recentSuggestions: contextData.recentSuggestions ?? [],
    }
  } catch {
    return {
      timeContext: fallbackTimeContext,
      contextSummary: undefined,
      pendingCommitments: [],
      recentSuggestions: [],
    }
  }
}

function kickoffContextFingerprintComputation(options: {
  runId: number
  startSessionRunIdRef: MutableRefObject<number>
  unmountedRef: MutableRefObject<boolean>
  contextFingerprintRef: MutableRefObject<string | null>
}): void {
  const { runId, startSessionRunIdRef, unmountedRef, contextFingerprintRef } = options

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
}

function extendContextSummary(options: {
  accountabilityMode: AccountabilityMode | undefined
  contextSummary: SessionContext["contextSummary"] | undefined
  pendingCommitments: Commitment[]
  recentSuggestions: Suggestion[]
}): SessionContext["contextSummary"] | undefined {
  const { accountabilityMode, contextSummary, pendingCommitments, recentSuggestions } = options

  if (accountabilityMode === "supportive") {
    return contextSummary
  }

  if (pendingCommitments.length === 0 && recentSuggestions.length === 0) {
    return contextSummary
  }

  if (!contextSummary) {
    return {
      patternSummary: "No prior check-in summary is available yet.",
      keyObservations: [],
      contextNotes: "Use the follow-up context below naturally in conversation.",
      pendingCommitments,
      recentSuggestions,
    }
  }

  return {
    ...contextSummary,
    pendingCommitments,
    recentSuggestions,
  }
}

function computeSessionDurationSeconds(sessionStartIso: string | null): number {
  return sessionStartIso ? (Date.now() - new Date(sessionStartIso).getTime()) / 1000 : 0
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function formatMessagesForReconnect(messages: CheckInMessage[]): string {
  const MAX_MESSAGES = 8
  const MAX_CHARS_PER_MESSAGE = 280

  const recent = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_MESSAGES)

  if (recent.length === 0) return "(no prior messages)"

  return recent
    .map((m) => {
      const speaker = m.role === "assistant" ? "Kanari" : "User"
      const content = normalizeWhitespace(m.content)
      const clipped =
        content.length > MAX_CHARS_PER_MESSAGE
          ? `${content.slice(0, MAX_CHARS_PER_MESSAGE - 1)}…`
          : content
      return `${speaker}: ${clipped}`
    })
    .join("\n")
}

function buildReconnectResumeMessage(options: {
  timeContext: NonNullable<SessionContext["timeContext"]>
  messages: CheckInMessage[]
}): string {
  const { timeContext, messages } = options

  return normalizeWhitespace(`
[RESUME_CONVERSATION]
We briefly lost connection and just reconnected.

Current time (user local): ${timeContext.currentTime}

Conversation so far (most recent last):
${formatMessagesForReconnect(messages)}

Instructions:
- Continue the SAME conversation naturally.
- Do NOT re-introduce yourself or restart the session.
- If your last message was cut off, restate it cleanly and then continue.
- Keep your next reply short (1-2 sentences) and end with ONE question.
`)
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

async function initializeAudioPlayback(options: {
  dispatch: Dispatch<CheckInAction>
  playbackControls: PlaybackControls
}): Promise<void> {
  const { dispatch, playbackControls } = options

  // Initialize playback first (needs user gesture context)
  dispatch({ type: "SET_INIT_PHASE", phase: "init_audio_playback" })
  await withTimeout(
    playbackControls.initialize(),
    20_000,
    "Audio setup timed out. If you’re on Safari/iOS, tap the screen once and try again."
  )
}

async function initializeAudioCapture(options: {
  dispatch: Dispatch<CheckInAction>
  audio: UseCheckInAudioResult
}): Promise<void> {
  const { dispatch, audio } = options

  // Initialize audio capture AFTER playback to avoid worklet loading race
  // Some browsers can only load one AudioWorklet module at a time
  dispatch({ type: "SET_INIT_PHASE", phase: "init_audio_capture" })
  await withTimeout(
    audio.initializeAudioCapture(),
    60_000,
    "Microphone setup timed out. Check your browser mic permissions and try again."
  )
}

async function loadUserSessionPrefs(): Promise<{
  voiceName: string | undefined
  accountabilityMode: AccountabilityMode | undefined
  userName: string | undefined
}> {
  // Load user preferences from settings (fast IndexedDB read)
  let voiceName: string | undefined
  let accountabilityMode: AccountabilityMode | undefined
  let userName: string | undefined
  try {
    const settings = await db.settings.get("default")
    voiceName = settings?.selectedGeminiVoice
    accountabilityMode = settings?.accountabilityMode ?? "balanced"
    userName = settings?.userName
  } catch {
    // If settings read fails, continue with defaults
  }

  return { voiceName, accountabilityMode, userName }
}

function cleanupStartSessionInit(options: {
  captureInitialized: boolean
  playbackInitialized: boolean
  audio: UseCheckInAudioResult
  playbackControls: PlaybackControls
}): void {
  const { captureInitialized, playbackInitialized, audio, playbackControls } = options

  // Cleanup only what was initialized (in reverse order)
  if (captureInitialized) {
    audio.cleanupAudioCapture()
  }
  if (playbackInitialized) {
    playbackControls.cleanup()
  }
}

function cleanupSessionResources(options: {
  audio: UseCheckInAudioResult
  playbackControls: PlaybackControls
  gemini: GeminiControls
}): Error[] {
  const { audio, playbackControls, gemini } = options
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

  return cleanupErrors
}

function computeHasUserParticipation(options: {
  messages: CheckInData["messages"]
  currentUserTranscript: string
  acousticMetrics: CheckInSession["acousticMetrics"] | undefined
}): boolean {
  const { messages, currentUserTranscript, acousticMetrics } = options

  // Pattern doc: docs/error-patterns/check-in-results-missing-on-disconnect.md
  const hasUserMessage = messages.some((m) => m.role === "user" && m.content.trim().length > 0)
  const hasTranscript = currentUserTranscript.trim().length > 0
  const hasVoiceMetrics = Boolean(acousticMetrics)
  return hasUserMessage || hasTranscript || hasVoiceMetrics
}

function restorePreservedCheckInData(options: {
  dispatch: Dispatch<CheckInAction>
  preservedData: CheckInData
  sessionStartRef: MutableRefObject<string | null>
}): void {
  const { dispatch, preservedData, sessionStartRef } = options

  if (preservedData.session) {
    dispatch({ type: "SET_SESSION", session: preservedData.session })
    sessionStartRef.current = preservedData.session.startedAt
  }

  // Restore messages by replaying them
  for (const message of preservedData.messages) {
    dispatch({ type: "ADD_MESSAGE", message })
  }

  // Restore active widgets
  for (const widget of preservedData.widgets) {
    dispatch({ type: "ADD_WIDGET", widget })
  }
}

type DisconnectHandling =
  | { kind: "ignore" }
  | { kind: "noop" }
  | { kind: "set_error"; message: string }
  | { kind: "attempt_reconnect"; messageIfReconnectFails: string }

function determineDisconnectHandling(options: {
  reason: string
  currentState: CheckInState
  endSessionInProgress: boolean
  hasUserParticipation: boolean
}): DisconnectHandling {
  const { reason, currentState, endSessionInProgress, hasUserParticipation } = options
  const normalizedReason = (reason || "").toLowerCase()

  // Manual disconnects happen during end/cancel flows and should not force the UI into error/complete.
  if (normalizedReason.includes("manual disconnect")) {
    return { kind: "ignore" }
  }

  if (endSessionInProgress) {
    return { kind: "ignore" }
  }

  if (ACTIVE_CHECK_IN_STATES.includes(currentState)) {
    // If the user never spoke, treat disconnects as errors (common on invalid config / auth).
    if (!hasUserParticipation || normalizedReason.includes("invalid argument")) {
      return {
        kind: "set_error",
        message: reason || "Connection lost before you could respond",
      }
    }

    // Unexpected disconnect during an active session: prefer reconnecting so the user can
    // keep talking in the same check-in (especially important after scheduling tool calls).
    // Pattern doc: docs/error-patterns/schedule-activity-disconnect-ends-session.md
    return {
      kind: "attempt_reconnect",
      messageIfReconnectFails: reason || "Connection lost",
    }
  }

  if (currentState !== "complete" && currentState !== "error") {
    return {
      kind: "set_error",
      message: reason || "Connection failed during initialization",
    }
  }

  return { kind: "noop" }
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
  onCommitment: (commitment: CommitmentToolArgs) => void
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
  const sessionContextRef = useRef<SessionContext | null>(null)

  // Abort/cleanup coordination for in-flight startSession work.
  // Without this, async preflight can continue after unmount and spin up
  // playback/capture resources, leading to leaked AudioContexts and overlapping voices.
  // Pattern doc: docs/error-patterns/check-in-session-init-after-unmount.md
  const startSessionRunIdRef = useRef(0)
  const startSessionAbortRef = useRef(false)
  const unmountedRef = useRef(false)
  const endSessionInProgressRef = useRef(false)

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
        const contextPromise = preloadSessionContext({ fallbackTimeContext })

        // If this startSession isn't called within a user activation (e.g., auto-start in a useEffect),
        // yield once so React unmount/cleanup (StrictMode) can abort before we allocate AudioContexts/worklets.
        // When called from a click/tap handler, avoid yielding before audio init to satisfy autoplay policies.
        if (!options?.userGesture) {
          await Promise.resolve()
          ensureActive()
        }

        kickoffContextFingerprintComputation({
          runId,
          startSessionRunIdRef,
          unmountedRef,
          contextFingerprintRef,
        })

        await initializeAudioPlayback({ dispatch, playbackControls })
        playbackInitialized = true
        ensureActive()

        await initializeAudioCapture({ dispatch, audio })
        captureInitialized = true
        ensureActive()

        dispatch({ type: "SET_INIT_PHASE", phase: "connecting_gemini" })
        dispatch({ type: "SET_CONNECTING" })

        const { voiceName, accountabilityMode, userName } = await loadUserSessionPrefs()

        // Prefer full time context + optional summary (but never block startup indefinitely).
        let timeContext: NonNullable<SessionContext["timeContext"]> = fallbackTimeContext
        let contextSummary: SessionContext["contextSummary"] | undefined
        let pendingCommitments: Commitment[] = []
        let recentSuggestions: Suggestion[] = []
        try {
          const ctx = await withTimeout(contextPromise, 15_000, "Context generation timed out")
          timeContext = ctx.timeContext ?? timeContext
          contextSummary = ctx.contextSummary
          pendingCommitments = ctx.pendingCommitments ?? []
          recentSuggestions = ctx.recentSuggestions ?? []
        } catch {
          // Keep fallback timeContext; proceed without summary.
        }

        const extendedContextSummary = extendContextSummary({
          accountabilityMode,
          contextSummary,
          pendingCommitments,
          recentSuggestions,
        })

        const sessionContext: SessionContext = {
          timeContext,
          ...(extendedContextSummary ? { contextSummary: extendedContextSummary } : {}),
          ...(voiceName ? { voiceName } : {}),
          ...(accountabilityMode ? { accountabilityMode } : {}),
          ...(userName ? { userName } : {}),
        }
        sessionContextRef.current = sessionContext

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
          logDebug("useCheckIn", "Session initialization aborted (StrictMode cleanup)")
          cleanupStartSessionInit({
            captureInitialized,
            playbackInitialized,
            audio,
            playbackControls,
          })
          // Reset to idle so second mount can try again (avoid setState after unmount)
          if (!unmountedRef.current) {
            dispatch({ type: "RESET" })
          }
          return
        }

        // SESSION_SUPERSEDED means a newer session started while this one was initializing.
        if (err.message === "SESSION_SUPERSEDED") {
          logDebug("useCheckIn", "Session superseded by newer initialization")
          // Don't cleanup - the new session owns the resources now
          // Don't dispatch anything - let the new session handle state
          return
        }

        // Real errors get shown to the user
        dispatch({ type: "SET_ERROR", error: err.message })
        callbacksRef.current.onError?.(err)

        cleanupStartSessionInit({
          captureInitialized,
          playbackInitialized,
          audio,
          playbackControls,
        })
      }
    },
    [audio, callbacksRef, dispatch, gemini, playbackControls]
  )

  const endSession = useCallback(async () => {
    if (endSessionInProgressRef.current) {
      return
    }

    endSessionInProgressRef.current = true

    try {
      dispatch({ type: "SET_ENDING" })

      // Clear any preserved session (user explicitly ended, don't preserve)
      clearPreservedSession(false) // false = don't disconnect, we'll do it below

      const sessionAudio = audio.getSessionAudio()
      const sessionAudioData = sessionAudio ? Array.from(sessionAudio) : undefined
      const sessionSampleRate = sessionAudio ? 16000 : undefined

      let acousticMetrics = data.session?.acousticMetrics
      if (!acousticMetrics && sessionAudio) {
        try {
          // Don't compute biomarkers from silence/mic noise.
          // Pattern doc: docs/error-patterns/check-in-silence-produces-fake-biomarkers.md
          if (!validateAudioData(sessionAudio)) {
            logDebug("useCheckIn", "Skipped session-level biomarkers (no audio signal detected)")
          } else {
            const processed = await processAudio(sessionAudio, {
              sampleRate: 16000,
              enableVAD: true,
            })

            const speechSeconds = Number(processed.metadata?.speechDuration ?? 0)
            if (!Number.isFinite(speechSeconds) || speechSeconds < VALIDATION.MIN_SPEECH_SECONDS) {
              logDebug("useCheckIn", `Skipped session-level biomarkers (speechDuration=${speechSeconds}s)`)
            } else {
              const metrics = analyzeVoiceMetrics(processed.features)

              const userTranscript = data.messages
                .filter((m) => m.role === "user")
                .map((m) => m.content)
                .join("\n")
              const semantic = inferSemanticBiomarkersFromText(userTranscript)
              const blended = blendAcousticAndSemanticBiomarkers({
                acoustic: {
                  stressScore: metrics.stressScore,
                  fatigueScore: metrics.fatigueScore,
                  confidence: metrics.confidence,
                },
                semantic: {
                  stressScore: semantic.stressScore,
                  fatigueScore: semantic.fatigueScore,
                  stressConfidence: semantic.stressConfidence,
                  fatigueConfidence: semantic.fatigueConfidence,
                },
              })

              acousticMetrics = {
                stressScore: blended.stressScore,
                fatigueScore: blended.fatigueScore,
                stressLevel: blended.stressLevel,
                fatigueLevel: blended.fatigueLevel,
                confidence: blended.confidence,
                analyzedAt: metrics.analyzedAt,
                features: processed.features,

                acousticStressScore: metrics.stressScore,
                acousticFatigueScore: metrics.fatigueScore,
                acousticStressLevel: metrics.stressLevel,
                acousticFatigueLevel: metrics.fatigueLevel,
                acousticConfidence: metrics.confidence,

                semanticStressScore: semantic.stressScore,
                semanticFatigueScore: semantic.fatigueScore,
                semanticConfidence: Math.max(semantic.stressConfidence, semantic.fatigueConfidence),
                semanticSource: semantic.source,
              }

              dispatch({ type: "SET_SESSION_ACOUSTIC_METRICS", metrics: acousticMetrics })
            }
          }
        } catch (error) {
          console.warn("[useCheckIn] Failed to compute session-level metrics:", error)
        }
      }

      // Calculate session duration
      const duration = computeSessionDurationSeconds(sessionStartRef.current)

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
      const cleanupErrors = cleanupSessionResources({ audio, playbackControls, gemini })

      // Log cleanup errors but don't fail the session end
      if (cleanupErrors.length > 0) {
        console.error("[useCheckIn] Cleanup errors:", cleanupErrors)
      }

      dispatch({ type: "SET_COMPLETE" })

      if (finalSession) {
        callbacksRef.current.onSessionEnd?.(finalSession)
      }
    } finally {
      endSessionInProgressRef.current = false
    }
  }, [audio, callbacksRef, data.messages, data.mismatchCount, data.session, dispatch, gemini, playbackControls])

  const reconnectInProgressRef = useRef(false)

  const attemptReconnect = useCallback(async (): Promise<boolean> => {
    if (reconnectInProgressRef.current) return false
    reconnectInProgressRef.current = true

    try {
      // Preserve the existing session + UI history; only re-establish Gemini.
      dispatch({ type: "SET_INIT_PHASE", phase: "connecting_gemini" })
      dispatch({ type: "SET_CONNECTING" })

      // Refresh the user's local time context. Reconnects can happen minutes later,
      // and stale time-of-day can cause the model to greet incorrectly.
      // Pattern doc: docs/error-patterns/utc-local-time-mismatch-in-prompts.md
      const refreshedTime = buildFallbackTimeContext()

      const previousContext = sessionContextRef.current
      const mergedTimeContext = {
        ...refreshedTime,
        daysSinceLastCheckIn:
          previousContext?.timeContext?.daysSinceLastCheckIn ?? refreshedTime.daysSinceLastCheckIn,
      } satisfies NonNullable<SessionContext["timeContext"]>

      const context: SessionContext | undefined = previousContext
        ? { ...previousContext, timeContext: mergedTimeContext }
        : { timeContext: mergedTimeContext }

      sessionContextRef.current = context
      await withTimeout(
        gemini.connect(context),
        30_000,
        "Gemini reconnect timed out. Check your network and API key, then try again."
      )

      // The Live session is brand new after reconnect; rehydrate the assistant with
      // a short recap so it doesn't restart the chat or merge turns.
      gemini.sendText(
        buildReconnectResumeMessage({
          timeContext: mergedTimeContext,
          messages: data.messages,
        })
      )
      return true
    } catch (error) {
      console.error("[useCheckIn] Reconnect failed:", error)
      return false
    } finally {
      reconnectInProgressRef.current = false
    }
  }, [data.messages, dispatch, gemini])

  const cancelSession = useCallback(() => {
    startSessionAbortRef.current = true
    startConversationSentRef.current = false
    sessionContextRef.current = null
    audio.cleanupAudioCapture()
    playbackControls.cleanup()
    gemini.disconnect()
    dispatch({ type: "RESET" })
  }, [audio, dispatch, gemini, playbackControls])

  const getSession = useCallback(() => {
    if (!data.session) return null

    const duration = computeSessionDurationSeconds(sessionStartRef.current)

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

    logDebug("useCheckIn", "Session preserved")
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
      await initializeAudioPlayback({ dispatch, playbackControls })
      await initializeAudioCapture({ dispatch, audio })

      // Reattach to the existing Gemini client
      gemini.reattachToClient(preserved.client)

      // Restore the context fingerprint
      contextFingerprintRef.current = preserved.contextFingerprint

      restorePreservedCheckInData({
        dispatch,
        preservedData: preserved.checkInData,
        sessionStartRef,
      })

      // Set the appropriate state based on what was preserved
      dispatch({ type: "SET_READY" })
      dispatch({ type: "SET_LISTENING" })

      logDebug("useCheckIn", "Session resumed successfully")
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

    // Fresh session: enforce "AI speaks first".
    // Reconnect path: preserve the ongoing conversation state (do not re-greet).
    const hasAnyMessages = data.messages.length > 0
    if (!hasAnyMessages) {
      dispatch({ type: "SET_INIT_PHASE", phase: "waiting_ai_response" })
      dispatch({ type: "SET_AI_GREETING" })

      // Trigger AI to speak first by sending the conversation start signal.
      // The system instruction tells the AI to greet the user when it receives this.
      if (!startConversationSentRef.current) {
        startConversationSentRef.current = true
        gemini.sendText("[START_CONVERSATION]")
      }
      return
    }

    dispatch({ type: "SET_LISTENING" })
  }, [data.messages.length, dispatch, gemini])

  const onDisconnected = useCallback(
    (reason: string) => {
      logDebug("useCheckIn", "Disconnected", reason)
      const currentState = stateRef.current

      const hasUserParticipation = computeHasUserParticipation({
        messages: data.messages,
        currentUserTranscript: data.currentUserTranscript,
        acousticMetrics: data.session?.acousticMetrics,
      })

      const handling = determineDisconnectHandling({
        reason,
        currentState,
        endSessionInProgress: endSessionInProgressRef.current,
        hasUserParticipation,
      })

      if (handling.kind === "ignore" || handling.kind === "noop") {
        return
      }

      if (handling.kind === "set_error") {
        // Always release microphone + playback resources on disconnect.
        audio.cleanupAudioCapture()
        playbackControls.cleanup()

        dispatch({
          type: "SET_ERROR",
          error: handling.message,
        })
        return
      }

      // handling.kind === "attempt_reconnect"
      void (async () => {
        const reconnected = await attemptReconnect()
        if (reconnected) return

        // If we cannot reconnect, surface an error (do not auto-complete the session).
        // Users can explicitly end the check-in if they want to save it.
        audio.cleanupAudioCapture()
        playbackControls.cleanup()
        dispatch({
          type: "SET_ERROR",
          error: handling.messageIfReconnectFails,
        })
      })()
    },
    [
      audio,
      attemptReconnect,
      data.currentUserTranscript,
      data.messages,
      data.session?.acousticMetrics,
      dispatch,
      playbackControls,
      stateRef,
    ]
  )

  const onError = useCallback(
    (error: Error) => {
      dispatch({ type: "SET_ERROR", error: error.message })
      callbacksRef.current.onError?.(error)
    },
    [callbacksRef, dispatch]
  )

  const onCommitment = useCallback(
    (commitmentArgs: CommitmentToolArgs) => {
      const sessionId = data.session?.id
      if (!sessionId) return

      const commitment: Commitment = {
        id: generateId(),
        checkInSessionId: sessionId,
        content: commitmentArgs.content,
        category: commitmentArgs.category,
        extractedAt: new Date().toISOString(),
      }

      void (async () => {
        try {
          await db.commitments.put(fromCommitment(commitment))
        } catch (error) {
          console.warn("[useCheckIn] Failed to persist commitment:", error)
        }
      })()
    },
    [data.session?.id]
  )

  const handlers: CheckInSessionGeminiHandlers = {
    onConnected,
    onDisconnected,
    onError,
    onCommitment,
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
