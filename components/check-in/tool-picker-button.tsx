"use client"

/**
 * Tool Picker Button
 *
 * "+" button that opens a dropdown menu with available tools.
 */

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MANUAL_TOOLS, type ManualToolConfig } from "@/lib/gemini/manual-tools"

interface ToolPickerButtonProps {
  /** Called when a tool is selected */
  onSelect: (tool: ManualToolConfig) => void
  /** Whether the button is disabled */
  disabled?: boolean
}

export function ToolPickerButton({ onSelect, disabled }: ToolPickerButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled}
        >
          <Plus className="h-5 w-5" />
          <span className="sr-only">Open tools menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel>Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {MANUAL_TOOLS.map((tool) => {
            const Icon = tool.icon
            return (
              <DropdownMenuItem
                key={tool.internalName}
                onClick={() => onSelect(tool)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{tool.displayName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {tool.description}
                  </div>
                </div>
                <DropdownMenuShortcut>/{tool.slashCommand}</DropdownMenuShortcut>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
