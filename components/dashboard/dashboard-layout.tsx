"use client"

import Link from "next/link"
import { ArrowRight } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import type { ReactNode } from "react"

interface DashboardLayoutProps {
  isMobile: boolean
  kanban: ReactNode
  calendar: ReactNode
  showEmptyState: boolean
}

/**
 * Responsive dashboard layout handling mobile sheet vs. desktop grid
 */
export function DashboardLayout({
  isMobile,
  kanban,
  calendar,
  showEmptyState,
}: DashboardLayoutProps) {
  const emptyStateContent = showEmptyState && (
    <div className="mt-8 text-center">
      <p className="text-muted-foreground mb-4">
        No suggestions yet. Start a check-in to get personalized recovery recommendations.
      </p>
      <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
        <Link href="/dashboard/history?newCheckIn=true">
          Check in now
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Kanban */}
        <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-4 h-[260px] overflow-hidden">
          {kanban}
        </div>

        {/* Calendar */}
        <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl overflow-hidden h-[70vh]">
          {calendar}
        </div>

        {emptyStateContent}
      </div>
    )
  }

  // Desktop: Kanban (fixed height) + Calendar (remaining height)
  return (
    <>
      <div className="flex flex-col gap-6 h-[calc(100vh-180px)]">
        {/* Kanban */}
        <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-4 h-[200px] overflow-hidden">
          {kanban}
        </div>

        {/* Calendar */}
        <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl overflow-hidden flex-1">
          {calendar}
        </div>
      </div>

      {emptyStateContent}
    </>
  )
}
