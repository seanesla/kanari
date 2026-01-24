"use client"

import { useState } from "react"
import { Brain, TrendingUp, AlertTriangle, Sparkles, ChevronDown, Info } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { useAnalyticsInsights } from "@/hooks/use-analytics-insights"
import type { AnalyticsTimeRange, AggregatedObservation } from "@/lib/types"
import { Deck } from "@/components/dashboard/deck"

const TIME_RANGE_LABELS: Record<AnalyticsTimeRange, string> = {
  "7_days": "7 days",
  "30_days": "30 days",
  "all_time": "All time",
}

export function AnalyticsInsightsSection() {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("7_days")
  const [isExpanded, setIsExpanded] = useState(false)
  const insights = useAnalyticsInsights(timeRange)

  const totalObservations =
    (insights?.observations.stress.length ?? 0) +
    (insights?.observations.fatigue.length ?? 0) +
    (insights?.observations.positive.length ?? 0)

  return (
    <Deck className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent" />
          <h3 className="font-semibold">AI Insights</h3>
        </div>

        <ToggleGroup
          type="single"
          value={timeRange}
          onValueChange={(v) => v && setTimeRange(v as AnalyticsTimeRange)}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="7_days" aria-label="Last 7 days">
            7d
          </ToggleGroupItem>
          <ToggleGroupItem value="30_days" aria-label="Last 30 days">
            30d
          </ToggleGroupItem>
          <ToggleGroupItem value="all_time" aria-label="All time">
            All
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Empty State */}
      {!insights && (
        <div className="text-center py-8 text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No AI analysis data in {TIME_RANGE_LABELS[timeRange].toLowerCase()}</p>
          <p className="text-xs mt-1">Complete a check-in to see insights</p>
        </div>
      )}

      {insights && (
        <>
          {/* Summary - Always visible */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{totalObservations}</span> observations across{" "}
                <span className="font-medium text-foreground">{insights.recordingCount}</span> check-ins.
                {insights.patterns.length > 0 && (
                  <> <span className="font-medium text-foreground">{insights.patterns.length}</span> patterns detected.</>
                )}
              </p>
              <CollapsibleTrigger asChild>
                <button className="text-sm text-accent hover:underline flex items-center gap-1">
                  {isExpanded ? "Hide" : "Show"} details
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
            </div>

            {/* Detailed View */}
            <CollapsibleContent className="mt-4">
              <Accordion type="multiple" className="space-y-2">
                {/* Stress Observations */}
                {insights.observations.stress.length > 0 && (
                  <AccordionItem value="stress" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span>Stress Cues</span>
                        <Badge variant="secondary" className="ml-2">
                          {insights.observations.stress.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ObservationList observations={insights.observations.stress} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Fatigue Observations */}
                {insights.observations.fatigue.length > 0 && (
                  <AccordionItem value="fatigue" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-accent" />
                        <span>Fatigue Cues</span>
                        <Badge variant="secondary" className="ml-2">
                          {insights.observations.fatigue.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ObservationList observations={insights.observations.fatigue} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Positive Observations */}
                {insights.observations.positive.length > 0 && (
                  <AccordionItem value="positive" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-green-500" />
                        <span>Positive Notes</span>
                        <Badge variant="secondary" className="ml-2">
                          {insights.observations.positive.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ObservationList observations={insights.observations.positive} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* AI Interpretations */}
                <AccordionItem value="interpretations" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-accent" />
                      <span>AI Interpretations</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Stress Analysis</p>
                        <p className="text-sm">{insights.interpretations.stressSummary}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Fatigue Analysis</p>
                        <p className="text-sm">{insights.interpretations.fatigueSummary}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Patterns */}
                {insights.patterns.length > 0 && (
                  <AccordionItem value="patterns" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-accent" />
                        <span>Detected Patterns</span>
                        <Badge variant="secondary" className="ml-2">
                          {insights.patterns.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {insights.patterns.map((pattern, i) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <span className="text-accent">•</span>
                            {pattern.description}
                            <span className="text-xs text-muted-foreground">
                              ({pattern.affectedRecordingIds.length} check-ins)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </Deck>
  )
}

function ObservationList({ observations }: { observations: AggregatedObservation[] }) {
  const [showAll, setShowAll] = useState(false)
  const displayObservations = showAll ? observations : observations.slice(0, 5)

  return (
    <div className="space-y-2">
      {displayObservations.map((obs, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <Badge
            variant={obs.relevance === "high" ? "destructive" : obs.relevance === "medium" ? "default" : "secondary"}
            className="text-xs shrink-0"
          >
            {obs.relevance}
          </Badge>
          <span className="flex-1">
            {obs.observation}
          </span>
          {obs.frequency > 1 && (
            <span className="text-xs text-muted-foreground shrink-0">x{obs.frequency}</span>
          )}
        </div>
      ))}
      {observations.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-accent hover:underline"
        >
          {showAll ? "Show less" : `Show ${observations.length - 5} more`}
        </button>
      )}
    </div>
  )
}
