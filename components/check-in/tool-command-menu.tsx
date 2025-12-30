"use client"

/**
 * Tool Command Menu
 *
 * Slash command autocomplete popup for selecting tools.
 * Uses cmdk for keyboard navigation and filtering.
 */

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { filterToolsBySlashCommand, type ManualToolConfig } from "@/lib/gemini/manual-tools"

interface ToolCommandMenuProps {
  /** Current search value (text after "/") */
  searchValue: string
  /** Called when a tool is selected */
  onSelect: (tool: ManualToolConfig) => void
}

export function ToolCommandMenu({ searchValue, onSelect }: ToolCommandMenuProps) {
  const filteredTools = filterToolsBySlashCommand(searchValue)

  return (
    <Command className="rounded-lg border shadow-md">
      <CommandList>
        <CommandEmpty>No tools found</CommandEmpty>
        <CommandGroup heading="Tools">
          {filteredTools.map((tool) => {
            const Icon = tool.icon
            return (
              <CommandItem
                key={tool.internalName}
                value={tool.slashCommand}
                onSelect={() => onSelect(tool)}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{tool.displayName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {tool.description}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  /{tool.slashCommand}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
