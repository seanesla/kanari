import { memo } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface DashboardHeaderProps {
  title?: string
  onNewTest?: () => void
}

export const DashboardHeader = memo(function DashboardHeader({
  title = "Dashboard",
  onNewTest,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card/50 px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tests..."
            className="h-9 w-64 rounded-md border border-border bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={onNewTest}>
          <Plus className="mr-2 h-4 w-4" />
          New Test
        </Button>
      </div>
    </header>
  )
})
