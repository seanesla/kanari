"use client"

import { useMemo, useEffect, useState } from "react"
import Image from "next/image"
import { RefreshCw, ArrowRight } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Deck } from "@/components/dashboard/deck"
import { db } from "@/lib/storage/db"
import { patchSettings } from "@/lib/settings/patch-settings"
import { updateCalibrationFromSelfReportSubmission } from "@/lib/ml/personalized-biomarkers"
import type { CheckInSession, CheckInSynthesis } from "@/lib/types"
import { VoiceBiomarkerReport } from "@/components/check-in/voice-biomarker-report"
import { formatDate } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"

interface SynthesisScreenProps {
  session: CheckInSession | null
  synthesis: CheckInSynthesis | null
  isLoading: boolean
  error?: string | null
  onRetry?: () => void
  onViewDashboard?: () => void
  onDone?: () => void
  className?: string
}

export function SynthesisScreen({
  session,
  synthesis,
  isLoading,
  error,
  onRetry,
  onViewDashboard,
  onDone,
  className,
}: SynthesisScreenProps) {
  const { timeZone } = useTimeZone()

  const [selfStress, setSelfStress] = useState<number>(50)
  const [selfFatigue, setSelfFatigue] = useState<number>(50)
  const [selfSavedAt, setSelfSavedAt] = useState<string | null>(null)
  const [selfSaveError, setSelfSaveError] = useState<string | null>(null)
  const [isSavingSelfReport, setIsSavingSelfReport] = useState(false)

  useEffect(() => {
    if (!session) return
    const saved = session.selfReport
    if (saved) {
      setSelfStress(saved.stressScore)
      setSelfFatigue(saved.fatigueScore)
      setSelfSavedAt(saved.reportedAt)
      setSelfSaveError(null)
      return
    }

    // Keep defaults, but clear any previous success/error when switching sessions.
    setSelfSavedAt(null)
    setSelfSaveError(null)
  }, [session?.id])
  const insightTitleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const insight of synthesis?.insights ?? []) {
      map.set(insight.id, insight.title)
    }
    return map
  }, [synthesis])

  const canSaveSelfReport = Boolean(session?.id) && !isSavingSelfReport

  const handleSaveSelfReport = useMemo(() => {
    return async () => {
      if (!session?.id) return

      setIsSavingSelfReport(true)
      setSelfSaveError(null)
      try {
        const now = new Date().toISOString()
        const payload = {
          stressScore: Math.round(selfStress),
          fatigueScore: Math.round(selfFatigue),
          reportedAt: now,
        }

        const updated = await db.checkInSessions.update(session.id, { selfReport: payload })
        if (updated === 0) {
          throw new Error("This check-in wasn't saved, so the rating can't be stored.")
        }

        // Update per-user calibration so future scores become more accurate.
        const metrics = session.acousticMetrics
        if (metrics) {
          const acousticStressScore = metrics.acousticStressScore ?? metrics.stressScore
          const acousticFatigueScore = metrics.acousticFatigueScore ?? metrics.fatigueScore
          const settings = await db.settings.get("default")

          const nextCalibration = updateCalibrationFromSelfReportSubmission({
            acousticStressScore,
            acousticFatigueScore,
            selfReportStressScore: payload.stressScore,
            selfReportFatigueScore: payload.fatigueScore,
            calibration: settings?.voiceBiomarkerCalibration ?? null,
            now,
          })

            await patchSettings({
              voiceBiomarkerCalibration: nextCalibration,
            })
          }

        setSelfSavedAt(now)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save rating"
        setSelfSaveError(message)
      } finally {
        setIsSavingSelfReport(false)
      }
    }
  }, [session?.id, session?.acousticMetrics, selfStress, selfFatigue, isSavingSelfReport])

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center">
                  <Image src="/gemini-logo.svg" alt="Gemini" width={20} height={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-tight">Check-in synthesis</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      Generated by Gemini 3{session?.endedAt ? ` • ${formatDate(session.endedAt, timeZone)}` : ""}
                      <Image src="/gemini-logo.svg" alt="Gemini" width={14} height={14} />
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {synthesis?.meta?.input ? (
              <Badge variant="secondary" className="shrink-0">
                {synthesis.meta.input.messagesUsed}/{synthesis.meta.input.messagesTotal} msgs
                {synthesis.meta.input.truncated ? " • trimmed" : ""}
              </Badge>
            ) : null}
          </div>

          {/* Voice biomarker report (judge-friendly proof + explainability) */}
          {session ? (
            <Deck className="p-4">
              <VoiceBiomarkerReport
                metrics={session.acousticMetrics}
                state="final"
                title="Voice biomarkers (this check-in)"
              />
            </Deck>
          ) : null}

          {/* Self report (improves personalization) */}
          {session ? (
            <Deck className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Quick self-check (improves accuracy)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This helps Kanari tune your personal baseline over time.
                  </p>
                </div>
                {selfSavedAt ? (
                  <span className="text-[11px] text-muted-foreground">Saved</span>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>How stressed do you feel?</span>
                    <span className="tabular-nums">{Math.round(selfStress)}</span>
                  </div>
                  <Slider
                    value={[selfStress]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => setSelfStress(v[0] ?? 0)}
                    aria-label="Self reported stress"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>How tired do you feel?</span>
                    <span className="tabular-nums">{Math.round(selfFatigue)}</span>
                  </div>
                  <Slider
                    value={[selfFatigue]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => setSelfFatigue(v[0] ?? 0)}
                    aria-label="Self reported fatigue"
                  />
                </div>

                {selfSaveError ? <p className="text-xs text-destructive">{selfSaveError}</p> : null}

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => void handleSaveSelfReport()}
                    disabled={!canSaveSelfReport}
                  >
                    {isSavingSelfReport ? "Saving..." : selfSavedAt ? "Update" : "Save"}
                  </Button>
                </div>
              </div>
            </Deck>
          ) : null}

          {/* Loading */}
          {isLoading && (
            <Deck className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-muted/40 p-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Synthesizing your check-in...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Kanari is asking Gemini 3 to connect your conversation, journal, and voice patterns into a clear "why".
                  </p>
                </div>
              </div>
            </Deck>
          )}

          {/* Error */}
          {!isLoading && error && (
            <Deck className="p-4">
              <div>
                <p className="text-sm font-semibold">Synthesis unavailable</p>
                <p className="text-sm text-muted-foreground mt-1 break-words">{error}</p>
              </div>
              <div className="mt-4 flex gap-2">
                {onRetry ? (
                  <Button variant="outline" onClick={onRetry}>
                    Retry
                  </Button>
                ) : null}
                {onDone ? <Button onClick={onDone}>Done</Button> : null}
              </div>
            </Deck>
          )}

          {/* Synthesis content */}
          {!isLoading && !error && synthesis && (
            <>
              <Deck className="p-4">
                <p className="text-sm font-semibold">Narrative</p>
                <p className="text-sm text-muted-foreground mt-2">{synthesis.narrative}</p>
              </Deck>

              <div className="space-y-3">
                <p className="text-sm font-medium">Key insights (with evidence)</p>
                {synthesis.insights.map((insight) => (
                  <Deck key={insight.id} className="p-4">
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>

                    <div className="mt-4 space-y-3">
                      {insight.evidence.quotes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Quotes</p>
                          <div className="space-y-2">
                            {insight.evidence.quotes.map((q, idx) => (
                              <blockquote
                                key={`${insight.id}-q-${idx}`}
                                className="border-l-2 border-border pl-3 text-sm text-muted-foreground"
                              >
                                <span className="font-medium capitalize text-foreground/80">{q.role}:</span>{" "}
                                “{q.text}”
                              </blockquote>
                            ))}
                          </div>
                        </div>
                      )}

                      {(insight.evidence.voice.length > 0 || insight.evidence.journal.length > 0) && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {insight.evidence.voice.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Voice patterns</p>
                              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                                {insight.evidence.voice.map((v, idx) => (
                                  <li key={`${insight.id}-v-${idx}`}>{v}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {insight.evidence.journal.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Journal</p>
                              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                                {insight.evidence.journal.map((j, idx) => (
                                  <li key={`${insight.id}-j-${idx}`}>{j}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Deck>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Targeted suggestions (with “why”)</p>
                {synthesis.suggestions.map((suggestion) => (
                  <Deck key={suggestion.id} className="p-4">
                    <p className="text-sm font-semibold leading-snug">{suggestion.content}</p>
                    <p className="text-sm text-muted-foreground mt-1">{suggestion.rationale}</p>
                    {suggestion.linkedInsightIds.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Linked insights</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.linkedInsightIds.map((id) => (
                            <Badge key={`${suggestion.id}-${id}`} variant="secondary">
                              {insightTitleById.get(id) ?? "Insight"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </Deck>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t border-border/70 bg-background/60 px-6 py-4">
        <div className="mx-auto w-full max-w-2xl flex items-center justify-between gap-2">
          {onDone ? (
            <Button variant="outline" onClick={onDone}>
              Done
            </Button>
          ) : (
            <span />
          )}
          {onViewDashboard ? (
            <Button onClick={onViewDashboard} className="gap-2">
              Go to Overview
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
