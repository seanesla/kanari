"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { JournalPromptWidgetState } from "@/lib/types"
import { WidgetContainer } from "./widget-container"

interface JournalPromptProps {
  widget: JournalPromptWidgetState
  onDismiss?: () => void
  onSave?: (content: string) => Promise<void>
}

export function JournalPrompt({ widget, onDismiss, onSave }: JournalPromptProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setIsOpen(false)
    setContent("")
    setIsSaving(false)
  }, [widget.id])

  const placeholder = useMemo(() => {
    return widget.args.placeholder || "Write a few sentences..."
  }, [widget.args.placeholder])

  const canSave = content.trim().length > 0 && !isSaving && widget.status !== "saved"

  return (
    <WidgetContainer
      title="Journal prompt"
      description={widget.args.category ? `Category: ${widget.args.category}` : undefined}
      onDismiss={onDismiss}
    >
      {!isOpen ? (
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
              onClick={() => setIsOpen(true)}
            >
              Open
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium whitespace-pre-wrap">{widget.args.prompt}</p>

          <div className="mt-3">
            <Textarea
              value={content}
              placeholder={placeholder}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-28"
              disabled={isSaving || widget.status === "saved"}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
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
                if (!onSave) return
                if (!canSave) return
                try {
                  setIsSaving(true)
                  await onSave(content)
                } finally {
                  setIsSaving(false)
                }
              }}
              disabled={!canSave}
            >
              {isSaving ? "Saving..." : widget.status === "saved" ? "Saved" : "Save"}
            </Button>
          </div>
        </>
      )}
    </WidgetContainer>
  )
}
