/**
 * AI Chat Detail View
 *
 * Full chat session display for the main content area in the ChatGPT-style layout.
 * Shows session info, all messages, and mismatch indicators.
 * Extracted from ChatSessionDrawer for inline display.
 */

"use client"

import { MessageSquare, Calendar, AlertCircle, Trash2, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "@/components/check-in/message-bubble"
import { formatDate, formatDurationWithUnits } from "@/lib/date-utils"
import type { CheckInSession } from "@/lib/types"

interface AIChatDetailViewProps {
  session: CheckInSession
  onDelete: () => void
  linkedRecordingId?: string
  onOpenLinkedRecording?: (recordingId: string) => void
}

export function AIChatDetailView({
  session,
  onDelete,
  linkedRecordingId,
  onOpenLinkedRecording,
}: AIChatDetailViewProps) {
  // Calculate session duration
  const duration = session.duration ? formatDurationWithUnits(session.duration) : null

  // Determine if there were voice mismatches detected
  const hasMismatches = (session.mismatchCount ?? 0) > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-accent/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-accent/10">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Chat</h2>
            <p className="text-sm text-muted-foreground">
              {session.messages.length} messages{duration && ` • ${duration}`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Delete chat session"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Session info bar */}
      <div
        className="px-6 py-3 border-b border-accent/30 bg-foreground/5 backdrop-blur-xl space-y-2"
        style={{ boxShadow: '0 0 10px color-mix(in srgb, var(--accent) 10%, transparent)' }}
      >
        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(session.startedAt)}</span>
        </div>

        {/* Voice mismatch indicator */}
        {hasMismatches && (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <span>{session.mismatchCount} voice patterns detected</span>
          </div>
        )}

        {/* Linked recording indicator */}
        {linkedRecordingId && (
          <button
            onClick={() => onOpenLinkedRecording?.(linkedRecordingId)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            <Mic className="h-4 w-4" />
            <span>From voice note</span>
          </button>
        )}

        {/* Session summary if available */}
        {session.summary && session.summary.positiveNotes.length > 0 && (
          <p className="text-sm text-muted-foreground italic border-t border-border/30 pt-2 mt-2">
            &ldquo;{session.summary.positiveNotes[0]}&rdquo;
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
              <MessageBubble key={message.id} message={message} skipAnimation />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
