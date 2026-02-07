"use client"

/**
 * AI Chat Content Component
 *
 * This component handles the "AI chat" mode of the unified check-in feature.
 * It was extracted from check-in-dialog.tsx to work inside the new tabbed
 * CheckInDrawer.
 *
 * What it does:
 * 1. Connects to Gemini Live via WebSocket for real-time voice conversation
 * 2. Captures user voice and streams it to Gemini
 * 3. Plays back Gemini's audio response in real-time
 * 4. Shows live transcription of both user and AI speech
 * 5. Detects voice/text emotion mismatches (e.g., happy words but stressed voice)
 * 6. Saves the conversation session to IndexedDB
 *
 * Key differences from the original check-in-dialog.tsx:
 * - Removed Dialog wrapper (now lives inside Drawer)
 * - Added onSessionChange callback to notify parent when chat is active
 * - Session starts only after explicit user action (Start button)
 *
 * Technical notes:
 * - Uses Server-Sent Events (SSE) to receive Gemini audio at 24kHz
 * - Sends user audio at 16kHz PCM via POST requests
 * - Supports barge-in (interrupt AI while it's speaking)
 * - Has mute functionality to pause microphone input
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { KanariError } from "@/lib/errors"
import { logDebug, logError, logWarn } from "@/lib/logger"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { PhoneOff, MicOff, Square } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useCheckIn } from "@/hooks/use-check-in"
import { useStrictModeReady } from "@/hooks/use-strict-mode-ready"
import { useCheckInSessionActions } from "@/hooks/use-storage"
import { Spinner } from "@/components/ui/spinner"
import { BiomarkerIndicator } from "@/components/check-in/biomarker-indicator"
import { ConversationView } from "@/components/check-in/conversation-view"
import { ChatInput } from "@/components/check-in/chat-input"
import {
  BreathingExercise,
  JournalPrompt,
  QuickActions,
  ScheduleConfirmation,
  StressGauge,
} from "@/components/check-in/widgets"
import {
  getPreservedFingerprint,
  clearPreservedSession,
} from "@/lib/gemini/preserved-session"
import { db, fromSuggestion, toJournalEntry } from "@/lib/storage/db"
import { synthesizeCheckInSession } from "@/lib/gemini/synthesis-client"
import { blendAcousticAndSemanticBiomarkers } from "@/lib/ml/biomarker-fusion"
import { SynthesisScreen } from "@/components/check-in/synthesis-screen"
import { Deck } from "@/components/dashboard/deck"
import type { CheckInSession, CheckInSynthesis, Suggestion } from "@/lib/types"
import type { InitPhase } from "@/hooks/check-in/state"

function getInitPhaseLabel(phase: InitPhase): string {
  switch (phase) {
    case "fetching_context":
      return "Loading your history..."
    case "init_audio_playback":
      return "Setting up audio..."
    case "init_audio_capture":
      return "Requesting microphone..."
    case "connecting_gemini":
      return "Connecting to kanari..."
    case "waiting_ai_response":
      return "Waiting for kanari to start..."
    default:
      return "Setting up voice conversation..."
  }
}

interface CheckInAIChatProps {
  /** Called when session ends - parent should close the drawer */
  onClose?: () => void
  /** Called when chat state changes - parent uses this to disable tab switching */
  onSessionChange?: (isActive: boolean) => void
  /** Called when the conversation session is saved to IndexedDB */
  onSessionComplete?: (session: CheckInSession) => void
  /** Visual chrome variant for embedding contexts */
  chrome?: "default" | "glass"
  /** When true, parent is requesting to discard the session */
  requestDiscard?: boolean
  /** Called after session has been cancelled due to discard request */
  onDiscardComplete?: () => void

  /** When true, auto-starts the session on mount (user-gesture path only). */
  autoStart?: boolean
}

