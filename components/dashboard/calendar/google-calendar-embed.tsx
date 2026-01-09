"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Calendar, ExternalLink, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface GoogleCalendarEmbedProps {
  isConnected: boolean
  isLoading?: boolean
  onConnect?: () => void
  error?: string | null
  className?: string
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Google Calendar connection was denied or cancelled.",
  invalid_callback: "Invalid OAuth callback. Please try again.",
  state_mismatch: "Security validation failed. Please try connecting again.",
  missing_verifier: "OAuth verification failed. Please try again.",
  token_exchange_failed: "Failed to complete authentication. Please try again.",
}

export function GoogleCalendarEmbed({
  isConnected,
  isLoading = false,
  onConnect,
  error: propError,
  className,
}: GoogleCalendarEmbedProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const searchParams = useSearchParams()

  // Check for OAuth error in URL params
  const urlError = searchParams.get("error")
  const displayError = propError || (urlError ? ERROR_MESSAGES[urlError] || urlError : null)

  // Clear error from URL after displaying
  useEffect(() => {
    if (urlError) {
      const url = new URL(window.location.href)
      url.searchParams.delete("error")
      window.history.replaceState({}, "", url.toString())
    }
  }, [urlError])

  useEffect(() => {
    setIframeLoaded(false)
  }, [isConnected])

  const embedUrl = useMemo(() => {
    const url = new URL("https://calendar.google.com/calendar/embed")
    url.searchParams.set("src", "primary")
    url.searchParams.set("mode", "WEEK")
    url.searchParams.set("showTitle", "0")
    url.searchParams.set("showNav", "1")
    url.searchParams.set("showPrint", "0")
    url.searchParams.set("showTabs", "0")
    url.searchParams.set("showCalendars", "0")
    url.searchParams.set("showTz", "1")
    url.searchParams.set("bgcolor", "#0b0b0b")
    return url.toString()
  }, [])

  if (isLoading) {
    return (
      <div className={cn("h-full w-full p-4", className)} aria-busy="true" aria-label="Loading calendar">
        <Skeleton className="h-full w-full rounded-md" />
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className={cn("h-full w-full flex items-center justify-center p-8", className)}>
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Calendar className="h-6 w-6 text-accent" />
          </div>
          <h3 className="text-sm font-medium mb-2">Connect Google Calendar to view your schedule</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Kanari embeds your real Google Calendar so timezone and existing events are always accurate.
          </p>
          {displayError && (
            <div className="flex items-center justify-center gap-2 mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{displayError}</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-2">
            {onConnect && (
              <Button onClick={onConnect} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Connect
              </Button>
            )}
            <Button asChild variant="outline">
              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Open Google Calendar in a new tab"
              >
                Open Calendar
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4">
            If the embed looks empty, make sure you're signed into Google in this browser.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("h-full w-full relative", className)}>
      {!iframeLoaded && (
        <div className="absolute inset-0 p-4" aria-busy="true" aria-label="Loading calendar">
          <Skeleton className="h-full w-full rounded-md" />
        </div>
      )}
      <iframe
        title="Google Calendar"
        src={embedUrl}
        className="h-full w-full"
        style={{ border: 0 }}
        loading="lazy"
        onLoad={() => setIframeLoaded(true)}
      />
    </div>
  )
}

