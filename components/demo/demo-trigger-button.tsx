"use client"

import { useState } from "react"
import { Play } from "@/lib/icons"
import { useDemo } from "./demo-provider"
import { cn } from "@/lib/utils"

interface DemoTriggerButtonProps {
  className?: string
}

export function DemoTriggerButton({ className }: DemoTriggerButtonProps) {
  const { startDemo, isActive } = useDemo()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (isActive || isLoading) return
    setIsLoading(true)
    try {
      await startDemo()
    } finally {
      setIsLoading(false)
    }
  }

  if (isActive) return null

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "group inline-flex items-center gap-2 text-sm border border-foreground/20 px-4 py-2 hover:bg-foreground hover:text-background transition-all cursor-pointer disabled:opacity-50",
        className
      )}
    >
      <Play className="h-3 w-3" fill="currentColor" />
      {isLoading ? "Loading..." : "Watch Demo"}
    </button>
  )
}
