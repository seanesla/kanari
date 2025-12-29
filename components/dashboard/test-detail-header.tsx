import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RotateCw, Settings } from "lucide-react"

export interface TestDetailHeaderProps {
  testId: string
  onRerun?: () => void
  onSettings?: () => void
}

export function TestDetailHeader({ testId, onRerun, onSettings }: TestDetailHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card/50 px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="h-6 w-px bg-border" />
        <h1 className="text-xl font-semibold">Test #{testId}</h1>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onRerun}>
          <RotateCw className="mr-2 h-4 w-4" />
          Re-run
        </Button>
        <Button variant="ghost" size="sm" onClick={onSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
