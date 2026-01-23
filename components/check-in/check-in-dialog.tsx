"use client"

/**
 * Check-In Dialog Component
 *
 * Main modal for conversational check-in feature.
 * Coordinates the full voice conversation experience.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { logDebug, logError } from "@/lib/logger"
import { db, fromSuggestion, toJournalEntry } from "@/lib/storage/db"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, PhoneOff, MicOff, Square } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useCheckIn } from "@/hooks/use-check-in"
import { useStrictModeReady } from "@/hooks/use-strict-mode-ready"
import { useCheckInSessionActions } from "@/hooks/use-storage"
import { useCoachAvatar } from "@/hooks/use-coach-avatar"
import { synthesizeCheckInSession } from "@/lib/gemini/synthesis-client"
import { blendAcousticAndSemanticBiomarkers } from "@/lib/ml/biomarker-fusion"
import { createDefaultSettingsRecord } from "@/lib/settings/default-settings"
import { SynthesisScreen } from "@/components/check-in/synthesis-screen"
import { BiomarkerIndicator } from "./biomarker-indicator"
import { ConversationView } from "./conversation-view"
import {
  BreathingExercise,
  JournalPrompt,
  QuickActions,
  ScheduleConfirmation,
  StressGauge,
} from "./widgets"
import { ChatInput } from "./chat-input"
import { VoicePicker } from "./voice-picker"
import type { CheckInSession, CheckInSynthesis, GeminiVoice, Suggestion } from "@/lib/types"
import type { InitPhase } from "@/hooks/check-in/state"

/**
 * Get user-friendly label for initialization phase
 */
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
      return "Setting up..."
  }
}

interface CheckInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when session completes */
  onSessionComplete?: (session: CheckInSession) => void
}

