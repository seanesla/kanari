"use client"

/**
 * Conversation View Component
 *
 * Scrollable container for conversation messages with
 * auto-scroll to latest message.
 *
 * Uses single-element architecture: messages are added to array on first chunk
 * and updated in place. No separate streaming element = no flicker.
 */

import { useRef, useEffect, useMemo } from "react"
import { AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  MessageBubble,
  TypingIndicator,
  TranscriptPreview,
} from "./message-bubble"
import type { CheckInState, CheckInMessage } from "@/lib/types"

interface ConversationViewProps {
  state: CheckInState
  messages: CheckInMessage[]
  currentUserTranscript?: string
  className?: string
}

export function ConversationView({
  state,
  messages,
  currentUserTranscript = "",
  className,
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages or content changes
  // Track last message content to detect streaming updates
  const lastMessageContent = messages[messages.length - 1]?.content || ""

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, state, currentUserTranscript, lastMessageContent])

  const isProcessing = state === "processing"
  const isUserSpeaking = state === "user_speaking"

  // Sort messages by timestamp for correct chronological order
  // (handles case where AI responds before user finishes speaking)
  const sortedMessages = useMemo(
    () =>
      messages
        .slice()
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
    [messages]
  )

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex-1 overflow-y-auto px-4 py-4 space-y-4",
        "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        className
      )}
    >
      {/* Empty state */}
      {messages.length === 0 && !isUserSpeaking && !currentUserTranscript && (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <p className="text-sm">Start speaking to begin the conversation</p>
          <p className="text-xs mt-1 opacity-70">
            kanari is listening and ready to chat
          </p>
        </div>
      )}

      {/* All messages - streaming messages are just regular messages with isStreaming=true */}
      <AnimatePresence initial={false}>
        {sortedMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            skipAnimation={message.isStreaming}
          />
        ))}
      </AnimatePresence>

      {/* Current user transcript preview */}
      <AnimatePresence>
        {isUserSpeaking && currentUserTranscript && (
          <TranscriptPreview text={currentUserTranscript} />
        )}
      </AnimatePresence>

      {/* Processing indicator */}
      <AnimatePresence>
        {isProcessing && <TypingIndicator />}
      </AnimatePresence>

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
}
