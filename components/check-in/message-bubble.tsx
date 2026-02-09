"use client"

/**
 * Message Bubble Component
 *
 * Displays a single message in the conversation with
 * role-based styling and optional metadata.
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { User, AlertTriangle, ChevronDown, ChevronRight } from "@/lib/icons"
import { CoachAvatar } from "@/components/coach-avatar"
import { useTimeZone } from "@/lib/timezone-context"
import type { CheckInMessage } from "@/lib/types"

interface MessageBubbleProps {
  message: CheckInMessage
  showMismatchIndicator?: boolean
  skipAnimation?: boolean
  highlight?: boolean
  className?: string
  /** Base64-encoded coach avatar image (no data: prefix) */
  coachAvatar?: string | null
}

export function MessageBubble({
  message,
  showMismatchIndicator = true,
  skipAnimation = false,
  highlight = false,
  className,
  coachAvatar,
}: MessageBubbleProps) {
  const { timeZone } = useTimeZone()
  const isUser = message.role === "user"
  const isAssistant = message.role === "assistant"
  const hasMismatch = message.mismatch?.detected
  const hasThinking = isAssistant && message.thinking
  const isAssistantStreaming = isAssistant && message.isStreaming

  // State for expandable thinking section
  const [showThinking, setShowThinking] = useState(false)

  // Format timestamp
  const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <motion.div
      id={`message-${message.id}`}
      data-message-id={message.id}
      className={cn(
        "flex min-w-0 gap-3 max-w-[85%] scroll-mt-24",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto",
        className
      )}
      initial={skipAnimation ? false : { opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-accent/10">
          <User className="w-4 h-4 text-accent" />
        </div>
      ) : (
        <CoachAvatar base64={coachAvatar} size="sm" />
      )}

      {/* Message content */}
      <div className="min-w-0 flex flex-col gap-1">
        <div
          className={cn(
            "min-w-0 rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-accent text-accent-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm",
            highlight ? "ring-2 ring-accent/40 ring-offset-2 ring-offset-background" : "",
          )}
        >
          <p className={cn("whitespace-pre-wrap [overflow-wrap:anywhere]", isAssistantStreaming && "opacity-90")}>
            {message.content}
            {isAssistantStreaming && (
              <span className="inline-block opacity-60">▍</span>
            )}
          </p>
        </div>

        {/* Expandable thinking/COT section (assistant only) */}
        {hasThinking && (
          <div className="flex flex-col gap-1 mt-1">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 group"
            >
              {showThinking ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span className="group-hover:underline">
                {showThinking ? "Hide" : "Show"} thinking
              </span>
            </button>

            <AnimatePresence>
              {showThinking && (
                <motion.div
                  className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground border border-border/50"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="whitespace-pre-wrap">{message.thinking}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Metadata row */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground",
            isUser ? "flex-row-reverse" : ""
          )}
        >
          <span>{time}</span>

          {/* Mismatch indicator */}
          {showMismatchIndicator && hasMismatch && (
            <div className="flex items-center gap-1 text-yellow-500">
              <AlertTriangle className="w-3 h-3" />
              <span>Voice mismatch</span>
            </div>
          )}

          {/* Audio duration */}
          {message.audioDuration && (
            <span>{Math.round(message.audioDuration)}s audio</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Typing indicator shown while assistant is generating response
 */
export function TypingIndicator({
  className,
  coachAvatar,
}: {
  className?: string
  /** Base64-encoded coach avatar image (no data: prefix) */
  coachAvatar?: string | null
}) {
  return (
    <motion.div
      className={cn("flex gap-3 max-w-[85%] mr-auto", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Avatar */}
      <CoachAvatar base64={coachAvatar} size="sm" />

      {/* Typing indicator (non-looping) */}
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
        <span className="text-sm text-muted-foreground">Thinking...</span>
      </div>
    </motion.div>
  )
}

/**
 * Transcript preview shown while user is speaking
 */
export function TranscriptPreview({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  if (!text.trim()) return null

  return (
    <motion.div
      className={cn("flex gap-3 max-w-[85%] ml-auto flex-row-reverse", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 0.7, y: 0 }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-accent/10">
        <User className="w-4 h-4 text-accent" />
      </div>

      {/* Preview text */}
      <div className="bg-accent/50 text-accent-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
        <p className="whitespace-pre-wrap italic">{text}...</p>
      </div>
    </motion.div>
  )
}
