/**
 * Chat Session Detail Modal
 *
 * A centered modal that displays the full conversation of an AI chat session.
 * Shows all messages in chronological order with full details like thinking steps,
 * voice metrics, and mismatch indicators.
 *
 * Features:
 * - Full conversation view with read-only messages
 * - Session header with date, message count, and session summary
 * - Message bubbles with optional thinking/metadata
 * - Close button to dismiss modal
 */

"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Calendar, MessageSquare, AlertCircle } from "@/lib/icons"
import { formatDate } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
import { useCoachAvatar } from "@/hooks/use-coach-avatar"
import { MessageBubble } from "@/components/check-in/message-bubble"
import type { CheckInSession } from "@/lib/types"

interface ChatSessionDrawerProps {
  /** The chat session to display (null means modal is closed) */
  session: CheckInSession | null
  /** Callback when user wants to close the modal */
  onClose: () => void
}

export function ChatSessionDrawer({ session, onClose }: ChatSessionDrawerProps) {
  const { timeZone } = useTimeZone()
  const { avatarBase64: coachAvatar } = useCoachAvatar()
  // Handle escape key to close modal
  useEffect(() => {
    if (!session) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [session, onClose])

  // Don't render anything if modal is closed
  if (!session) return null

  return (
    <>
      {/* Backdrop - click to close */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered modal panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-2xl max-h-[85vh] bg-background border border-border rounded-xl shadow-2xl flex flex-col pointer-events-auto">
          {/* Header section */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h2 className="text-lg font-semibold">Session Details</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Session info bar */}
          <div className="px-6 py-3 border-b border-border/50 bg-muted/20 space-y-2">
            {/* Date and message count */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(session.startedAt, timeZone)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>{session.messages.length} messages</span>
              </div>
            </div>

            {/* Voice mismatch indicator */}
            {session.mismatchCount && session.mismatchCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
                <AlertCircle className="h-4 w-4" />
                <span>{session.mismatchCount} voice patterns detected</span>
              </div>
            )}

            {/* Session summary if available */}
            {session.summary && session.summary.positiveNotes.length > 0 && (
              <p className="text-sm text-muted-foreground italic border-t border-border/30 pt-2 mt-2">
                "{session.summary.positiveNotes[0]}"
              </p>
            )}
          </div>

          {/* Messages scroll area */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-6 space-y-4">
              {session.messages.length === 0 ? (
                // Empty state (should rarely happen)
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No messages in this session</p>
                </div>
              ) : (
                // Message list - use existing MessageBubble component
                session.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} skipAnimation coachAvatar={coachAvatar} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  )
}
