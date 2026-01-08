"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Inbox, Calendar, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SuggestionCard } from "./suggestion-card"
import type { Suggestion, KanbanColumn as KanbanColumnType } from "@/lib/types"

type KanbanColumnVariant = "full" | "compact"

const columnConfig: Record<KanbanColumnType, {
  title: string
  icon: typeof Inbox
  emptyText: string
  emptySubtext: string
}> = {
  pending: {
    title: "Pending",
    icon: Inbox,
    emptyText: "No pending suggestions",
    emptySubtext: "New suggestions will appear here",
  },
  scheduled: {
    title: "Scheduled",
    icon: Calendar,
    emptyText: "Nothing scheduled",
    emptySubtext: "Drag suggestions here to schedule",
  },
  completed: {
    title: "Completed",
    icon: CheckCircle2,
    emptyText: "No completed items",
    emptySubtext: "Completed suggestions show here",
  },
}

interface KanbanColumnProps {
  column: KanbanColumnType
  suggestions: Suggestion[]
  onCardClick: (suggestion: Suggestion) => void
  variant?: KanbanColumnVariant
}

export function KanbanColumn({ column, suggestions, onCardClick, variant = "full" }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column,
    data: { column },
  })

  const config = columnConfig[column]
  const Icon = config.icon
  const suggestionIds = suggestions.map((s) => s.id)

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-card/20 backdrop-blur-sm h-full",
        variant === "compact" ? "min-h-0" : "min-h-[400px]",
        "transition-colors duration-200",
        isOver ? "border-accent/50 bg-card/30" : "border-border/50"
      )}
      role="region"
      aria-label={`${config.title} column with ${suggestions.length} ${suggestions.length === 1 ? "suggestion" : "suggestions"}`}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-border/50",
          variant === "compact" ? "px-3 py-2" : "p-4"
        )}
      >
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "h-4 w-4",
              column === "pending" && "text-accent",
              column === "scheduled" && "text-blue-500",
              column === "completed" && "text-green-500"
            )}
            aria-hidden="true"
          />
          <h3 className="font-medium text-sm" id={`column-heading-${column}`}>{config.title}</h3>
        </div>
        <Badge variant="secondary" className="text-xs" aria-label={`${suggestions.length} items`}>
          {suggestions.length}
        </Badge>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className={cn(
            variant === "compact" ? "p-2 min-h-[120px]" : "p-3 min-h-[200px]",
            isOver && "bg-accent/5"
          )}
          role="list"
          aria-labelledby={`column-heading-${column}`}
        >
          <SortableContext items={suggestionIds} strategy={verticalListSortingStrategy}>
            {suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onClick={() => onCardClick(suggestion)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={config.icon}
                text={config.emptyText}
                subtext={config.emptySubtext}
                variant={variant}
              />
            )}
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  text,
  subtext,
  variant,
}: {
  icon: typeof Inbox
  text: string
  subtext: string
  variant: KanbanColumnVariant
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 text-center",
        variant === "compact" ? "py-6" : "py-12"
      )}
    >
      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{subtext}</p>
    </div>
  )
}
