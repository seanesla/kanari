import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TestStatus } from "@/lib/types"

export interface StatusIndicatorProps {
  status: TestStatus
  variant?: "dot" | "icon" | "badge"
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export const statusConfig = {
  pass: {
    icon: CheckCircle2,
    dotClass: "bg-success",
    textClass: "text-success",
    bgClass: "bg-success/10",
    label: "Pass",
  },
  fail: {
    icon: XCircle,
    dotClass: "bg-destructive animate-pulse",
    textClass: "text-destructive",
    bgClass: "bg-destructive/10",
    label: "Fail",
  },
  warn: {
    icon: AlertTriangle,
    dotClass: "bg-accent",
    textClass: "text-accent",
    bgClass: "bg-accent/10",
    label: "Warning",
  },
} as const

const sizeMap = {
  sm: { dot: "h-1.5 w-1.5", icon: "h-4 w-4", iconBox: "h-7 w-7", text: "text-xs" },
  md: { dot: "h-2 w-2", icon: "h-5 w-5", iconBox: "h-9 w-9", text: "text-xs" },
  lg: { dot: "h-3 w-3", icon: "h-6 w-6", iconBox: "h-11 w-11", text: "text-sm" },
}

export function StatusIndicator({
  status,
  variant = "dot",
  showLabel = false,
  size = "md",
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const sizes = sizeMap[size]

  if (variant === "icon") {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg",
          config.bgClass,
          sizes.iconBox,
          className
        )}
      >
        <Icon className={cn(sizes.icon, config.textClass)} />
      </div>
    )
  }

  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
          config.bgClass,
          config.textClass,
          sizes.text,
          className
        )}
      >
        <span className={cn("rounded-full", config.dotClass, sizes.dot)} />
        {config.label}
      </span>
    )
  }

  // Default: dot variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("rounded-full", config.dotClass, sizes.dot)} />
      {showLabel && (
        <span className={cn("uppercase tracking-wider text-muted-foreground", sizes.text)}>
          {status}
        </span>
      )}
    </div>
  )
}