export function CheckInDialog({
  open,
  onOpenChange,
  onSessionComplete,
}: CheckInDialogProps) {
  const router = useRouter()
  const { addCheckInSession, updateCheckInSession } = useCheckInSessionActions()
  const { avatarBase64: coachAvatar } = useCoachAvatar()

  const canStart = useStrictModeReady(open)

  // Voice selection state - null = loading, undefined = no voice, string = has voice
  const [hasVoice, setHasVoice] = useState<boolean | null>(null)
  const [isSavingVoice, setIsSavingVoice] = useState(false)

  // Post-check-in synthesis state
  const [completedSession, setCompletedSession] = useState<CheckInSession | null>(null)
  const [synthesis, setSynthesis] = useState<CheckInSynthesis | null>(null)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [synthesisError, setSynthesisError] = useState<string | null>(null)
  const synthesisAbortRef = useRef<AbortController | null>(null)
  const lastSynthesizedSessionIdRef = useRef<string | null>(null)

  // Tool focus mode
  const [focusedWidgetId, setFocusedWidgetId] = useState<string | null>(null)
  const [journalDrafts, setJournalDrafts] = useState<Record<string, string>>({})
  const [breathingDrafts, setBreathingDrafts] = useState<Record<string, number>>({})

  // Check if user has selected a voice when dialog opens
  useEffect(() => {
    if (!open) {
      // Reset on close so we re-check next time
      setHasVoice(null)
      setCompletedSession(null)
      setSynthesis(null)
      setIsSynthesizing(false)
      setSynthesisError(null)
      setFocusedWidgetId(null)
      setJournalDrafts({})
      setBreathingDrafts({})
      synthesisAbortRef.current?.abort()
      synthesisAbortRef.current = null
      lastSynthesizedSessionIdRef.current = null
      return
    }

    async function checkVoice() {
      try {
        const settings = await db.settings.get("default")
        setHasVoice(!!settings?.selectedGeminiVoice)
      } catch {
        // If settings read fails, assume no voice (will prompt user)
        setHasVoice(false)
      }
    }
    checkVoice()
  }, [open])

  // Handle voice selection from picker
  const handleVoiceSelected = useCallback(async (voice: GeminiVoice) => {
    setIsSavingVoice(true)
    try {
      const updated = await db.settings.update("default", { selectedGeminiVoice: voice })
      if (updated === 0) {
        await db.settings.put(createDefaultSettingsRecord({ selectedGeminiVoice: voice }))
      }
      setHasVoice(true)
    } catch (error) {
      logError("CheckInDialog", "Failed to save voice selection:", error)
    } finally {
      setIsSavingVoice(false)
    }
  }, [])

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

  const [checkIn, controls] = useCheckIn({
    onSessionEnd: async (session) => {
      try {
        // Only save sessions where the user actually participated.
        // NOTE: Message count alone is not reliable (e.g., transcripts may fail to commit
        // before disconnect/end), so also accept sessions with computed voice metrics.
        // Pattern doc: docs/error-patterns/check-in-results-missing-on-disconnect.md
        const hasUserMessage = session.messages.some((m) => m.role === "user" && m.content.trim().length > 0)
        const hasVoiceMetrics = Boolean(session.acousticMetrics)
        if (!hasUserMessage && !hasVoiceMetrics) {
          logDebug("CheckInDialog", "Skipping save - no user participation")
          setCompletedSession(session)
          return
        }
        await addCheckInSession(session)
        setCompletedSession(session)
        onSessionComplete?.(session)

        // Kick off post-check-in synthesis (non-blocking for UI)
        void runSynthesis(session)
      } catch (error) {
        logError("CheckInDialog", "Failed to save check-in session:", error)
      }
    },
    onMismatch: (result) => {
      logDebug("CheckInDialog", "Mismatch detected:", result)
    },
    onError: (error) => {
      logError("CheckInDialog", "Error:", error)
    },
  })

  // Handle close - always reset state to idle so reopening starts fresh
  const handleClose = useCallback(async () => {
    if (checkIn.isActive) {
      await controls.endSession()
    }
    // Always reset to idle when closing (safe to call even after endSession)
    controls.cancelSession()
    onOpenChange(false)
  }, [checkIn.isActive, controls, onOpenChange])

  // Handle end call
  const handleEndCall = useCallback(async () => {
    await controls.endSession()
  }, [controls])

  const handleViewDashboard = useCallback(() => {
    controls.cancelSession()
    onOpenChange(false)
    router.push("/dashboard")
  }, [controls, onOpenChange, router])

  // Determine if we should show the conversation or initialization
  const showConversation = [
    "ready",
    "ai_greeting",
    "listening",
    "user_speaking",
    "processing",
    "assistant_speaking",
  ].includes(checkIn.state)

  const showInitializing = ["initializing", "connecting"].includes(checkIn.state)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl h-[80vh] max-h-[700px] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Check-in with kanari
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Idle state */}
            {checkIn.state === "idle" && (
              <motion.div
                key="idle"
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Loading voice check */}
                {hasVoice === null && (
                  <p className="text-sm text-muted-foreground">Preparing...</p>
                )}

                {/* No voice selected - show picker */}
                {hasVoice === false && (
                  <VoicePicker
                    onVoiceSelected={handleVoiceSelected}
                    isLoading={isSavingVoice}
                  />
                )}

                {/* Has voice - show normal start UI */}
                {hasVoice === true && (
                  <>
                    <p className="text-sm text-muted-foreground text-center">
                      Tap start to begin your voice check-in.
                    </p>
                    <Button
                      onClick={async () => {
                        await controls.startSession({ userGesture: true })
                      }}
                      disabled={!canStart}
                    >
                      {canStart ? "Start" : "Preparing..."}
                    </Button>
                  </>
                )}
              </motion.div>
            )}

            {/* Initializing state */}
            {showInitializing && (
              <motion.div
                key="initializing"
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.p
                  key={checkIn.initPhase || "default"}
                  className="text-sm text-muted-foreground text-center"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  {getInitPhaseLabel(checkIn.initPhase)}
                </motion.p>
              </motion.div>
            )}

            {/* Conversation view */}
            {showConversation && (
              <motion.div
                key="conversation"
                className="flex-1 flex flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Compact status indicator with colored dot */}
                <div className="flex-shrink-0 flex justify-center border-b py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full transition-colors",
                        checkIn.state === "user_speaking"
                          ? "bg-green-500"
                          : checkIn.state === "assistant_speaking"
                            ? "bg-blue-500"
                            : checkIn.state === "ai_greeting"
                              ? "bg-blue-500 animate-pulse"
                            : checkIn.state === "listening"
                              ? "bg-accent animate-pulse"
                              : "bg-muted"
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

                    {checkIn.state === "assistant_speaking" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => controls.interruptAssistant()}
                        className={cn(
                          "ml-2 rounded-full border border-red-500/20 bg-red-500/10 text-red-500 shadow-sm",
                          "hover:bg-red-500/15 hover:text-red-500 focus-visible:ring-red-500/30"
                        )}
                        aria-label="Interrupt"
                        title="Interrupt"
                      >
                        <Square className="h-4 w-4 fill-current" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="px-6 py-3 border-b border-border/50 bg-background/40">
                  <BiomarkerIndicator metrics={checkIn.session?.acousticMetrics} />
                </div>

                {focusedWidget ? (
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
                        onSave={(content) =>
                          controls.saveJournalEntry(focusedWidget.id, content)
                        }
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
                ) : (
                  <>
                    {/* Messages */}
                    <ConversationView
                      state={checkIn.state}
                      messages={checkIn.messages}
                      currentUserTranscript={checkIn.currentUserTranscript}
                      currentAssistantThinking={checkIn.currentAssistantThinking}
                      coachAvatar={coachAvatar}
                    />

                    {/* Gemini-triggered widgets */}
                    {checkIn.widgets.length > 0 && (
                      <div className="flex-shrink-0 border-t bg-background/60 p-4 space-y-3 overflow-y-auto max-h-[260px]">
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
                  </>
                )}
              </motion.div>
            )}

            {/* Error state */}
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
                <Button onClick={() => controls.startSession({ userGesture: true })}>
                  Try Again
                </Button>
              </motion.div>
            )}

            {/* Complete state */}
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
        </div>

        {/* Footer with chat input and hang up button */}
        {showConversation && (
          <div className="flex-shrink-0 border-t">
            <div className="px-4 py-3">
              <div className="relative mx-auto w-full max-w-2xl">
                {/* Reserve space on the right so the floating hang up button doesn't overlap the bar */}
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
                      onSendText={(text) => controls.sendTextMessage(text)}
                      onTriggerTool={(toolName, args) => controls.triggerManualTool(toolName, args)}
                      disabled={!checkIn.isActive || checkIn.state === "ai_greeting" || checkIn.state === "ready"}
                      isMuted={checkIn.isMuted}
                      onToggleMute={() => controls.toggleMute()}
                    />
                  )}
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
      </DialogContent>
    </Dialog>
  )
}
