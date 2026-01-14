"use client"

/**
 * Chat Input Component
 *
 * Text input with slash command detection and tool picker integration.
 * Supports both typing messages and triggering tools.
 * Styled with glass effect and cursor-following glow to match check-in-input-bar.
 */

import { useState, useRef, useCallback, useEffect } from "react"
import { Send, Mic, MicOff } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { CursorBorderGlow } from "@/components/ui/cursor-border-glow"
import { ToolCommandMenu } from "./tool-command-menu"
import { ToolPickerButton } from "./tool-picker-button"
import { ToolArgumentForm } from "./tool-argument-form"
import { findToolBySlashCommand, type ManualToolConfig } from "@/lib/gemini/manual-tools"
import { useCursorGlow } from "@/hooks/use-cursor-glow"

interface ChatInputProps {
  /** Called when user sends a text message */
  onSendText: (text: string) => void
  /** Called when user triggers a tool with arguments */
  onTriggerTool: (toolName: string, args: Record<string, unknown>) => void
  /** Whether the input is disabled */
  disabled?: boolean
  /** Whether the microphone is muted */
  isMuted?: boolean
  /** Called when user toggles mute */
  onToggleMute?: () => void
}

export function ChatInput({ onSendText, onTriggerTool, disabled, isMuted, onToggleMute }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ManualToolConfig | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const glow = useCursorGlow({ clampToBorder: true })

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
    <div
      className="relative w-full p-4 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] backdrop-blur-2xl backdrop-saturate-200 group"
      onMouseMove={glow.onMouseMove}
      onMouseLeave={glow.onMouseLeave}
      style={{
        ...glow.style,
        boxShadow:
          "inset 0 1px 0 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 0 rgba(0, 0, 0, 0.02), 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <CursorBorderGlow
        className="rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        size={260}
        borderWidth={2}
      />
      <Popover open={showCommandMenu} onOpenChange={setShowCommandMenu}>
        <div className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.02)] text-left hover:border-white/20 hover:bg-[rgba(255,255,255,0.04)] transition-all">
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
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </PopoverAnchor>

          {/* Mute button - only show if onToggleMute is provided */}
          {onToggleMute && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 shrink-0 rounded-full transition-all duration-200 hover:scale-110 active:scale-100",
                isMuted
                  ? "bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-500/30"
                  : "hover:bg-white/5"
              )}
              onClick={onToggleMute}
              aria-pressed={!!isMuted}
              disabled={disabled}
            >
              {isMuted ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              <span className="sr-only">{isMuted ? "Unmute" : "Mute"}</span>
            </Button>
          )}

          {/* Send button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 hover:bg-white/5"
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
