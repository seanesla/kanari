"use client"

import Link from "next/link"
import { NotebookPen, ArrowRight } from "@/lib/icons"
import { useJournalEntries } from "@/hooks/use-storage"
import { formatDate } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface JournalEntriesPanelProps {
  limit?: number
  className?: string
}

export function JournalEntriesPanel({ limit = 5, className }: JournalEntriesPanelProps) {
  const { timeZone } = useTimeZone()
  const entries = useJournalEntries(limit)

  return (
    <Card className={cn("border-border/70 bg-card/30 backdrop-blur-xl", className)}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-accent" />
          Journal entries
        </CardTitle>
        <CardDescription>
          Reflections captured during your check-ins.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entries yet. Start a check-in and try a journal prompt.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border/50 bg-background/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt, timeZone)}</p>
                    <p className="text-sm font-medium mt-1 line-clamp-2">{entry.prompt}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {entry.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-4">
                  {entry.content}
                </p>

                {entry.checkInSessionId ? (
                  <Button asChild variant="ghost" size="sm" className="mt-2 w-full justify-between">
                    <Link href={`/dashboard/history?highlight=${entry.checkInSessionId}`}>
                      View related check-in
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
