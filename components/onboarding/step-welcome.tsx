"use client"

/**
 * Welcome Step
 *
 * First step of onboarding - introduces Kanari and explains what it does.
 */

import { motion } from "framer-motion"
import { Mic, Brain, Calendar, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSceneMode } from "@/lib/scene-context"

interface StepWelcomeProps {
  onNext: () => void
}

const features = [
  {
    icon: Mic,
    title: "Voice Analysis",
    description: "Record 30-second check-ins to track your wellness",
  },
  {
    icon: Brain,
    title: "AI Insights",
    description: "Gemini analyzes patterns to predict burnout risk",
  },
  {
    icon: Calendar,
    title: "Recovery Planning",
    description: "Get personalized suggestions and schedule rest",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "All analysis happens locally in your browser",
  },
]

export function StepWelcome({ onNext }: StepWelcomeProps) {
  const { accentColor } = useSceneMode()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.h1
          className="text-4xl md:text-5xl font-serif"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Welcome to <span className="text-accent">kanari</span>
        </motion.h1>
        <motion.p
          className="text-lg text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Your voice knows when you&apos;re heading toward burnout—often before you do.
          Let&apos;s set things up so kanari can help protect you.
        </motion.p>
      </div>

      {/* Feature cards */}
      <motion.div
        className="grid sm:grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-accent/30"
            style={{
              // Subtle accent glow on hover via CSS variable
              ["--hover-glow" as string]: `0 0 20px ${accentColor}20`,
            }}
            initial={{ opacity: 0, y: 20, boxShadow: "0 0 0px transparent, 0 0px 0px transparent" }}
            animate={{ opacity: 1, y: 0, boxShadow: "0 0 0px transparent, 0 0px 0px transparent" }}
            transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 300, damping: 25 }}
            whileHover={{
              scale: 1.02,
              boxShadow: `0 0 25px ${accentColor}15, 0 4px 20px rgba(0,0,0,0.1)`,
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1, type: "spring", stiffness: 400, damping: 15 }}
            >
              <feature.icon className="h-6 w-6 text-accent mb-3" />
            </motion.div>
            <h3 className="font-medium mb-1">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Action */}
      <motion.div
        className="flex justify-center pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={onNext} size="lg" className="px-8">
            Get Started
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
