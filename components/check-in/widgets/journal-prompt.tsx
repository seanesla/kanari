"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { JournalPromptWidgetState } from "@/lib/types"
import { WidgetContainer } from "./widget-container"
import { cn } from "@/lib/utils"

interface JournalPromptProps {
  widget: JournalPromptWidgetState
  onDismiss?: () => void
  onSave?: (content: string) => Promise<void>
  onOpenFocus?: () => void
  onBack?: () => void
  initialContent?: string
  onDraftChange?: (content: string) => void
  variant?: "inline" | "focus"
  className?: string
}

export function JournalPrompt({
  widget,
  onDismiss,
  onSave,
  onOpenFocus,
  onBack,
  initialContent,
  onDraftChange,
  variant = "inline",
  className,
}: JournalPromptProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const isFocus = variant === "focus"

  useEffect(() => {
    setIsOpen(false)
    setContent(initialContent || "")
    setIsSaving(false)
  }, [widget.id, initialContent])

  useEffect(() => {
    if (!onDraftChange) return
    if (widget.status === "saved") {
      onDraftChange("")
    }
  }, [onDraftChange, widget.status])

  const placeholder = useMemo(() => {
    return widget.args.placeholder || "Write a few sentences..."
  }, [widget.args.placeholder])

  const canSave = content.trim().length > 0 && !isSaving && widget.status !== "saved"
  const showExpanded = isFocus || isOpen

  return (
    <WidgetContainer
      title="Journal prompt"
      description={widget.args.category ? `Category: ${widget.args.category}` : undefined}
      onBack={isFocus ? onBack : undefined}
      onDismiss={onDismiss}
      variant={isFocus ? "focus" : "inline"}
      className={className}
    >
      {!showExpanded ? (
        <>
          <p className="text-sm text-muted-foreground">
            Kanari suggested a quick journal entry. Want to open the prompt?
          </p>
          <p className="mt-3 text-sm font-medium whitespace-pre-wrap">{widget.args.prompt}</p>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onDismiss}>
              Not now
            </Button>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => {
                if (onOpenFocus) {
                  onOpenFocus()
                  return
                }
                setIsOpen(true)
              }}
            >
              Open
            </Button>
          </div>
        </>
      ) : (
        <div className={cn("flex flex-col", isFocus ? "h-full min-h-0" : "")}>
          <p
            className={cn(
              isFocus ? "text-base font-medium" : "text-sm font-medium",
              "whitespace-pre-wrap"
            )}
          >
            {widget.args.prompt}
          </p>

          <div className={cn(isFocus ? "mt-4 flex-1 min-h-0" : "mt-3")}>
            <Textarea
              value={content}
              placeholder={placeholder}
              onChange={(e) => {
                const next = e.target.value
                setContent(next)
                onDraftChange?.(next)
              }}
              className={cn(
                isFocus
                  ? "h-full min-h-[260px] md:min-h-[320px] resize-none"
                  : "min-h-28"
              )}
              disabled={isSaving || widget.status === "saved"}
              autoFocus={isFocus}
            />
          </div>

          <div
            className={cn(
              "mt-3 flex items-center justify-between gap-3",
              isFocus && "mt-auto pt-4 border-t border-border/60"
            )}
          >
            <div className="text-xs text-muted-foreground">
              {widget.status === "saved"
                ? "Saved to your journal."
                : widget.status === "failed"
                  ? widget.error || "Save failed."
                  : ""}
            </div>
            <Button
              size="sm"
              onClick={async () => {
                if (widget.status === "saved") {
                  onBack?.()
                  return
                }
                if (!onSave) return
                if (!canSave) return
                try {
                  setIsSaving(true)
                  await onSave(content)
                } finally {
                  setIsSaving(false)
                }
              }}
              disabled={widget.status !== "saved" ? !canSave : false}
              className={cn(
                isFocus &&
                  widget.status === "saved" &&
                  "bg-accent text-accent-foreground hover:bg-accent/90"
              )}
            >
              {isSaving
                ? "Saving..."
                : widget.status === "saved"
                  ? onBack
                    ? "Back to chat"
                    : "Saved"
                  : "Save"}
            </Button>
          </div>
        </div>
      )}
    </WidgetContainer>
  )
}
