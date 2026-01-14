"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { X } from "@/lib/icons"
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
  onDismiss?: () => void
  className?: string
  children: ReactNode
}

export function WidgetContainer({
  title,
  description,
  onDismiss,
  className,
  children,
}: WidgetContainerProps) {
  return (
    <motion.div
      className={cn("w-full", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      layout
    >
      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-xs">{description}</CardDescription>
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
        <CardContent className="px-4">{children}</CardContent>
      </Card>
    </motion.div>
  )
}

