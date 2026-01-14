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

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { logDebug, logError, logWarn } from "@/lib/logger"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { PhoneOff, MicOff, Square } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useCheckIn } from "@/hooks/use-check-in"
import { useStrictModeReady } from "@/hooks/use-strict-mode-ready"
import { useCheckInSessionActions } from "@/hooks/use-storage"
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
import { SynthesisScreen } from "@/components/check-in/synthesis-screen"
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
}

export function AIChatContent({
  onClose,
  onSessionChange,
  onSessionComplete,
  chrome = "default",
  requestDiscard,
  onDiscardComplete,
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

  useEffect(() => {
    return () => {
      synthesisAbortRef.current?.abort()
      synthesisAbortRef.current = null
    }
  }, [])

  const handleViewDashboard = useCallback(() => {
    onClose?.()
    router.push("/dashboard")
  }, [onClose, router])

  const runSynthesis = useCallback(
    async (session: CheckInSession) => {
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

        // Persist synthesis to the saved session (dashboard continuity)
        await updateCheckInSession(session.id, { synthesis: nextSynthesis })

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
      await controls.endSession()
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main chat content area (full width - no sidebar) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main content area with animated state transitions */}
        <AnimatePresence mode="wait">

        {/* ===== IDLE STATE ===== */}
        {/* Brief loading state while auto-start effect kicks in */}
        {checkIn.state === "idle" && (
          <motion.div
            key="idle"
            className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-sm text-muted-foreground text-center">
              Start a voice check-in when you're ready.
            </p>
            <Button onClick={startOrResume} disabled={!canStart}>
              {canStart ? "Start" : "Preparing..."}
            </Button>
          </motion.div>
        )}

        {/* ===== INITIALIZING STATE ===== */}
        {/* Shown while connecting to Gemini Live API */}
        {showInitializing && (
          <motion.div
            key="initializing"
            className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-sm text-muted-foreground text-center">
              {checkIn.initPhase ? getInitPhaseLabel(checkIn.initPhase) : "Setting up voice conversation..."}
            </p>
          </motion.div>
        )}

        {/* ===== CONVERSATION STATE ===== */}
        {/* Main conversation UI with messages and voice indicator */}
        {showConversation && (
          <motion.div
            key="conversation"
            className="flex-1 flex flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Compact status indicator with colored dot */}
            <div
              className={cn(
                "flex-shrink-0 flex justify-center border-b py-3",
                isGlassChrome && "border-white/10"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full transition-colors",
                    checkIn.state === "user_speaking"
                      ? "bg-green-500"           // Green = user talking
                      : checkIn.state === "assistant_speaking"
                        ? "bg-blue-500"          // Blue = AI talking
                        : checkIn.state === "ai_greeting"
                          ? "bg-blue-500 animate-pulse" // Pulsing blue = AI starting
                        : checkIn.state === "listening"
                          ? "bg-accent animate-pulse"  // Pulsing = listening
                          : "bg-muted"           // Gray = idle
                  )}
                />
                <span className="text-sm text-muted-foreground">
                  {checkIn.state === "user_speaking"
                    ? "Listening..."
                    : checkIn.state === "assistant_speaking"
                      ? "kanari responding..."
                      : checkIn.state === "ai_greeting"
                        ? "kanari starting..."
                      : checkIn.state === "processing"
                        ? "Thinking..."
                        : "Ready"}
                </span>
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

            {/* Real-time biomarker panel */}
            <div
              className={cn(
                "px-6 py-3 border-b",
                isGlassChrome
                  ? "border-white/10 bg-transparent"
                  : "border-border/50 bg-background/40"
              )}
            >
              <BiomarkerIndicator
                metrics={checkIn.session?.acousticMetrics}
                className={isGlassChrome ? "border-white/10 bg-transparent" : undefined}
              />
            </div>

            {/*
              Message history view
              Shows all exchanged messages with:
              - User messages on the right (accent color)
              - AI messages on the left (muted color)
              - Live transcription of current speech
            */}
            <ConversationView
              state={checkIn.state}
              messages={checkIn.messages}
              currentUserTranscript={checkIn.currentUserTranscript}
            />

            {/* Gemini-triggered widgets */}
            {checkIn.widgets.length > 0 && (
              <div
                className={cn(
                  "flex-shrink-0 border-t p-4 space-y-3 overflow-y-auto max-h-[260px]",
                  isGlassChrome ? "border-white/10 bg-transparent" : "bg-background/60"
                )}
              >
                <AnimatePresence initial={false}>
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
                            onDismiss={() => controls.dismissWidget(widget.id)}
                            onSave={(content) =>
                              controls.saveJournalEntry(widget.id, content)
                            }
                          />
                        )
                      default:
                        return null
                    }
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {/* ===== ERROR STATE ===== */}
        {/* Shown when connection fails or other errors occur */}
        {checkIn.state === "error" && (
          <motion.div
            key="error"
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
            {/* Retry button resets and restarts the session */}
            <Button onClick={startOrResume} disabled={!canStart}>
              Try Again
            </Button>
          </motion.div>
        )}

        {/* ===== COMPLETE STATE ===== */}
        {/* Shown after conversation ends successfully */}
        {checkIn.state === "complete" && (
          <motion.div
            key="complete"
            className="flex-1 flex flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
        )}
        </AnimatePresence>

        {/* ===== FOOTER CONTROLS ===== */}
        {/* Only shown during active conversation (not during init/complete/error) */}
        {showConversation && (
          <div className={cn("flex-shrink-0 border-t", isGlassChrome && "border-white/10")}>
            <div className="px-4 py-3">
              <div className="relative mx-auto w-full max-w-2xl">
                {/* Reserve space on the right so the floating hang up button doesn't overlap the bar */}
                <div className="pr-20">
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
                  />
                </div>

                {/* Floating hang up button (outside the input bar) */}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full shadow-lg"
                  onClick={handleEndCall}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
