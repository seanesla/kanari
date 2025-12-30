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
 * - Auto-starts session when component mounts
 *
 * Technical notes:
 * - Uses Server-Sent Events (SSE) to receive Gemini audio at 24kHz
 * - Sends user audio at 16kHz PCM via POST requests
 * - Supports barge-in (interrupt AI while it's speaking)
 * - Has mute functionality to pause microphone input
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCheckIn, type StartSessionOptions } from "@/hooks/use-check-in"
import { useCheckInSessionActions } from "@/hooks/use-storage"
import { VoiceIndicatorLarge } from "@/components/check-in/voice-indicator"
import { ConversationView } from "@/components/check-in/conversation-view"
import type { CheckInSession, VoicePatterns } from "@/lib/types"

interface AIChatContentProps {
  /** Called when session ends - parent should close the drawer */
  onClose?: () => void
  /** Called when chat state changes - parent uses this to disable tab switching */
  onSessionChange?: (isActive: boolean) => void
  /** Optional context from a prior voice recording to personalize the conversation */
  recordingContext?: {
    recordingId: string
    stressScore: number
    fatigueScore: number
    patterns: VoicePatterns
  }
  /** Called when the conversation session is saved to IndexedDB */
  onSessionComplete?: (session: CheckInSession) => void
  /** When true, parent is requesting to discard the session */
  requestDiscard?: boolean
  /** Called after session has been cancelled due to discard request */
  onDiscardComplete?: () => void
}

