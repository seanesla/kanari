"use client"

/**
 * Conversation View Component
 *
 * Scrollable container for conversation messages with
 * auto-scroll to latest message.
 */

import { useRef, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  MessageBubble,
  TypingIndicator,
  TranscriptPreview,
} from "./message-bubble"
import type { CheckInMessage, CheckInState } from "@/lib/types"

interface ConversationViewProps {
  messages: CheckInMessage[]
  state: CheckInState
  currentUserTranscript?: string
  currentAssistantTranscript?: string
  className?: string
}

export function ConversationView({
  messages,
  state,
  currentUserTranscript = "",
  currentAssistantTranscript = "",
  className,
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages or state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, state, currentUserTranscript, currentAssistantTranscript])

  const isProcessing = state === "processing"
  const isUserSpeaking = state === "user_speaking"
  const isAssistantSpeaking = state === "assistant_speaking"

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

      {/* Message list */}
      <AnimatePresence mode="popLayout">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
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

      {/* Current assistant transcript */}
      <AnimatePresence>
        {isAssistantSpeaking && currentAssistantTranscript && (
          <MessageBubble
            message={{
              id: "current-assistant",
              role: "assistant",
              content: currentAssistantTranscript,
              timestamp: new Date().toISOString(),
            }}
          />
        )}
      </AnimatePresence>

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
}
