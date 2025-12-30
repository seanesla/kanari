"use client"

import { useMemo, useState } from "react"
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
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

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
    </WidgetContainer>
  )
}

