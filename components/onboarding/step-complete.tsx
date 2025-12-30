"use client"

/**
 * Complete Step
 *
 * Final step showing success and redirecting to dashboard.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StepCompleteProps {
  onComplete: () => Promise<void>
}

export function StepComplete({ onComplete }: StepCompleteProps) {
  const router = useRouter()
  const [isCompleting, setIsCompleting] = useState(false)

  const handleEnterDashboard = async () => {
    setIsCompleting(true)
    await onComplete()
    router.push("/dashboard")
  }

  return (
    <div className="space-y-8 text-center">
      {/* Success animation */}
      <motion.div
        className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-green-500/10 mx-auto"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
        >
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </motion.div>
      </motion.div>

      {/* Header */}
      <div className="space-y-4">
        <motion.h1
          className="text-3xl md:text-4xl font-serif"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          You&apos;re All Set!
        </motion.h1>
        <motion.p
          className="text-lg text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Kanari is ready to help you stay ahead of burnout. Start with your first
          voice check-in to establish your baseline.
        </motion.p>
      </div>

      {/* Tips */}
      <motion.div
        className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm text-left max-w-md mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-accent" />
          <h3 className="font-medium">Quick Tips</h3>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">1.</span>
            <span>Record daily check-ins at roughly the same time for best results</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">2.</span>
            <span>Speak naturally about your day—no need for scripts or prompts</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">3.</span>
            <span>Review your suggestions and schedule recovery blocks to prevent burnout</span>
          </li>
        </ul>
      </motion.div>

      {/* Action */}
      <motion.div
        className="pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          onClick={handleEnterDashboard}
          size="lg"
          className="px-8"
          disabled={isCompleting}
        >
          {isCompleting ? (
            "Loading..."
          ) : (
            <>
              Enter Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </motion.div>
    </div>
  )
}