export function AIChatContent({
  onClose,
  onSessionChange,
  onSessionComplete,
  chrome = "default",
  requestDiscard,
  onDiscardComplete,
  autoStart = false,
}: CheckInAIChatProps) {
  const isGlassChrome = chrome === "glass"
  // Hook to save completed sessions to IndexedDB
  const router = useRouter()
  const { addCheckInSession, updateCheckInSession } = useCheckInSessionActions()

  // Post-check-in synthesis state
  const [completedSession, setCompletedSession] = useState<CheckInSession | null>(null)
  const [synthesis, setSynthesis] = useState<CheckInSynthesis | null>(null)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [synthesisError, setSynthesisError] = useState<string | null>(null)
  const synthesisAbortRef = useRef<AbortController | null>(null)
  const lastSynthesizedSessionIdRef = useRef<string | null>(null)

  // Tool focus mode (lets tools take over the main panel)
  const [focusedWidgetId, setFocusedWidgetId] = useState<string | null>(null)
  const [journalDrafts, setJournalDrafts] = useState<Record<string, string>>({})
  const [breathingDrafts, setBreathingDrafts] = useState<Record<string, number>>({})
  const [autoStartStatus, setAutoStartStatus] = useState<"idle" | "starting" | "done">("idle")
  const [isFinalizing, setIsFinalizing] = useState(false)
  const finalizeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current)
        finalizeTimerRef.current = null
      }
      synthesisAbortRef.current?.abort()
      synthesisAbortRef.current = null
    }
  }, [])

  const handleViewDashboard = useCallback(() => {
    onClose?.()
    router.push("/overview")
  }, [onClose, router])

  const runSynthesis = useCallback(
    async (session: CheckInSession) => {
      const validMessageCount = session.messages.filter((m) => m.content.trim().length > 0).length
      if (validMessageCount < 2) {
        setSynthesis(null)
        setIsSynthesizing(false)
        setSynthesisError(
          "Check-in ended too quickly to synthesize (needs at least 2 transcript messages). Try speaking a little longer next time."
        )
        return
      }

      if (lastSynthesizedSessionIdRef.current === session.id && synthesis && !synthesisError) {
        return
      }

      synthesisAbortRef.current?.abort()
      const controller = new AbortController()
      synthesisAbortRef.current = controller

      setIsSynthesizing(true)
      setSynthesisError(null)

      try {
        const dbEntries = await db.journalEntries.where("checkInSessionId").equals(session.id).toArray()
        const journalEntries = dbEntries.map(toJournalEntry)

        const nextSynthesis = await synthesizeCheckInSession(session, journalEntries, {
          signal: controller.signal,
        })

        lastSynthesizedSessionIdRef.current = session.id
        setSynthesis(nextSynthesis)

        const semantic = nextSynthesis.semanticBiomarkers
        const currentMetrics = session.acousticMetrics
        const refinedMetrics =
          semantic && currentMetrics
            ? (() => {
                const acousticStressScore = currentMetrics.acousticStressScore ?? currentMetrics.stressScore
                const acousticFatigueScore = currentMetrics.acousticFatigueScore ?? currentMetrics.fatigueScore
                const acousticConfidence = currentMetrics.acousticConfidence ?? currentMetrics.confidence

                const blended = blendAcousticAndSemanticBiomarkers({
                  acoustic: {
                    stressScore: acousticStressScore,
                    fatigueScore: acousticFatigueScore,
                    confidence: acousticConfidence,
                  },
                  semantic: {
                    stressScore: semantic.stressScore,
                    fatigueScore: semantic.fatigueScore,
                    confidence: semantic.confidence,
                  },
                })

                return {
                  ...currentMetrics,
                  stressScore: blended.stressScore,
                  fatigueScore: blended.fatigueScore,
                  stressLevel: blended.stressLevel,
                  fatigueLevel: blended.fatigueLevel,
                  confidence: blended.confidence,
                  acousticStressScore,
                  acousticFatigueScore,
                  acousticStressLevel: currentMetrics.acousticStressLevel ?? currentMetrics.stressLevel,
                  acousticFatigueLevel: currentMetrics.acousticFatigueLevel ?? currentMetrics.fatigueLevel,
                  acousticConfidence,
                  semanticStressScore: semantic.stressScore,
                  semanticFatigueScore: semantic.fatigueScore,
                  semanticConfidence: semantic.confidence,
                  semanticSource: "gemini" as const,
                }
              })()
            : null

        if (refinedMetrics) {
          setCompletedSession((current) => (current?.id === session.id ? { ...current, acousticMetrics: refinedMetrics } : current))
          await updateCheckInSession(session.id, { synthesis: nextSynthesis, acousticMetrics: refinedMetrics })
        } else {
          // Persist synthesis to the saved session (dashboard continuity)
          await updateCheckInSession(session.id, { synthesis: nextSynthesis })
        }

        // Persist synthesis suggestions as pending suggestions (upsert by deterministic IDs)
        const createdAt = nextSynthesis.meta.generatedAt
        for (const s of nextSynthesis.suggestions) {
          const suggestion: Suggestion = {
            id: s.id,
            checkInSessionId: session.id,
            linkedInsightIds: s.linkedInsightIds,
            content: s.content,
            rationale: s.rationale,
            duration: s.duration,
            category: s.category,
            status: "pending",
            createdAt,
          }
          await db.suggestions.put(fromSuggestion(suggestion))
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        const message = error instanceof Error ? error.message : "Failed to synthesize check-in"
        setSynthesisError(message)
      } finally {
        setIsSynthesizing(false)
      }
    },
    [synthesis, synthesisError, updateCheckInSession]
  )

  // Avoid "Start click did nothing" in React StrictMode (dev) where the first mount
  // is intentionally torn down: only allow Start once the component is stable.
  const canStart = useStrictModeReady(true)

  // Main check-in hook that manages the Gemini Live connection
  // This hook handles all the complex WebSocket, audio capture, and playback logic
  const [checkIn, controls] = useCheckIn({
    // Called when user ends the session or AI ends naturally
    onSessionEnd: async (session) => {
      try {
        // Only save sessions where the user actually participated.
        // NOTE: Message count alone is not reliable (e.g., transcripts may fail to commit
        // before disconnect/end), so also accept sessions with computed voice metrics.
        // Pattern doc: docs/error-patterns/check-in-results-missing-on-disconnect.md
        const hasUserMessage = session.messages.some((m) => m.role === "user" && m.content.trim().length > 0)
        const hasVoiceMetrics = Boolean(session.acousticMetrics)
        if (!hasUserMessage && !hasVoiceMetrics) {
          logDebug("AIChatContent", "Skipping save - no user participation")
          setCompletedSession(session)
          return
        }
        // Persist the conversation to IndexedDB for history
        await addCheckInSession(session)
        setCompletedSession(session)
        onSessionComplete?.(session)

        // Kick off post-check-in synthesis (non-blocking for UI)
        void runSynthesis(session)
      } catch (error) {
        logError("AIChatContent", "Failed to save check-in session:", error)
      }
    },
    // Called when voice patterns don't match spoken content
    // (e.g., saying "I'm fine" but voice shows stress)
    onMismatch: (result) => {
      logDebug("AIChatContent", "Voice/content mismatch detected:", result)
    },
    // Called on connection or processing errors
    onError: (error) => {
      // Mic permission failures are common user/environment issues; avoid noisy console.error.
      if (error instanceof KanariError && error.code.startsWith("MIC_")) {
        logWarn("AIChatContent", error.message)
        return
      }
      logError("AIChatContent", "Error:", error)
    },
  })

  // Notify parent component when session becomes active/inactive
  // This is used to disable tab switching while a conversation is in progress
  useEffect(() => {
    onSessionChange?.(checkIn.isActive)
  }, [checkIn.isActive, onSessionChange])

  // Handle discard request from parent (drawer)
  // When requestDiscard becomes true, cancel the session and signal back
  useEffect(() => {
    if (requestDiscard) {
      controls.cancelSession()
      synthesisAbortRef.current?.abort()
      synthesisAbortRef.current = null
      onDiscardComplete?.()
    }
  }, [requestDiscard, controls, onDiscardComplete])

  const startOrResume = useCallback(async () => {
    logWarn("AIChatContent", "Start pressed")

    try {
      const hasPreserved = controls.hasPreservedSession()

      if (hasPreserved) {
        // Only resume if local context hasn't changed.
        // If fingerprint can't be computed quickly, fail closed and start fresh.
        const preservedFingerprint = getPreservedFingerprint()

        const currentFingerprint = await Promise.race<string | null>([
          controls.getContextFingerprint().catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ])

        if (preservedFingerprint && currentFingerprint && preservedFingerprint === currentFingerprint) {
          logDebug("AIChatContent", "Resuming preserved session")
          await controls.resumePreservedSession()
          return
        }

        logDebug("AIChatContent", "Preserved session context changed; starting fresh")
        clearPreservedSession()
      }
    } catch (error) {
      logError("AIChatContent", "Failed to resume preserved session:", error)
      clearPreservedSession()
      // Fall through to start fresh.
    }

    await controls.startSession({ userGesture: true })
  }, [controls])

  useLayoutEffect(() => {
    // Auto-start is only safe when this mount was triggered by a real click/tap.
    // (We use it to remove the redundant "Start" click after the user already
    // clicked "New Check-in".)
    // Pattern doc: docs/error-patterns/check-in-autostart-stuck-idle.md
    if (!autoStart) return
    if (autoStartStatus !== "idle") return
    if (!canStart) return
    if (checkIn.state !== "idle") return

    setAutoStartStatus("starting")
    void (async () => {
      try {
        await startOrResume()
      } catch (error) {
        logError("AIChatContent", "Auto-start failed:", error)
      } finally {
        setAutoStartStatus("done")
      }
    })()
  }, [autoStart, autoStartStatus, canStart, checkIn.state, startOrResume])

  const isAutoStarting = autoStart && autoStartStatus === "starting" && checkIn.state === "idle" && canStart

  // Handle closing the chat - preserve session for later resumption
  // User can come back and continue where they left off
  const handleClose = useCallback(() => {
    if (checkIn.isActive) {
      // Preserve the session instead of ending it
      // This keeps the Gemini connection alive and saves state
      controls.preserveSession()
      logDebug("AIChatContent", "Session preserved on close")
    }
    onClose?.()
  }, [checkIn.isActive, controls, onClose])

  // Handle user clicking the "end call" button
  // Behavior depends on whether the user has spoken:
  // - If messages exist: end session gracefully (saves to DB, shows complete screen)
  // - If no messages: show discard dialog (nothing worth saving)
  const handleEndCall = useCallback(async () => {
    if (checkIn.messages.length > 0) {
      // User has spoken - end session gracefully
      // This saves the session and transitions to "complete" state
      if (finalizeTimerRef.current) window.clearTimeout(finalizeTimerRef.current)
      finalizeTimerRef.current = window.setTimeout(() => setIsFinalizing(true), 250)

      try {
        await controls.endSession()
      } finally {
        if (finalizeTimerRef.current) window.clearTimeout(finalizeTimerRef.current)
        finalizeTimerRef.current = null
        setIsFinalizing(false)
      }
    } else {
      // No messages yet - show discard confirmation dialog
      onClose?.()
    }
  }, [checkIn.messages.length, controls, onClose])

  // Determine which UI state to show based on checkIn.state
  // These states come from the useCheckIn hook's state machine
  const showConversation = [
    "ready",           // Connected, waiting for user to speak
    "ai_greeting",     // Connected, waiting for the AI to start
    "listening",       // Actively listening for speech
    "user_speaking",   // User is currently talking
    "processing",      // AI is thinking about response
    "assistant_speaking", // AI is currently speaking
  ].includes(checkIn.state)

  const showInitializing = ["initializing", "connecting"].includes(checkIn.state)
  const canInterruptAssistant = checkIn.state === "assistant_speaking"

  const focusedWidget = focusedWidgetId
    ? (checkIn.widgets.find((w) => w.id === focusedWidgetId) ?? null)
    : null
  const isToolFocused = Boolean(focusedWidget)

  useEffect(() => {
    if (!showConversation) {
      setFocusedWidgetId(null)
    }
  }, [showConversation])

  useEffect(() => {
    if (!focusedWidgetId) return
    const exists = checkIn.widgets.some((w) => w.id === focusedWidgetId)
    if (!exists) {
      setFocusedWidgetId(null)
    }
  }, [checkIn.widgets, focusedWidgetId])

  const statusDotClass = cn(
    "w-3 h-3 rounded-full transition-colors",
    checkIn.state === "user_speaking"
      ? "bg-green-500 ring-2 ring-green-500/25"
      : checkIn.state === "assistant_speaking"
        ? "bg-blue-500 ring-2 ring-blue-500/25"
        : checkIn.state === "ai_greeting"
          ? "bg-blue-500 ring-2 ring-blue-500/20"
          : checkIn.state === "listening"
            ? "bg-accent ring-2 ring-accent/25"
            : showInitializing || isAutoStarting
              ? "bg-accent/70 ring-2 ring-accent/15"
              : "bg-muted"
  )

  const statusText = (() => {
    if (checkIn.state === "idle") {
      return isAutoStarting ? "Starting your check-in..." : "Ready to start"
    }
    if (showInitializing) {
      return checkIn.initPhase ? getInitPhaseLabel(checkIn.initPhase) : "Setting up voice conversation..."
    }
    if (checkIn.state === "user_speaking") return "Listening..."
    if (checkIn.state === "assistant_speaking") return "kanari responding..."
    if (checkIn.state === "ai_greeting") return "kanari starting..."
    if (checkIn.state === "processing") return "Thinking..."
    return "Ready"
  })()

  const hasVoiceBiomarkers = Boolean(checkIn.session?.acousticMetrics)
  const modalityHint = (() => {
    if (checkIn.isMuted) {
      return "Mic is muted. Typing still works, but voice biomarkers will pause until you unmute and speak."
    }
    if (!hasVoiceBiomarkers) {
      return "Tip: speak for about 1-2 seconds to generate voice biomarkers. Typed messages still work for chat."
    }
    return "Typing keeps the chat moving. Speaking gives Kanari richer biomarker context."
  })()

  return (
    <div className="relative flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {checkIn.state === "error" ? (
          <motion.div
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <MicOff className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center max-w-sm">
              <p className="font-medium text-red-500">Connection Error</p>
              <p className="text-sm text-muted-foreground mt-1 break-words">
                {checkIn.error || "Failed to connect. Please try again."}
              </p>
            </div>
            <Button onClick={startOrResume} disabled={!canStart}>
              Try Again
            </Button>
          </motion.div>
        ) : checkIn.state === "complete" ? (
          <motion.div
            className="flex-1 flex flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <SynthesisScreen
              session={completedSession ?? checkIn.session ?? null}
              synthesis={synthesis}
              isLoading={isSynthesizing}
              error={synthesisError}
              onRetry={completedSession ? () => void runSynthesis(completedSession) : undefined}
              onViewDashboard={handleViewDashboard}
              onDone={handleClose}
            />
          </motion.div>
        ) : (
          <>
            {/* Status */}
            <div className={cn("flex-shrink-0 flex justify-center border-b py-3", isGlassChrome && "border-border/40")}>
              <div className="flex items-center gap-2">
                <div className={statusDotClass} />
                <span className="text-sm text-muted-foreground">{statusText}</span>
                {canInterruptAssistant && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      "ml-2 rounded-full border border-red-500/20 bg-red-500/10 text-red-500 shadow-sm",
                      "hover:bg-red-500/15 hover:text-red-500 focus-visible:ring-red-500/30"
                    )}
                    onClick={() => controls.interruptAssistant()}
                    aria-label="Interrupt"
                    title="Interrupt"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </Button>
                )}
              </div>
            </div>

            {/* Biomarkers */}
            <div
              className={cn(
                "px-6 py-3 border-b",
                isGlassChrome
                  ? "border-border/40 bg-transparent"
                  : "border-border/50 bg-background/40"
              )}
            >
              <BiomarkerIndicator
                metrics={checkIn.session?.acousticMetrics}
                className={isGlassChrome ? "border-border/40 bg-transparent" : undefined}
              />
            </div>

            {/* Conversation */}
            {showConversation && focusedWidget ? (
              <div className="flex-1 overflow-hidden p-4">
                {focusedWidget.type === "journal_prompt" ? (
                  <JournalPrompt
                    key={focusedWidget.id}
                    widget={focusedWidget}
                    variant="focus"
                    className="h-full"
                    initialContent={journalDrafts[focusedWidget.id] || ""}
                    onDraftChange={(nextContent) =>
                      setJournalDrafts((prev) => {
                        const trimmed = nextContent.trim()
                        if (!trimmed) {
                          if (!(focusedWidget.id in prev)) return prev
                          const { [focusedWidget.id]: _, ...rest } = prev
                          return rest
                        }
                        return { ...prev, [focusedWidget.id]: nextContent }
                      })
                    }
                    onBack={() => setFocusedWidgetId(null)}
                    onDismiss={() => {
                      controls.dismissWidget(focusedWidget.id)
                      setFocusedWidgetId(null)
                    }}
                    onSave={(content) => controls.saveJournalEntry(focusedWidget.id, content)}
                  />
                ) : focusedWidget.type === "breathing_exercise" ? (
                  <BreathingExercise
                    key={focusedWidget.id}
                    widget={focusedWidget}
                    variant="focus"
                    className="h-full"
                    initialDurationSeconds={breathingDrafts[focusedWidget.id]}
                    autoStart
                    onBack={() => setFocusedWidgetId(null)}
                    onDismiss={() => {
                      controls.dismissWidget(focusedWidget.id)
                      setFocusedWidgetId(null)
                    }}
                  />
                ) : null}
              </div>
            ) : checkIn.state === "idle" ? (
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <p className="text-sm">{isAutoStarting ? "Starting your check-in..." : "Tap Start when you're ready"}</p>
                  <p className="text-xs mt-1 opacity-70">kanari will greet you first</p>
                </div>
              </div>
            ) : showInitializing ? (
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <p className="text-sm">
                    {checkIn.initPhase ? getInitPhaseLabel(checkIn.initPhase) : "Setting up voice conversation..."}
                  </p>
                  <p className="text-xs mt-1 opacity-70">This usually takes a few seconds.</p>
                </div>
              </div>
            ) : (
              <ConversationView
                state={checkIn.state}
                messages={checkIn.messages}
                currentUserTranscript={checkIn.currentUserTranscript}
              />
            )}

            {/* Widgets */}
            {!isToolFocused && checkIn.widgets.length > 0 && (
              <div
                className={cn(
                  "flex-shrink-0 border-t p-4 space-y-3 overflow-y-auto max-h-[260px]",
                  isGlassChrome ? "border-border/40 bg-transparent" : "bg-background/60"
                )}
              >
                {checkIn.widgets.map((widget) => {
                  switch (widget.type) {
                    case "schedule_activity":
                      return (
                        <ScheduleConfirmation
                          key={widget.id}
                          widget={widget}
                          onDismiss={() => controls.dismissWidget(widget.id)}
                          onUndo={(suggestionId) =>
                            controls.undoScheduledActivity(widget.id, suggestionId)
                          }
                        />
                      )
                    case "breathing_exercise":
                      return (
                        <BreathingExercise
                          key={widget.id}
                          widget={widget}
                          initialDurationSeconds={breathingDrafts[widget.id]}
                          onOpenFocus={(durationSeconds) => {
                            setBreathingDrafts((prev) => ({ ...prev, [widget.id]: durationSeconds }))
                            setFocusedWidgetId(widget.id)
                          }}
                          onDismiss={() => controls.dismissWidget(widget.id)}
                        />
                      )
                    case "stress_gauge":
                      return (
                        <StressGauge
                          key={widget.id}
                          widget={widget}
                          onDismiss={() => controls.dismissWidget(widget.id)}
                        />
                      )
                    case "quick_actions":
                      return (
                        <QuickActions
                          key={widget.id}
                          widget={widget}
                          onDismiss={() => controls.dismissWidget(widget.id)}
                          onSelect={(action, label) =>
                            controls.runQuickAction(widget.id, action, label)
                          }
                        />
                      )
                    case "journal_prompt":
                      return (
                        <JournalPrompt
                          key={widget.id}
                          widget={widget}
                          initialContent={journalDrafts[widget.id] || ""}
                          onOpenFocus={() => setFocusedWidgetId(widget.id)}
                          onDismiss={() => controls.dismissWidget(widget.id)}
                          onSave={(content) => controls.saveJournalEntry(widget.id, content)}
                        />
                      )
                    default:
                      return null
                  }
                })}
              </div>
            )}

            {/* Footer */}
            <div className={cn("flex-shrink-0 border-t", isGlassChrome && "border-border/40")}>
              <div className="px-4 py-3">
                <div className="relative mx-auto w-full max-w-2xl">
                  {showConversation ? (
                    <>
                      <div className="pr-20">
                        {isToolFocused ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-14"
                            onClick={() => setFocusedWidgetId(null)}
                          >
                            Back to chat
                          </Button>
                        ) : (
                          <ChatInput
                            onSendText={(text) => {
                              if (checkIn.state === "assistant_speaking") {
                                controls.interruptAssistant()
                              }
                              controls.sendTextMessage(text)
                            }}
                            onTriggerTool={(toolName, args) => controls.triggerManualTool(toolName, args)}
                            disabled={!checkIn.isActive || checkIn.state === "ai_greeting" || checkIn.state === "ready"}
                            isMuted={checkIn.isMuted}
                            onToggleMute={() => controls.toggleMute()}
                            modalityHint={modalityHint}
                          />
                        )}
                      </div>

                      <Button
                        variant="destructive"
                        size="icon"
                        className={[
                          "absolute right-0 top-1/2 h-14 w-14 rounded-full shadow-lg",
                          "-translate-y-1/2",
                          // Override shared Button animations (translate/scale/brightness) and use our own hover animation instead.
                          "transition-transform duration-200 ease-out",
                          "hover:-translate-y-1/2 active:-translate-y-1/2",
                          "hover:scale-100 active:scale-100",
                          "hover:brightness-100 active:brightness-100",
                          "hover:bg-destructive active:bg-destructive",
                          "hover:shadow-lg active:shadow-lg",
                          "hover:rotate-6",
                        ].join(" ")}
                        onClick={handleEndCall}
                        aria-label="End check-in"
                      >
                        <PhoneOff className="h-6 w-6" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={startOrResume}
                      disabled={!canStart || isAutoStarting || showInitializing}
                    >
                      {showInitializing || isAutoStarting
                        ? "Starting..."
                        : canStart
                          ? "Start check-in"
                          : "Preparing..."}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {isFinalizing && checkIn.state !== "complete" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <Deck className="w-full max-w-sm p-4" role="status" aria-live="polite">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-muted/40 p-2">
                <Spinner className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Finalizing your check-in...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Saving your session and preparing the synthesis.
                </p>
              </div>
            </div>
          </Deck>
        </div>
      )}
    </div>
  )
}
