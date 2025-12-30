"use client"

import { Link } from "next-view-transitions"
import { Calendar as CalendarIcon, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import type { ReactNode } from "react"

interface DashboardLayoutProps {
  isMobile: boolean
  isSidebarSheetOpen: boolean
  setIsSidebarSheetOpen: (open: boolean) => void
  sidebar: ReactNode
  calendar: ReactNode
  pendingCount: number
  showEmptyState: boolean
}

/**
 * Responsive dashboard layout handling mobile sheet vs. desktop grid
 */
export function DashboardLayout({
  isMobile,
  isSidebarSheetOpen,
  setIsSidebarSheetOpen,
  sidebar,
  calendar,
  pendingCount,
  showEmptyState,
}: DashboardLayoutProps) {
  const emptyStateContent = showEmptyState && (
    <div className="mt-8 text-center">
      <p className="text-muted-foreground mb-4">
        No suggestions yet. Record a voice check-in to get personalized recovery recommendations.
      </p>
      <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
        <Link href="/dashboard/history?newRecording=true">
          Record Now
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Calendar */}
        <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl overflow-hidden">
          {calendar}
        </div>

        {/* Mobile sidebar sheet trigger */}
        <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Manage Suggestions ({pendingCount} pending)
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh]">
            <div className="h-full pt-4">{sidebar}</div>
          </SheetContent>
        </Sheet>

        {emptyStateContent}
      </div>
    )
  }

  // Desktop: Sidebar + Calendar grid
  return (
    <>
      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Sidebar */}
        <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-4 h-[calc(100vh-180px)] overflow-hidden">
          {sidebar}
        </div>

        {/* Calendar */}
        <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl overflow-hidden">
          {calendar}
        </div>
      </div>

      {emptyStateContent}
    </>
  )
}
