"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, X } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface WidgetContainerProps {
  title: string
  description?: string
  onBack?: () => void
  onDismiss?: () => void
  variant?: "inline" | "focus"
  className?: string
  children: ReactNode
}

export function WidgetContainer({
  title,
  description,
  onBack,
  onDismiss,
  variant = "inline",
  className,
  children,
}: WidgetContainerProps) {
  const isFocus = variant === "focus"

  return (
    <motion.div
      className={cn("w-full", isFocus && "h-full", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      layout
    >
      <Card className={cn(isFocus ? "h-full py-0 gap-0 overflow-hidden" : "py-4")}>
        <CardHeader
          className={cn(
            "px-4",
            isFocus && "py-4 border-b border-border/60"
          )}
        >
          <div className={cn("flex items-center gap-2", onBack && "-ml-2")}>
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            ) : null}

            <CardTitle className={cn(isFocus ? "text-base" : "text-sm")}>{title}</CardTitle>
          </div>
          {description ? (
            <CardDescription
              className={cn(
                isFocus ? "text-sm" : "text-xs",
                onBack && "pl-10"
              )}
            >
              {description}
            </CardDescription>
          ) : null}
          {onDismiss ? (
            <CardAction>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onDismiss}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent
          className={cn(
            "px-4",
            isFocus && "py-4 flex-1 min-h-0"
          )}
        >
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}
