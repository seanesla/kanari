"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
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
import { RecordingDrawerContent } from "./recording-drawer-content"
import type { Recording } from "@/lib/types"

interface RecordingDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecordingComplete?: (recording: Recording) => void
}

export function RecordingDrawer({
  open,
  onOpenChange,
  onRecordingComplete,
}: RecordingDrawerProps) {
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)

  // Handle drawer close attempt
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && isRecordingInProgress) {
      // Trying to close while recording - show confirmation
      setShowDiscardDialog(true)
    } else {
      onOpenChange(newOpen)
    }
  }, [isRecordingInProgress, onOpenChange])

  // Handle confirmed discard
  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardDialog(false)
    setIsRecordingInProgress(false)
    onOpenChange(false)
  }, [onOpenChange])

  // Handle cancel discard
  const handleCancelDiscard = useCallback(() => {
    setShowDiscardDialog(false)
  }, [])

  // Handle close from content
  const handleClose = useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  // Handle recording state changes from content
  const handleRecordingStateChange = useCallback((isRecording: boolean) => {
    setIsRecordingInProgress(isRecording)
  }, [])

  // Navigation guards for browser close/refresh
  useEffect(() => {
    if (!open || !isRecordingInProgress) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "You have an unsaved recording. Leave anyway?"
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [open, isRecordingInProgress])

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Voice Recording</DrawerTitle>
          </DrawerHeader>
          <RecordingDrawerContent
            onRecordingComplete={onRecordingComplete}
            onClose={handleClose}
            onRecordingStateChange={handleRecordingStateChange}
          />
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard recording?</AlertDialogTitle>
            <AlertDialogDescription>
              You have a recording in progress. Are you sure you want to discard it and close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDiscard}>
              Keep Recording
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