export function AIChatContent({
  onClose,
  onSessionChange,
  recordingContext,
  onSessionComplete,
  requestDiscard,
  onDiscardComplete,
}: AIChatContentProps) {
  // Hook to save completed sessions to IndexedDB
  const { addCheckInSession } = useCheckInSessionActions()

  // Prevent duplicate session starts from React StrictMode double-mounting
  // or rapid tab switching
  const sessionStartedRef = useRef(false)

  // Main check-in hook that manages the Gemini Live connection
  // This hook handles all the complex WebSocket, audio capture, and playback logic
  const [checkIn, controls] = useCheckIn({
    // Called when user ends the session or AI ends naturally
    onSessionEnd: async (session) => {
      try {
        // Only save sessions that have at least one message
        // Empty sessions (0 messages) are not meaningful and should not be stored
        if (session.messages.length === 0) {
          console.log("[AIChatContent] Skipping save - session has no messages")
          return
        }
        // Persist the conversation to IndexedDB for history
        await addCheckInSession(session)
        onSessionComplete?.(session)
      } catch (error) {
        console.error("[AIChatContent] Failed to save check-in session:", error)
      }
    },
    // Called when voice patterns don't match spoken content
    // (e.g., saying "I'm fine" but voice shows stress)
    onMismatch: (result) => {
      console.log("[AIChatContent] Voice/content mismatch detected:", result)
    },
    // Called on connection or processing errors
    onError: (error) => {
      console.error("[AIChatContent] Error:", error)
    },
  })

  // Notify parent component when session becomes active/inactive
  // This is used to disable tab switching while a conversation is in progress
  useEffect(() => {
    onSessionChange?.(checkIn.isActive)
  }, [checkIn.isActive, onSessionChange])

  // Handle discard request from parent (drawer)
  // When requestDiscard becomes true, cancel the session and signal back
  // IMPORTANT: Set sessionStartedRef.current = true BEFORE cancelSession()
  // to prevent the auto-start effect from starting a new session when
  // cancelSession() resets state to "idle"
  useEffect(() => {
    if (requestDiscard) {
      sessionStartedRef.current = true  // Prevent auto-start
      controls.cancelSession()
      onDiscardComplete?.()
    }
  }, [requestDiscard, controls, onDiscardComplete])

  // Reset the started flag when session completes, errors, or resets to idle
  // This allows retry after errors and fresh start after completion
  // Also reset on "idle" to handle StrictMode's double-mount - when first mount
  // aborts with INITIALIZATION_ABORTED and dispatches RESET, the second mount
  // needs sessionStartedRef to be false so auto-start can fire again
  useEffect(() => {
    if (checkIn.state === "idle" || checkIn.state === "complete" || checkIn.state === "error") {
      sessionStartedRef.current = false
    }
  }, [checkIn.state])

  // Auto-start the session when component mounts (tab is selected)
  // Only start once per idle→active cycle
  useEffect(() => {
    if (checkIn.state === "idle" && !sessionStartedRef.current) {
      // Mark as started immediately to prevent duplicate calls
      sessionStartedRef.current = true

      // Build session options with optional recording context
      // If user just made a voice recording, this context helps AI understand
      // their current stress/fatigue levels
      const options: StartSessionOptions | undefined = recordingContext
        ? { recordingContext }
        : undefined

      controls.startSession(options)
    }
  }, [checkIn.state, recordingContext, controls])

  // Handle closing the chat - end session gracefully first
  const handleClose = useCallback(async () => {
    if (checkIn.isActive) {
      // End the session, which triggers onSessionEnd callback
      await controls.endSession()
    }
    // Don't call cancelSession() - component unmounts on drawer close
    // and calling it would set state to "idle" which triggers auto-start
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
    "listening",       // Actively listening for speech
    "user_speaking",   // User is currently talking
    "processing",      // AI is thinking about response
    "assistant_speaking", // AI is currently speaking
  ].includes(checkIn.state)

  const showInitializing = ["initializing", "connecting"].includes(checkIn.state)

  // Calculate which audio level to show in the visualizer
  // Shows input level when user is speaking, output level when AI is speaking
  const activeAudioLevel =
    checkIn.state === "user_speaking"
      ? checkIn.audioLevels.input
      : checkIn.state === "assistant_speaking"
        ? checkIn.audioLevels.output
        : 0

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
            <VoiceIndicatorLarge state="idle" audioLevel={0} />
            <p className="text-sm text-muted-foreground text-center">
              Starting AI check-in...
            </p>
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
            {/* Large pulsing voice indicator shows we're setting up */}
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
            {/*
              Voice indicator section
              - Shows large indicator when no messages yet (first time)
              - Switches to compact indicator once conversation starts
            */}
            <motion.div
              className={cn(
                "flex-shrink-0 flex justify-center border-b transition-all",
                checkIn.messages.length > 0 ? "py-3" : "py-8"
              )}
              layout
            >
              {checkIn.messages.length > 0 ? (
                /* Compact status indicator with colored dot */
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full transition-colors",
                        checkIn.state === "user_speaking"
                          ? "bg-green-500"           // Green = user talking
                          : checkIn.state === "assistant_speaking"
                            ? "bg-blue-500"          // Blue = AI talking
                            : checkIn.state === "listening"
                              ? "bg-accent animate-pulse"  // Pulsing = listening
                              : "bg-muted"           // Gray = idle
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
                /* Large animated indicator for first-time/empty state */
                <VoiceIndicatorLarge
                  state={checkIn.state}
                  audioLevel={activeAudioLevel}
                />
              )}
            </motion.div>

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
            <Button onClick={() => {
              sessionStartedRef.current = false
              controls.startSession()
            }}>
              Try Again
            </Button>
          </motion.div>
        )}

        {/* ===== COMPLETE STATE ===== */}
        {/* Shown after conversation ends successfully */}
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
                {/* Show mismatch count if voice/content mismatches were detected */}
                {checkIn.mismatchCount > 0 &&
                  ` • ${checkIn.mismatchCount} voice patterns noted`}
              </p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </motion.div>
        )}
        </AnimatePresence>

        {/* ===== FOOTER CONTROLS ===== */}
        {/* Only shown during active conversation (not during init/complete/error) */}
        {showConversation && (
          <div className="flex-shrink-0 px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center justify-center gap-4">
              {/*
                Mute button - toggles microphone on/off
                Red background when muted to clearly indicate state
              */}
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

              {/*
                End call button - large red button to end the conversation
                Triggers graceful session end and saves to database
              */}
              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={handleEndCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
