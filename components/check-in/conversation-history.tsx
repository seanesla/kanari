"use client"

/**
 * Conversation History Component
 *
 * A collapsible sidebar panel that displays past check-in sessions.
 * Users can browse their conversation history and view individual sessions.
 *
 * Features:
 * - Lists past sessions with date, time, and message count
 * - Click to view full conversation (read-only)
 * - Shows session summary if available
 * - Close button to return to list view
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, ChevronLeft, MessageSquare, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCheckInSessions } from "@/hooks/use-storage"
import { MessageBubble } from "./message-bubble"
import type { CheckInSession } from "@/lib/types"

interface ConversationHistoryProps {
  /** Called when the user wants to close the history panel */
  onClose: () => void
  /** Additional CSS classes */
  className?: string
}

export function ConversationHistory({ onClose, className }: ConversationHistoryProps) {
  // Fetch the last 20 check-in sessions
  const sessions = useCheckInSessions(20)

  // Currently selected session to view in detail
  const [selectedSession, setSelectedSession] = useState<CheckInSession | null>(null)

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const isYesterday =
      new Date(now.getTime() - 86400000).toDateString() === date.toDateString()

    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    }
    if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  // Get a preview of the first user message (for list display)
  const getPreview = (session: CheckInSession) => {
    const firstUserMessage = session.messages.find((m) => m.role === "user")
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
    }
    return "No messages"
  }

  return (
    <div className={cn("flex flex-col h-full bg-background border-r", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        {selectedSession ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSession(null)}
              className="gap-1 -ml-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <h3 className="font-medium text-sm">Past Check-ins</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {selectedSession ? (
          // Session detail view
          <motion.div
            key="detail"
            className="flex-1 overflow-hidden flex flex-col"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Session info */}
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(selectedSession.startedAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{selectedSession.messages.length} messages</span>
                {selectedSession.mismatchCount && selectedSession.mismatchCount > 0 && (
                  <span className="text-yellow-500">
                    {selectedSession.mismatchCount} voice patterns noted
                  </span>
                )}
              </div>
              {selectedSession.summary && selectedSession.summary.positiveNotes.length > 0 && (
                <p className="text-sm mt-2 text-muted-foreground italic">
                  {selectedSession.summary.positiveNotes[0]}
                </p>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="flex flex-col gap-4">
                {selectedSession.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    skipAnimation
                  />
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        ) : (
          // Session list view
          <motion.div
            key="list"
            className="flex-1 overflow-hidden"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <ScrollArea className="h-full">
              {sessions.length === 0 ? (
                // Empty state
                <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No past check-ins yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Your AI chat history will appear here
                  </p>
                </div>
              ) : (
                // Session list
                <div className="flex flex-col">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className="flex flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {formatDate(session.startedAt)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {session.messages.length} msgs
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {getPreview(session)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
