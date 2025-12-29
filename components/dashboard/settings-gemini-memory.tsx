"use client"

import { useState } from "react"
import { Brain, ChevronDown, ChevronUp, Info, CheckCircle2, XCircle, Clock } from "lucide-react"
import { useSuggestionMemory } from "@/hooks/use-suggestion-memory"
import { cn } from "@/lib/utils"
import type { SuggestionCategory } from "@/lib/types"

const categoryLabels: Record<SuggestionCategory, string> = {
  break: "Break",
  exercise: "Exercise",
  mindfulness: "Mindfulness",
  social: "Social",
  rest: "Rest",
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, icon, count, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 py-3 border-t border-border/50 bg-secondary/10">
          {children}
        </div>
      )}
    </div>
  )
}

export function GeminiMemorySection() {
  const { memoryContext } = useSuggestionMemory()

  const hasAnyData =
    memoryContext.completed.length > 0 ||
    memoryContext.dismissed.length > 0 ||
    memoryContext.scheduled.length > 0

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">Gemini Memory</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        This is what Gemini knows about your preferences and history. This context is sent when generating suggestions to provide personalized recommendations.
      </p>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-center">
          <p className="text-2xl font-semibold text-accent">{memoryContext.stats.totalCompleted}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-center">
          <p className="text-2xl font-semibold text-muted-foreground">{memoryContext.stats.totalDismissed}</p>
          <p className="text-xs text-muted-foreground">Dismissed</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-center">
          <p className="text-2xl font-semibold text-foreground">
            {memoryContext.stats.averageCompletionRate}%
          </p>
          <p className="text-xs text-muted-foreground">Completion Rate</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-center">
          <p className="text-lg font-medium text-foreground truncate">
            {memoryContext.stats.mostUsedCategory
              ? categoryLabels[memoryContext.stats.mostUsedCategory]
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Top Category</p>
        </div>
      </div>

      {/* Collapsible Sections */}
      {hasAnyData ? (
        <div className="space-y-3">
          <CollapsibleSection
            title="Recently Completed"
            icon={<CheckCircle2 className="h-4 w-4 text-success" />}
            count={memoryContext.completed.length}
            defaultOpen={memoryContext.completed.length > 0}
          >
            {memoryContext.completed.length > 0 ? (
              <ul className="space-y-2">
                {memoryContext.completed.map((item, index) => (
                  <li key={index} className="text-sm">
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mr-2">
                      {categoryLabels[item.category]}
                    </span>
                    <span className="text-foreground/80">{item.content}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No completed suggestions yet</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Recently Dismissed"
            icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
            count={memoryContext.dismissed.length}
          >
            {memoryContext.dismissed.length > 0 ? (
              <ul className="space-y-2">
                {memoryContext.dismissed.map((item, index) => (
                  <li key={index} className="text-sm">
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mr-2">
                      {categoryLabels[item.category]}
                    </span>
                    <span className="text-foreground/60 line-through">{item.content}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No dismissed suggestions</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Scheduled"
            icon={<Clock className="h-4 w-4 text-blue-400" />}
            count={memoryContext.scheduled.length}
          >
            {memoryContext.scheduled.length > 0 ? (
              <ul className="space-y-2">
                {memoryContext.scheduled.map((item, index) => (
                  <li key={index} className="text-sm">
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mr-2">
                      {categoryLabels[item.category]}
                    </span>
                    <span className="text-foreground/80">{item.content}</span>
                    {item.scheduledFor && (
                      <span className="text-xs text-blue-400 ml-2">
                        {new Date(item.scheduledFor).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No scheduled suggestions</p>
            )}
          </CollapsibleSection>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 bg-secondary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No suggestion history yet. Start by generating and acting on suggestions to build your memory context.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How this data is used</p>
            <ul className="space-y-1">
              <li>• Gemini learns which suggestion categories you prefer</li>
              <li>• Dismissal patterns help avoid unwanted suggestion types</li>
              <li>• Completion history personalizes future recommendations</li>
              <li>• Data is stored locally and never shared without your consent</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
