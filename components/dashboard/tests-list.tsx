import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { mockTests } from "@/lib/data/mock-tests"
import { StatusIndicator, statusConfig } from "@/components/ui/status-indicator"
import type { TestStatus } from "@/lib/types"

export function TestsList() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-semibold">Recent Tests</h2>
        <Link href="/dashboard/tests" className="text-sm text-accent hover:underline">
          View all
        </Link>
      </div>

      <div className="divide-y divide-border">
        {mockTests.map((test) => {
          const config = statusConfig[test.status]

          return (
            <Link
              key={test.id}
              href={`/dashboard/tests/${test.id}`}
              className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-4">
                <StatusIndicator status={test.status} variant="icon" />
                <div>
                  <p className="font-medium">{test.name}</p>
                  <p className="text-sm text-muted-foreground">{test.source}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="hidden text-right sm:block">
                  <p className={`text-sm font-mono ${config.textClass}`}>
                    {test.variance}
                  </p>
                  <p className="text-xs text-muted-foreground">{test.lastRun}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
