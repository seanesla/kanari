"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronUp, RefreshCw, Coffee, Dumbbell, Brain, Users, Moon, CheckCircle2, X, Filter } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DraggableSuggestionCard } from "./draggable-suggestion-card"
import type { Suggestion, SuggestionCategory } from "@/lib/types"

const categoryConfig: Record<SuggestionCategory | "all", { label: string; icon: typeof Coffee; color: string }> = {
  all: { label: "All", icon: Filter, color: "text-foreground" },
  break: { label: "Breaks", icon: Coffee, color: "text-accent" },
  exercise: { label: "Exercise", icon: Dumbbell, color: "text-green-500" },
  mindfulness: { label: "Mindfulness", icon: Brain, color: "text-purple-500" },
  social: { label: "Social", icon: Users, color: "text-blue-500" },
  rest: { label: "Rest", icon: Moon, color: "text-indigo-500" },
}

interface PendingSidebarProps {
  suggestions: Suggestion[]
  onSuggestionClick: (suggestion: Suggestion) => void
  onDragStart?: (suggestion: Suggestion) => void
  onDragEnd?: () => void
  onRegenerate?: () => void
  isRegenerating?: boolean
  className?: string
}

export function PendingSidebar({
  suggestions,
  onSuggestionClick,
  onDragStart,
  onDragEnd,
  onRegenerate,
  isRegenerating,
  className,
}: PendingSidebarProps) {
  const [categoryFilter, setCategoryFilter] = useState<SuggestionCategory | "all">("all")
  const [showAllPending, setShowAllPending] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)

  // Split suggestions by status
  const { pending, completed } = useMemo(() => {
    const pending = suggestions.filter(s => s.status === "pending")
    const completed = suggestions.filter(s =>
      s.status === "completed" || s.status === "dismissed" || s.status === "accepted"
    )
    return { pending, completed }
  }, [suggestions])

  // Apply category filter
  const filteredPending = useMemo(() => {
    if (categoryFilter === "all") return pending
    return pending.filter(s => s.category === categoryFilter)
  }, [pending, categoryFilter])

  // Limit to 5 unless expanded
  const displayedPending = showAllPending ? filteredPending : filteredPending.slice(0, 5)
  const hiddenCount = filteredPending.length - 5

  const FilterIcon = categoryConfig[categoryFilter].icon

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4 px-1">
        <h3 className="text-sm font-medium">Pending</h3>
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                <FilterIcon className={cn("h-3.5 w-3.5 mr-1", categoryConfig[categoryFilter].color)} />
                {categoryConfig[categoryFilter].label}
                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(categoryConfig) as (SuggestionCategory | "all")[]).map((cat) => {
                const config = categoryConfig[cat]
                const Icon = config.icon
                const count = cat === "all"
                  ? pending.length
                  : pending.filter(s => s.category === cat).length
                return (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(categoryFilter === cat && "bg-accent/10")}
                  >
                    <Icon className={cn("h-4 w-4 mr-2", config.color)} />
                    {config.label}
                    <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Regenerate */}
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>

      {/* Pending List */}
      <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {displayedPending.map((suggestion, index) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <DraggableSuggestionCard
                  suggestion={suggestion}
                  onClick={() => onSuggestionClick(suggestion)}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredPending.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No pending suggestions</p>
              {categoryFilter !== "all" && (
                <button
                  onClick={() => setCategoryFilter("all")}
                  className="text-xs text-accent hover:underline mt-1"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          {/* Show more/less button */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllPending(!showAllPending)}
              className="w-full text-center py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllPending ? (
                <>
                  <ChevronUp className="h-3 w-3 inline mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 inline mr-1" />
                  Show {hiddenCount} more
                </>
              )}
            </button>
          )}
        </div>
      </ScrollArea>

      {/* Completed Section */}
      {completed.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-1 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed ({completed.length})
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", completedOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-48 mt-2">
                <div className="space-y-1.5">
                  {completed.slice(0, 10).map((suggestion) => (
                    <CompletedItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      onClick={() => onSuggestionClick(suggestion)}
                    />
                  ))}
                  {completed.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{completed.length - 10} more
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  )
}

// Compact completed item
function CompletedItem({ suggestion, onClick }: { suggestion: Suggestion; onClick: () => void }) {
  const isDismissed = suggestion.status === "dismissed"
  const title = suggestion.content.split(/[.!?]/)[0]?.trim().slice(0, 40) || suggestion.content.slice(0, 40)

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
        "hover:bg-muted/50",
        isDismissed ? "text-muted-foreground/70 line-through" : "text-muted-foreground"
      )}
    >
      <span className="flex items-center gap-1.5">
        {isDismissed ? <X className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3 text-success" />}
        <span className="truncate">{title}</span>
      </span>
    </button>
  )
}
