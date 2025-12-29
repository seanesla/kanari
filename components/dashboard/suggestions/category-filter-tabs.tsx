"use client"

import { Coffee, Dumbbell, Brain, Users, Moon, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SuggestionCategory } from "@/lib/types"

type FilterValue = SuggestionCategory | "all"

const filterOptions: { value: FilterValue; label: string; icon: typeof Coffee }[] = [
  { value: "all", label: "All", icon: Layers },
  { value: "rest", label: "Rest", icon: Moon },
  { value: "mindfulness", label: "Mindfulness", icon: Brain },
  { value: "exercise", label: "Exercise", icon: Dumbbell },
  { value: "social", label: "Social", icon: Users },
  { value: "break", label: "Break", icon: Coffee },
]

const categoryColors: Record<FilterValue, string> = {
  all: "text-foreground",
  break: "text-amber-500",
  exercise: "text-green-500",
  mindfulness: "text-purple-500",
  social: "text-blue-500",
  rest: "text-indigo-500",
}

interface CategoryFilterTabsProps {
  value: FilterValue
  onChange: (value: FilterValue) => void
  counts?: Record<FilterValue, number>
}

export function CategoryFilterTabs({ value, onChange, counts }: CategoryFilterTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as FilterValue)}>
      <TabsList className="h-auto p-1 bg-card/30 backdrop-blur-sm border border-border/50 flex-wrap">
        {filterOptions.map((option) => {
          const Icon = option.icon
          const count = counts?.[option.value]
          const isActive = value === option.value

          return (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
                "data-[state=active]:bg-card/80 data-[state=active]:backdrop-blur-sm",
                "transition-colors",
                isActive && categoryColors[option.value]
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{option.label}</span>
              {count !== undefined && count > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px] leading-none",
                  isActive ? "bg-accent/20" : "bg-muted/50"
                )}>
                  {count}
                </span>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

// Helper to filter suggestions by category
export function filterSuggestionsByCategory<T extends { category: SuggestionCategory }>(
  suggestions: T[],
  filter: FilterValue
): T[] {
  if (filter === "all") return suggestions
  return suggestions.filter((s) => s.category === filter)
}

// Helper to count suggestions by category
export function countSuggestionsByCategory<T extends { category: SuggestionCategory }>(
  suggestions: T[]
): Record<FilterValue, number> {
  const counts: Record<FilterValue, number> = {
    all: suggestions.length,
    break: 0,
    exercise: 0,
    mindfulness: 0,
    social: 0,
    rest: 0,
  }

  suggestions.forEach((s) => {
    counts[s.category]++
  })

  return counts
}

export type { FilterValue }
