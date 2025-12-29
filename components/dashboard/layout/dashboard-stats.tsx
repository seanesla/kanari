import { memo } from "react"
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export const DashboardStats = memo(function DashboardStats() {
  const stats = [
    { label: "Total Tests", value: "247", icon: Clock, color: "text-foreground" },
    { label: "Passing", value: "231", icon: CheckCircle2, color: "text-success" },
    { label: "Failing", value: "12", icon: XCircle, color: "text-destructive" },
    { label: "Warnings", value: "4", icon: AlertTriangle, color: "text-chart-3" },
  ]

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <stat.icon className={cn("h-5 w-5", stat.color)} />
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{stat.value}</p>
        </div>
      ))}
    </div>
  )
})
