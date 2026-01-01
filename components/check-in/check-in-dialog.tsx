"use client"

/**
 * Check-In Dialog Component
 *
 * Main modal for conversational check-in feature.
 * Coordinates the full voice conversation experience.
 */

import { useCallback, useEffect, useRef } from "react"
import { logDebug, logError } from "@/lib/logger"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Phone, PhoneOff, Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCheckIn } from "@/hooks/use-check-in"
import { useCheckInSessionActions } from "@/hooks/use-storage"
import { VoiceIndicatorLarge } from "./voice-indicator"
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
import type { CheckInSession } from "@/lib/types"

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
  const { addCheckInSession } = useCheckInSessionActions()

  // Prevent duplicate session starts from rapid React renders (StrictMode, fast open/close)
  const sessionStartedRef = useRef(false)

  const [checkIn, controls] = useCheckIn({
    onSessionEnd: async (session) => {
      try {
        // Only save sessions where user actually participated (at least 2 messages)
        // With AI-speaks-first, 1 message = just the AI greeting, no user response
        if (session.messages.length <= 1) {
          logDebug("CheckInDialog", "Skipping save - no user participation")
          return
        }
        await addCheckInSession(session)
        onSessionComplete?.(session)
      } catch (error) {
        logError("CheckInDialog", "Failed to save check-in session:", error)
      }
    },
    onMismatch: (result) => {
      console.log("[CheckInDialog] Mismatch detected:", result)
    },
    onError: (error) => {
      console.error("[CheckInDialog] Error:", error)
    },
  })

  // Reset session started flag when dialog closes
  useEffect(() => {
    if (!open) {
      sessionStartedRef.current = false
    }
  }, [open])

  // Start session when dialog opens
  useEffect(() => {
    if (open && checkIn.state === "idle" && !sessionStartedRef.current) {
      // Mark as started immediately to prevent duplicate calls
      sessionStartedRef.current = true
      controls.startSession()
    }
  }, [open, checkIn.state, controls])

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
    onOpenChange(false)
  }, [controls, onOpenChange])

  // Determine if we should show the conversation or initialization
  const showConversation = [
    "ready",
    "listening",
    "user_speaking",
    "processing",
    "assistant_speaking",
  ].includes(checkIn.state)

  const showInitializing = ["initializing", "connecting"].includes(checkIn.state)

  // Calculate active audio level
  const activeAudioLevel =
    checkIn.state === "user_speaking"
      ? checkIn.audioLevels.input
      : checkIn.state === "assistant_speaking"
        ? checkIn.audioLevels.output
        : 0

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
            {/* Initializing state */}
            {showInitializing && (
              <motion.div
                key="initializing"
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <VoiceIndicatorLarge
                  state={checkIn.state}
                  audioLevel={0}
                />
                <p className="text-sm text-muted-foreground text-center">
                  {checkIn.state === "connecting"
                    ? "Connecting to kanari..."
                    : "Setting up voice conversation..."}
                </p>
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
                {/* Voice indicator - compact when messages exist */}
                <motion.div
                  className={cn(
                    "flex-shrink-0 flex justify-center border-b transition-all",
                    checkIn.messages.length > 0 ? "py-3" : "py-8"
                  )}
                  layout
                >
                  {checkIn.messages.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full transition-colors",
                            checkIn.state === "user_speaking"
                              ? "bg-green-500"
                              : checkIn.state === "assistant_speaking"
                                ? "bg-blue-500"
                                : checkIn.state === "listening"
                                  ? "bg-accent animate-pulse"
                                  : "bg-muted"
                          )}
                        />
                        <span className="text-sm text-muted-foreground">
                          {checkIn.state === "user_speaking"
                            ? "Listening..."
                            : checkIn.state === "assistant_speaking"
                              ? "kanari speaking..."
                              : checkIn.state === "processing"
                                ? "Thinking..."
                                : "Ready"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <VoiceIndicatorLarge
                      state={checkIn.state}
                      audioLevel={activeAudioLevel}
                    />
                  )}
                </motion.div>

                <div className="px-6 py-3 border-b border-border/50 bg-background/40">
                  <BiomarkerIndicator metrics={checkIn.session?.acousticMetrics} />
                </div>

                {/* Messages */}
                <ConversationView
                  state={checkIn.state}
                  messages={checkIn.messages}
                  currentUserTranscript={checkIn.currentUserTranscript}
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
                <Button onClick={() => controls.startSession()}>
                  Try Again
                </Button>
              </motion.div>
            )}

            {/* Complete state */}
            {checkIn.state === "complete" && (
              <motion.div
                key="complete"
                className="flex-1 flex flex-col items-center justify-center gap-4 p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Phone className="w-8 h-8 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Check-in complete</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {checkIn.messages.length} messages
                    {checkIn.mismatchCount > 0 &&
                      ` • ${checkIn.mismatchCount} voice patterns noted`}
                  </p>
                </div>
                {checkIn.session?.acousticMetrics && (
                  <div className="w-full max-w-sm">
                    <BiomarkerIndicator metrics={checkIn.session.acousticMetrics} compact />
                  </div>
                )}
                <Button onClick={handleClose}>Done</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with chat input and controls */}
        {showConversation && (
          <div className="flex-shrink-0 border-t bg-muted/30">
            {/* Chat input for text messages and tool triggers */}
            <ChatInput
              onSendText={(text) => controls.sendTextMessage(text)}
              onTriggerTool={(toolName, args) => controls.triggerManualTool(toolName, args)}
              disabled={!checkIn.isActive}
            />

            {/* Voice controls */}
            <div className="px-6 py-3 flex items-center justify-center gap-4">
              {/* Mute button */}
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-full",
                  checkIn.isMuted && "bg-red-500 hover:bg-red-600 text-white"
                )}
                onClick={() => controls.toggleMute()}
              >
                {checkIn.isMuted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>

              {/* End call button */}
              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={handleEndCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>

              {/* Placeholder for symmetry */}
              <div className="h-12 w-12" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
