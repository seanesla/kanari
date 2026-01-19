"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, ChevronUp, Info, CheckCircle2, XCircle, Clock } from "@/lib/icons"
import { useSuggestionMemory } from "@/hooks/use-suggestion-memory"
import { cn } from "@/lib/utils"
import { useTimeZone } from "@/lib/timezone-context"
import type { CategoryPreference, GeminiMemoryContext, SuggestionCategory } from "@/lib/types"

const categoryLabels: Record<SuggestionCategory, string> = {
  break: "Break",
  exercise: "Exercise",
  mindfulness: "Mindfulness",
  social: "Social",
  rest: "Rest",
}

const CATEGORY_ORDER: SuggestionCategory[] = [
  "mindfulness",
  "rest",
  "break",
  "social",
  "exercise",
]

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, icon, count, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentId = `collapsible-${title.toLowerCase().replace(/\s+/g, "-")}`

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm font-sans">{title}</span>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full font-sans">
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
        <div id={contentId} className="px-4 py-3 border-t border-border/50 bg-secondary/10">
          {children}
        </div>
      )}
    </div>
  )
}

function formatGeminiMemoryContextForDisplay(memoryContext: GeminiMemoryContext): string {
  const lines: string[] = []

  lines.push("USER ACTION HISTORY:")

  if (memoryContext.completed.length > 0) {
    lines.push(`Recently Completed (${memoryContext.stats.totalCompleted} total):`)
    lines.push(
      ...memoryContext.completed.slice(0, 5).map((c) => `- [${c.category}] ${c.content}`)
    )
  }

  if (memoryContext.dismissed.length > 0) {
    lines.push(`Recently Dismissed (${memoryContext.stats.totalDismissed} total):`)
    lines.push(
      ...memoryContext.dismissed.slice(0, 5).map((d) => `- [${d.category}] ${d.content}`)
    )
  }

  const categoryStatsEntries = Object.entries(memoryContext.stats.categoryStats)
  const hasCategoryPreferenceData = categoryStatsEntries.some(([, stats]) => stats.total > 0)

  if (hasCategoryPreferenceData) {
    const sortedCategoryStats = categoryStatsEntries
      .slice()
      .sort((a, b) => b[1].completionRate - a[1].completionRate)

    lines.push("")
    lines.push("CATEGORY PREFERENCES:")
    lines.push("| Category | Completed | Dismissed | Rate | Preference |")
    lines.push("|----------|-----------|-----------|------|------------|")
    lines.push(
      ...sortedCategoryStats.map(
        ([category, stats]) =>
          `| ${category} | ${stats.completed} | ${stats.dismissed} | ${stats.completionRate}% | ${stats.preference.toUpperCase()} |`
      )
    )

    const prioritized = memoryContext.stats.preferredCategories
    const avoided = memoryContext.stats.avoidedCategories

    lines.push("")
    lines.push("CATEGORY RULES (MUST FOLLOW):")
    lines.push(
      `- PRIORITIZE categories with >60% completion rate: [${prioritized.length > 0 ? prioritized.join(", ") : "none"}]`
    )
    lines.push(
      `- AVOID categories with >50% dismissal rate: [${avoided.length > 0 ? avoided.join(", ") : "none"}]`
    )
    lines.push(
      "- When adding 2-3 NEW suggestions, at least 2 MUST be from prioritized categories (when any exist)"
    )
    lines.push(
      "- Do NOT add NEW suggestions from avoided categories unless explicitly requested by the user"
    )
  }

  const effectivenessEntries = Object.entries(memoryContext.stats.effectivenessByCategory)
  const hasEffectivenessFeedback = effectivenessEntries.some(([, stats]) => stats.totalRatings > 0)

  if (hasEffectivenessFeedback) {
    const sortedEffectiveness = effectivenessEntries
      .filter(([, stats]) => stats.totalRatings > 0)
      .sort((a, b) => b[1].helpfulRate - a[1].helpfulRate)

    lines.push("")
    lines.push("EFFECTIVENESS FEEDBACK:")
    lines.push(
      ...sortedEffectiveness.map(
        ([category, stats]) =>
          `- ${category}: ${stats.helpfulRate}% rated helpful (${stats.totalRatings} ratings)`
      )
    )
  }

  if (memoryContext.stats.averageCompletionRate > 0) {
    lines.push("")
    lines.push(`Overall Completion Rate: ${memoryContext.stats.averageCompletionRate}%`)
  }

  return lines.join("\n")
}

