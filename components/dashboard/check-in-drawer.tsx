"use client"

/**
 * Unified Check-in Drawer Component
 *
 * This is the main container that combines the Voice Note and AI Chat features
 * into a single tabbed interface. It replaces the separate recording drawer
 * and check-in dialog with one unified experience.
 *
 * Features:
 * 1. Tab-based mode selection (Voice note / AI chat) using Shadcn Tabs
 * 2. Microphone permission checking with clear error state
 * 3. Session-aware tab locking (can't switch tabs while recording/chatting)
 * 4. Discard confirmation when closing during active session
 * 5. Browser navigation guard to prevent accidental data loss
 *
 * Component hierarchy:
 * CheckInButton → CheckInDrawer → VoiceNoteContent or AIChatContent
 *
 * State flow:
 * - mode: "voice-note" | "ai-chat" - which tab is active
 * - isSessionActive: boolean - whether a recording or chat is in progress
 * - micPermission: "granted" | "denied" | "prompt" - browser mic permission state
 */

import { useCallback, useEffect, useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { MicOff, AlertCircle, X } from "lucide-react"
import { VoiceNoteContent } from "./check-in-voice-note"
import { AIChatContent } from "./check-in-ai-chat"
import type { Recording, CheckInSession } from "@/lib/types"

// The two available modes in the unified check-in experience
type CheckInMode = "voice-note" | "ai-chat"

interface CheckInDrawerProps {
  /** Whether the drawer is open */
  open: boolean
  /** Called when drawer should open/close */
  onOpenChange: (open: boolean) => void
  /** Which mode to start in (defaults to voice-note) */
  defaultMode?: CheckInMode
  /** Called when a voice recording is saved */
  onRecordingComplete?: (recording: Recording) => void
  /** Called when an AI chat session is saved */
  onSessionComplete?: (session: CheckInSession) => void
}

export function CheckInDrawer({
  open,
  onOpenChange,
  defaultMode = "voice-note",
  onRecordingComplete,
  onSessionComplete,
}: CheckInDrawerProps) {
  // Current selected tab
  const [mode, setMode] = useState<CheckInMode>(defaultMode)

  // Whether a recording or chat is currently in progress
  // Used to disable tab switching and show discard confirmation
  const [isSessionActive, setIsSessionActive] = useState(false)

  // Browser microphone permission state
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt">("prompt")

  // Whether to show the "discard session?" confirmation dialog
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)

  // Whether a discard has been requested (signals child components to cancel)
  const [requestDiscard, setRequestDiscard] = useState(false)

  /**
   * Check microphone permission when drawer opens
   *
   * We check this upfront so we can show a helpful error message
   * rather than failing when user tries to record/chat.
   *
   * Note: The Permissions API may not be available in all browsers,
   * so we catch errors and default to "prompt" (let the browser handle it).
   */
  useEffect(() => {
    if (!open) return

    // Reset state when drawer opens
    setMicPermission("prompt")

    // Query current permission state
    navigator.permissions?.query({ name: "microphone" as PermissionName })
      .then((result) => {
        setMicPermission(result.state as "granted" | "denied" | "prompt")

        // Listen for permission changes while drawer is open
        result.onchange = () => {
          setMicPermission(result.state as "granted" | "denied" | "prompt")
        }
      })
      .catch(() => {
        // Permissions API not available, will check when recording starts
        setMicPermission("prompt")
      })
  }, [open])

  // Reset mode to default when drawer closes
  useEffect(() => {
    if (!open) {
      setMode(defaultMode)
      setIsSessionActive(false)
      setRequestDiscard(false)
    }
  }, [open, defaultMode])

  /**
   * Handle drawer close attempt
   *
   * If a session is active (recording or chatting), we show a confirmation
   * dialog instead of closing immediately. This prevents data loss.
   */
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && isSessionActive) {
      // Trying to close while session active - show confirmation
      setShowDiscardDialog(true)
    } else {
      onOpenChange(newOpen)
    }
  }, [isSessionActive, onOpenChange])

  /**
   * Handle confirmed discard from the confirmation dialog
   * Sets requestDiscard to signal child components to cancel their sessions
   */
  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardDialog(false)
    setRequestDiscard(true)
    // Don't close drawer here - wait for child component to call onDiscardComplete
  }, [])

  /**
   * Handle cancel discard - user wants to keep their session
   */
  const handleCancelDiscard = useCallback(() => {
    setShowDiscardDialog(false)
  }, [])

  /**
   * Handle discard complete from child component
   * Called after child has cancelled its session, now safe to close drawer
   */
  const handleDiscardComplete = useCallback(() => {
    setRequestDiscard(false)
    setIsSessionActive(false)
    onOpenChange(false)
  }, [onOpenChange])

  /**
   * Handle close request from child content components
   */
  const handleClose = useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  /**
   * Handle session state changes from child components
   *
   * This is called by VoiceNoteContent and AIChatContent when they
   * start/stop recording or chatting. We use this to:
   * 1. Disable tab switching during active sessions
   * 2. Show discard confirmation when closing during active session
   */
  const handleSessionChange = useCallback((isActive: boolean) => {
    setIsSessionActive(isActive)
  }, [])

  /**
   * Handle tab change
   *
   * Only allowed when no session is active
   */
  const handleModeChange = useCallback((newMode: string) => {
    if (!isSessionActive) {
      setMode(newMode as CheckInMode)
    }
  }, [isSessionActive])

  /**
   * Handle retry microphone permission
   *
   * Attempts to get microphone access, which will trigger the browser's
   * permission prompt if needed.
   */
  const handleRetryPermission = useCallback(async () => {
    try {
      // Request microphone access - this triggers the browser permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Permission granted - clean up the stream and update state
      stream.getTracks().forEach((track) => track.stop())
      setMicPermission("granted")
    } catch (error) {
      // Permission denied or error
      console.error("[CheckInDrawer] Mic permission denied:", error)
      setMicPermission("denied")
    }
  }, [])

  /**
   * Browser navigation guard
   *
   * Warns user if they try to close the tab/window or navigate away
   * while a session is active. This prevents accidental data loss.
   */
  useEffect(() => {
    if (!open || !isSessionActive) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "You have an active check-in session. Leave anyway?"
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [open, isSessionActive])

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="h-screen !mt-0 !max-h-none !rounded-none">
          {/*
            ===== HEADER SECTION =====
            Shows title, instruction, and close button (when not in session)
          */}
          <DrawerHeader className="px-4 py-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-lg">Check in</DrawerTitle>
                <DrawerDescription className="text-sm text-muted-foreground">
                  Talk about how you're feeling
                </DrawerDescription>
              </div>
              {/* Only show close button when no active session */}
              {!isSessionActive && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              )}
            </div>
          </DrawerHeader>

          {/*
            ===== MICROPHONE PERMISSION DENIED STATE =====
            If browser has denied mic access, show helpful error with retry
          */}
          {micPermission === "denied" ? (
            <div className="p-8 flex flex-col items-center gap-6">
              {/* Large icon to draw attention */}
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <MicOff className="w-8 h-8 text-destructive" />
              </div>

              {/* Error message with instructions */}
              <Alert variant="destructive" className="max-w-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Microphone access required</AlertTitle>
                <AlertDescription>
                  Please enable microphone access in your browser settings to use this feature.
                  Look for the microphone icon in your address bar.
                </AlertDescription>
              </Alert>

              {/* Retry button */}
              <Button onClick={handleRetryPermission}>
                Try Again
              </Button>
            </div>
          ) : (
            <>
              {/*
                ===== MODE TOGGLE TABS =====
                Allows switching between Voice note and AI chat modes
                Disabled when a session is active to prevent data loss
              */}
              <div className="px-6 py-3 border-b border-border/50">
                <Tabs value={mode} onValueChange={handleModeChange}>
                  <TabsList className="w-full">
                    <TabsTrigger
                      value="voice-note"
                      className="flex-1"
                      disabled={isSessionActive}
                    >
                      Voice note
                    </TabsTrigger>
                    <TabsTrigger
                      value="ai-chat"
                      className="flex-1"
                      disabled={isSessionActive}
                    >
                      AI chat
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/*
                ===== MODE CONTENT =====
                Render the appropriate content based on selected mode
                Only one is rendered at a time to manage resources properly
              */}
              <div className="flex-1 overflow-hidden">
                {mode === "voice-note" ? (
                  <VoiceNoteContent
                    onClose={handleClose}
                    onSessionChange={handleSessionChange}
                    onRecordingComplete={onRecordingComplete}
                  />
                ) : (
                  <AIChatContent
                    onClose={handleClose}
                    onSessionChange={handleSessionChange}
                    onSessionComplete={onSessionComplete}
                    requestDiscard={requestDiscard}
                    onDiscardComplete={handleDiscardComplete}
                  />
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/*
        ===== DISCARD CONFIRMATION DIALOG =====
        Shown when user tries to close the drawer while a session is active
        Uses Shadcn AlertDialog for consistent styling
      */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have a {mode === "voice-note" ? "recording" : "conversation"} in progress.
              Are you sure you want to discard it and close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDiscard}>
              Keep Going
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
