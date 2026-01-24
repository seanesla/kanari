"use client"

/**
 * Thinking Display Component
 *
 * Shows AI's chain-of-thought reasoning during the "processing" state.
 * Features:
 * - Collapsed view: Shows a summarized version (via Gemini 2.5 Flash)
 * - Expanded view: Shows raw thinking text
 * - Fallback: Animated dots when no thinking text available
 */

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Sparkles, ChevronDown, ChevronRight, Brain } from "@/lib/icons"
import { createGeminiHeaders } from "@/lib/utils"

interface ThinkingDisplayProps {
  /** Raw thinking text streaming from Gemini */
  thinkingText: string
  className?: string
}

export function ThinkingDisplay({ thinkingText, className }: ThinkingDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const lastSummarizedTextRef = useRef("")
  const summaryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced summarization - request summary after thinking text stabilizes
  useEffect(() => {
    // Clear any pending timeout
    if (summaryTimeoutRef.current) {
      clearTimeout(summaryTimeoutRef.current)
    }

    // Only summarize if we have substantial thinking text (>100 chars)
    if (!thinkingText || thinkingText.length < 100) {
      return
    }

    // Don't re-summarize if text hasn't changed significantly
    const hasChanged = thinkingText.length > lastSummarizedTextRef.current.length + 50
    if (!hasChanged && summary) {
      return
    }

    // Debounce: wait 500ms after last update before summarizing
    summaryTimeoutRef.current = setTimeout(async () => {
      setIsSummarizing(true)
      try {
        const headers = await createGeminiHeaders({
          "Content-Type": "application/json",
        })

        const response = await fetch("/api/gemini/summarize-thinking", {
          method: "POST",
          headers,
          body: JSON.stringify({ thinkingText }),
        })

        if (response.ok) {
          const { summary: newSummary } = await response.json()
          setSummary(newSummary)
          lastSummarizedTextRef.current = thinkingText
        }
      } catch (error) {
        console.warn("[ThinkingDisplay] Failed to summarize:", error)
      } finally {
        setIsSummarizing(false)
      }
    }, 500)

    return () => {
      if (summaryTimeoutRef.current) {
        clearTimeout(summaryTimeoutRef.current)
      }
    }
  }, [thinkingText, summary])

  // If no thinking text, show animated dots fallback
  if (!thinkingText) {
    return <ThinkingDots className={className} />
  }

  return (
    <motion.div
      className={cn("flex gap-3 max-w-[85%] mr-auto", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/10">
        <Brain className="w-4 h-4 text-primary" />
      </div>

      {/* Thinking content */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Header with expand toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="group-hover:underline">
            {isExpanded ? "Hide" : "Show"} thinking
          </span>
          {isSummarizing && (
            <span className="text-muted-foreground/50">summarizing...</span>
          )}
        </button>

        {/* Summary (collapsed view) */}
        {!isExpanded && (summary || thinkingText) && (
          <motion.div
            className="bg-muted/40 rounded-lg p-2.5 text-xs text-muted-foreground border border-border/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-start gap-2">
              <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0 text-accent" />
              <p className="whitespace-pre-wrap line-clamp-2">
                {summary || thinkingText.slice(0, 150) + (thinkingText.length > 150 ? "..." : "")}
              </p>
            </div>
          </motion.div>
        )}

        {/* Full thinking (expanded view) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground border border-border/50 max-h-[200px] overflow-y-auto"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="whitespace-pre-wrap">{thinkingText}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/**
 * Fallback animated dots when no thinking text is available
 */
function ThinkingDots({ className }: { className?: string }) {
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

      {/* Fallback (non-looping) */}
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
        <span className="text-sm text-muted-foreground">Thinking...</span>
      </div>
    </motion.div>
  )
}