export function GeminiMemorySection() {
  const { timeZone } = useTimeZone()
  const { memoryContext } = useSuggestionMemory()
  const [showRawContext, setShowRawContext] = useState(false)

  const hasAnyData =
    memoryContext.completed.length > 0 ||
    memoryContext.dismissed.length > 0 ||
    memoryContext.scheduled.length > 0

  const preferredCategories = memoryContext.stats.preferredCategories
  const avoidedCategories = memoryContext.stats.avoidedCategories

  const preferredSummary =
    preferredCategories.length > 0
      ? preferredCategories
        .map(
          (category) =>
            `${categoryLabels[category]} (${memoryContext.stats.categoryStats[category].completionRate}%)`
        )
        .join(", ")
      : "None yet"

  const avoidedSummary =
    avoidedCategories.length > 0
      ? avoidedCategories
        .map((category) => {
          const stats = memoryContext.stats.categoryStats[category]
          return `${categoryLabels[category]} (${stats.completionRate}% • dismissed ${stats.dismissed}x)`
        })
        .join(", ")
      : "None"

  const topRatedCategories = Object.entries(memoryContext.stats.effectivenessByCategory)
    .filter(([, stats]) => stats.totalRatings > 0)
    .sort((a, b) => b[1].helpfulRate - a[1].helpfulRate)
    .slice(0, 2)

  const preferenceBadge = (preference: CategoryPreference) =>
    cn(
      "text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full font-sans",
      preference === "high" && "bg-green-500/10 text-green-500",
      preference === "medium" && "bg-secondary text-muted-foreground",
      preference === "low" && "bg-secondary/60 text-muted-foreground",
      preference === "avoid" && "bg-red-500/10 text-red-500"
    )

  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40">
      <div className="flex items-center gap-2 mb-6">
        <Image src="/gemini-logo.svg" alt="Gemini" width={20} height={20} />
        <h2 className="text-lg font-semibold font-serif">Gemini Memory</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6 font-sans">
        This is what Gemini knows about your preferences and history. This context is sent when generating suggestions to provide personalized recommendations.
      </p>

      {/* What Gemini Sees */}
      <div className="rounded-lg border border-border/60 bg-secondary/10 p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold font-sans">🧠 What Gemini Sees</span>
          </div>
          <button
            type="button"
            onClick={() => setShowRawContext((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-sans flex items-center gap-1"
            aria-expanded={showRawContext}
          >
            {showRawContext ? (
              <>
                Hide raw context <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show raw context <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        <div className="mt-3 text-sm text-muted-foreground font-sans">
          <p className="mb-3">Based on your history, Gemini will:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <span className="text-foreground font-medium">Prioritize:</span>{" "}
                <span>{preferredSummary}</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <div>
                <span className="text-foreground font-medium">Avoid:</span>{" "}
                <span>{avoidedSummary}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-foreground font-medium mb-2">Derived rules:</p>
            <ul className="space-y-1">
              {preferredCategories.length > 0 ? (
                <li>• Gemini will generate at least 2 suggestions from your prioritized categories</li>
              ) : (
                <li>• Gemini will balance categories until stronger preferences emerge</li>
              )}
              {avoidedCategories.length > 0 && (
                <li>• Gemini will avoid generating new suggestions from avoided categories unless you ask</li>
              )}
              {topRatedCategories.length > 0 && (
                <li>• Gemini will lean toward suggestion types you rated as helpful</li>
              )}
            </ul>
          </div>

          {topRatedCategories.length > 0 && (
            <div className="mt-4">
              <p className="text-foreground font-medium mb-2">Your top-rated suggestion types:</p>
              <ul className="space-y-1">
                {topRatedCategories.map(([category, stats]) => (
                  <li key={category}>
                    • {categoryLabels[category as SuggestionCategory]} ({stats.helpfulRate}% helpful, {stats.totalRatings} ratings)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {showRawContext && (
          <pre className="mt-4 text-xs text-muted-foreground bg-background/40 border border-border/50 rounded-md p-3 overflow-auto whitespace-pre-wrap font-mono">
            {formatGeminiMemoryContextForDisplay(memoryContext)}
          </pre>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-center">
          <p className="text-2xl font-semibold text-accent font-sans">{memoryContext.stats.totalCompleted}</p>
          <p className="text-xs text-muted-foreground font-sans">Completed</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-center">
          <p className="text-2xl font-semibold text-muted-foreground font-sans">{memoryContext.stats.totalDismissed}</p>
          <p className="text-xs text-muted-foreground font-sans">Dismissed</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-center">
          <p className="text-2xl font-semibold text-foreground font-sans">
            {memoryContext.stats.averageCompletionRate}%
          </p>
          <p className="text-xs text-muted-foreground font-sans">Completion Rate</p>
        </div>
      </div>

      {/* Category Preferences */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold font-sans">Category Preferences</h3>
          <span className="text-xs text-muted-foreground font-sans">Completed vs dismissed</span>
        </div>

        <div className="space-y-2">
          {CATEGORY_ORDER.map((category) => {
            const stats = memoryContext.stats.categoryStats[category]
            const percent = stats.completionRate

            const barColor = cn(
              stats.preference === "high" && "bg-green-500",
              stats.preference === "medium" && "bg-accent",
              stats.preference === "low" && "bg-muted-foreground",
              stats.preference === "avoid" && "bg-red-500"
            )

            return (
              <div key={category} className="grid grid-cols-[84px_1fr_84px] items-center gap-3">
                <div className="text-xs text-muted-foreground font-sans">{categoryLabels[category]}</div>
                <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", barColor)}
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    aria-label={`${categoryLabels[category]} completion rate ${percent}%`}
                  />
                </div>
                <div className="text-right">
                  <span className="text-xs text-foreground font-sans tabular-nums">{percent}%</span>{" "}
                  <span className={preferenceBadge(stats.preference)}>
                    {stats.preference.toUpperCase()}
                  </span>
                </div>
              </div>
            )
          })}
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
                  <li key={index} className="text-sm font-sans">
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mr-2 font-sans">
                      {categoryLabels[item.category]}
                    </span>
                    <span className="text-foreground/80 font-sans">{item.content}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground font-sans">No completed suggestions yet</p>
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
                  <li key={index} className="text-sm font-sans">
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mr-2 font-sans">
                      {categoryLabels[item.category]}
                    </span>
                    <span className="text-foreground/60 line-through font-sans">{item.content}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground font-sans">No dismissed suggestions</p>
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
                  <li key={index} className="text-sm font-sans">
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mr-2 font-sans">
                      {categoryLabels[item.category]}
                    </span>
                    <span className="text-foreground/80 font-sans">{item.content}</span>
                    {item.scheduledFor && (
                      <span className="text-xs text-blue-400 ml-2 font-sans">
                        {new Date(item.scheduledFor).toLocaleDateString("en-US", { timeZone })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground font-sans">No scheduled suggestions</p>
            )}
          </CollapsibleSection>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 bg-secondary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground font-sans">
            No suggestion history yet. Start by generating and acting on suggestions to build your memory context.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground font-sans">
            <p className="font-medium text-foreground mb-1 font-sans">How this data is used</p>
            <ul className="space-y-1">
              <li>• Category completion vs dismissal shapes what Gemini prioritizes</li>
              <li>• Avoided categories are excluded from new suggestions unless you ask</li>
              <li>• Helpfulness ratings steer Gemini toward what actually worked</li>
              <li>• Data is stored locally and never shared without your consent</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
