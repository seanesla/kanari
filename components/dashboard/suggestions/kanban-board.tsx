"use client"

import { useState, useMemo } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { snapCenterToCursor } from "@dnd-kit/modifiers"
import { KanbanColumn } from "./kanban-column"
import { SuggestionCardOverlay } from "./suggestion-card"
import type { Suggestion, KanbanColumn as KanbanColumnType, SuggestionStatus } from "@/lib/types"

// Map status to column
const statusToColumn: Record<SuggestionStatus, KanbanColumnType> = {
  pending: "pending",
  scheduled: "scheduled",
  accepted: "completed",
  dismissed: "completed",
  completed: "completed",
}

// Map column to default status
const columnToStatus: Record<KanbanColumnType, SuggestionStatus> = {
  pending: "pending",
  scheduled: "scheduled",
  completed: "accepted",
}

interface KanbanBoardProps {
  suggestions: Suggestion[]
  onCardClick: (suggestion: Suggestion) => void
  onMoveCard: (suggestionId: string, newStatus: SuggestionStatus) => void
  onScheduleRequest?: (suggestion: Suggestion) => void
}

export function KanbanBoard({
  suggestions,
  onCardClick,
  onMoveCard,
  onScheduleRequest,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Group suggestions by column
  const columns = useMemo(() => {
    const grouped: Record<KanbanColumnType, Suggestion[]> = {
      pending: [],
      scheduled: [],
      completed: [],
    }

    suggestions.forEach((suggestion) => {
      const column = statusToColumn[suggestion.status]
      grouped[column].push(suggestion)
    })

    // Sort each column by createdAt (newest first for pending, oldest first for others)
    grouped.pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    grouped.scheduled.sort((a, b) => {
      // Sort by scheduledFor if available
      if (a.scheduledFor && b.scheduledFor) {
        return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
    grouped.completed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return grouped
  }, [suggestions])

  // Find active suggestion for overlay
  const activeSuggestion = useMemo(() => {
    if (!activeId) return null
    return suggestions.find((s) => s.id === activeId) ?? null
  }, [activeId, suggestions])

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const suggestionId = active.id as string
    const suggestion = suggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return

    // Determine target column
    let targetColumn: KanbanColumnType | null = null

    // Check if dropped on a column
    if (over.data.current?.column) {
      targetColumn = over.data.current.column as KanbanColumnType
    } else {
      // Dropped on another card - find its column
      const overSuggestion = suggestions.find((s) => s.id === over.id)
      if (overSuggestion) {
        targetColumn = statusToColumn[overSuggestion.status]
      }
    }

    if (!targetColumn) return

    // Get current column
    const currentColumn = statusToColumn[suggestion.status]
    if (currentColumn === targetColumn) return

    // Handle scheduling request
    if (targetColumn === "scheduled" && onScheduleRequest) {
      onScheduleRequest(suggestion)
      return
    }

    // Update status
    const newStatus = columnToStatus[targetColumn]
    onMoveCard(suggestionId, newStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
        <KanbanColumn
          column="pending"
          suggestions={columns.pending}
          onCardClick={onCardClick}
        />
        <KanbanColumn
          column="scheduled"
          suggestions={columns.scheduled}
          onCardClick={onCardClick}
        />
        <KanbanColumn
          column="completed"
          suggestions={columns.completed}
          onCardClick={onCardClick}
        />
      </div>

      <DragOverlay modifiers={[snapCenterToCursor]}>
        {activeSuggestion && <SuggestionCardOverlay suggestion={activeSuggestion} />}
      </DragOverlay>
    </DndContext>
  )
}
