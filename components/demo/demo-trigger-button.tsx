"use client"

import { Play } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Link } from "next-view-transitions"

interface DemoTriggerButtonProps {
  className?: string
}

export function DemoTriggerButton({ className }: DemoTriggerButtonProps) {
  return (
    <Link
      href="/demo"
      className={cn(
        "group inline-flex items-center gap-2 text-sm border border-foreground/20 px-4 py-2 hover:bg-foreground hover:text-background transition-all cursor-pointer",
        className
      )}
    >
      <Play className="h-3 w-3" fill="currentColor" />
      Watch Demo
    </Link>
  )
}
