"use client"

/**
 * Message Bubble Component
 *
 * Displays a single message in the conversation with
 * role-based styling and optional metadata.
 */

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { User, Sparkles, AlertTriangle } from "lucide-react"
import type { CheckInMessage } from "@/lib/types"

interface MessageBubbleProps {
  message: CheckInMessage
  showMismatchIndicator?: boolean
  className?: string
}

export function MessageBubble({
  message,
  showMismatchIndicator = true,
  className,
}: MessageBubbleProps) {
  const isUser = message.role === "user"
  const isAssistant = message.role === "assistant"
  const hasMismatch = message.mismatch?.detected

  // Format timestamp
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <motion.div
      className={cn(
        "flex gap-3 max-w-[85%]",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto",
        className
      )}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-accent/10" : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-accent" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
      </div>

      {/* Message content */}
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-accent text-accent-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Metadata row */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground px-1",
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
export function TypingIndicator({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("flex gap-3 max-w-[85%] mr-auto", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/10">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>

      {/* Typing dots */}
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 bg-muted-foreground/50 rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
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
