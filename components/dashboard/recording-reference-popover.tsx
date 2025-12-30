"use client"

import Link from "next/link"
import { ExternalLink, ChevronDown } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date-utils"
import { useRecording } from "@/hooks/use-storage"
import type { RecordingReference } from "@/lib/types"
import { useState } from "react"

interface RecordingReferencePopoverProps {
  reference: RecordingReference
  index: number
}

export function RecordingReferencePopover({ reference, index }: RecordingReferencePopoverProps) {
  const recording = useRecording(reference.recordingId)
  const [showRawData, setShowRawData] = useState(false)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-accent hover:text-accent/80 underline text-xs font-medium ml-1">
          [{index + 1}]
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-sm">{formatDate(reference.createdAt)}</p>
            {reference.timestamp && (
              <p className="text-xs text-muted-foreground">At timestamp {reference.timestamp}</p>
            )}
          </div>

          <Link
            href={`/dashboard/history?highlight=${reference.recordingId}`}
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            Open recording
            <ExternalLink className="h-3 w-3" />
          </Link>

          {recording?.features && (
            <Collapsible open={showRawData} onOpenChange={setShowRawData}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between p-0 h-auto text-xs text-muted-foreground hover:text-foreground">
                  View raw audio features
                  <ChevronDown className={`h-3 w-3 transition-transform ${showRawData ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
{`speechRate: ${recording.features.speechRate?.toFixed(2) ?? "N/A"}
rms: ${recording.features.rms?.toFixed(3) ?? "N/A"}
spectralCentroid: ${recording.features.spectralCentroid?.toFixed(3) ?? "N/A"}
spectralFlux: ${recording.features.spectralFlux?.toFixed(3) ?? "N/A"}
zcr: ${recording.features.zcr?.toFixed(4) ?? "N/A"}
pauseRatio: ${recording.features.pauseRatio?.toFixed(2) ?? "N/A"}`}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
