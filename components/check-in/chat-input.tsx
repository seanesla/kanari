"use client"

/**
 * Chat Input Component
 *
 * Text input with slash command detection and tool picker integration.
 * Supports both typing messages and triggering tools.
 */

import { useState, useRef, useCallback, useEffect } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ToolCommandMenu } from "./tool-command-menu"
import { ToolPickerButton } from "./tool-picker-button"
import { ToolArgumentForm } from "./tool-argument-form"
import { findToolBySlashCommand, type ManualToolConfig } from "@/lib/gemini/manual-tools"

interface ChatInputProps {
  /** Called when user sends a text message */
  onSendText: (text: string) => void
  /** Called when user triggers a tool with arguments */
  onTriggerTool: (toolName: string, args: Record<string, unknown>) => void
  /** Whether the input is disabled */
  disabled?: boolean
}

export function ChatInput({ onSendText, onTriggerTool, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ManualToolConfig | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect "/" for slash commands
  useEffect(() => {
    // Show command menu if value starts with "/" and we're not already showing a form
    if (value.startsWith("/") && !selectedTool) {
      setShowCommandMenu(true)
    } else {
      setShowCommandMenu(false)
    }
  }, [value, selectedTool])

  // Handle tool selection from menu or picker
  const handleToolSelect = useCallback(
    (tool: ManualToolConfig) => {
      setShowCommandMenu(false)
      setValue("")

      if (tool.requiresArgs) {
        // Show argument form
        setSelectedTool(tool)
      } else {
        // Trigger immediately with empty args
        onTriggerTool(tool.internalName, {})
      }
    },
    [onTriggerTool]
  )

  // Handle form submission
  const handleToolSubmit = useCallback(
    (args: Record<string, unknown>) => {
      if (selectedTool) {
        onTriggerTool(selectedTool.internalName, args)
        setSelectedTool(null)
      }
    },
    [selectedTool, onTriggerTool]
  )

  // Handle form cancel
  const handleToolCancel = useCallback(() => {
    setSelectedTool(null)
    // Focus back on input
    inputRef.current?.focus()
  }, [])

  // Handle send button
  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && !trimmed.startsWith("/")) {
      onSendText(trimmed)
      setValue("")
    }
  }, [value, onSendText])

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !showCommandMenu) {
        e.preventDefault()

        // Check if it's a complete slash command
        if (value.startsWith("/")) {
          const tool = findToolBySlashCommand(value)
          if (tool) {
            handleToolSelect(tool)
            return
          }
        }

        handleSend()
      }

      // Escape closes command menu
      if (e.key === "Escape" && showCommandMenu) {
        e.preventDefault()
        setShowCommandMenu(false)
        setValue("")
      }
    },
    [value, showCommandMenu, handleSend, handleToolSelect]
  )

  // If showing argument form, render that instead of input
  if (selectedTool) {
    return (
      <ToolArgumentForm
        tool={selectedTool}
        onSubmit={handleToolSubmit}
        onCancel={handleToolCancel}
      />
    )
  }

  // Get search value for command menu (text after "/")
  const searchValue = value.startsWith("/") ? value.slice(1) : ""

  return (
    <div className="px-4 py-3">
      <Popover open={showCommandMenu} onOpenChange={setShowCommandMenu}>
        <div className="flex items-center gap-2">
          {/* Tool picker button */}
          <ToolPickerButton onSelect={handleToolSelect} disabled={disabled} />

          {/* Input field with popover anchor */}
          <PopoverAnchor asChild>
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or / for tools..."
              disabled={disabled}
              className="flex-1"
            />
          </PopoverAnchor>

          {/* Send button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={disabled || !value.trim() || value.startsWith("/")}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>

        {/* Command menu popup */}
        <PopoverContent
          side="top"
          align="start"
          className="p-0 w-[300px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ToolCommandMenu searchValue={searchValue} onSelect={handleToolSelect} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
