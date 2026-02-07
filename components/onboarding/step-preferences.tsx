"use client"

/**
 * Preferences Step
 *
 * Optional step to configure basic preferences.
 */

import { useState } from "react"
import { motion } from "framer-motion"
import { Settings, Heart, Shield, Target } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSceneMode } from "@/lib/scene-context"
import { ACCOUNTABILITY_MODE_OPTIONS } from "@/lib/settings/accountability-mode-options"
import type { AccountabilityMode, UserSettings } from "@/lib/types"

interface StepPreferencesProps {
  initialSettings: Partial<UserSettings>
  onNext: (settings: Partial<UserSettings>) => void
  onBack: () => void
}

function getAccountabilityIcon(mode: AccountabilityMode) {
  if (mode === "supportive") return Heart
  if (mode === "balanced") return Shield
  return Target
}

export function StepPreferences({ initialSettings, onNext, onBack }: StepPreferencesProps) {
  const { accentColor } = useSceneMode()

  const [accountabilityMode, setAccountabilityMode] = useState<AccountabilityMode>(
    initialSettings.accountabilityMode ?? "balanced"
  )

  const handleNext = () => {
    onNext({
      accountabilityMode,
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-accent/10 mx-auto"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Settings className="h-8 w-8 text-accent" />
        </motion.div>
        <motion.h1
          className="text-3xl md:text-4xl font-serif"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Set Your Preferences
        </motion.h1>
        <motion.p
          className="text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Customize how kanari works for you. You can always change these later in settings.
        </motion.p>
      </div>

      {/* Preferences */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Check-in style */}
        <motion.div
          className="p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm space-y-3 transition-colors hover:border-accent/30"
          initial={{ opacity: 0, y: 20, boxShadow: "0 0 0px transparent" }}
          animate={{ opacity: 1, y: 0, boxShadow: "0 0 0px transparent" }}
          transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 25 }}
          whileHover={{ boxShadow: `0 0 20px ${accentColor}10` }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 400, damping: 15 }}
            >
              <Target className="h-5 w-5 text-accent" />
            </motion.div>
            <div className="flex-1">
              <Label className="text-base">How should we work together?</Label>
              <p className="text-sm text-muted-foreground">
                Pick a coaching style. You can change this later in Settings.
              </p>
            </div>
          </div>

          <RadioGroup
            value={accountabilityMode}
            onValueChange={(value) => setAccountabilityMode(value as AccountabilityMode)}
            className="gap-4"
          >
            {ACCOUNTABILITY_MODE_OPTIONS.map((option) => {
              const Icon = getAccountabilityIcon(option.value)
              const optionId = `onboarding-accountability-${option.value}`

              return (
                <div key={option.value} className="flex items-start gap-3 rounded-md border border-border p-4">
                  <RadioGroupItem value={option.value} id={optionId} className="mt-1" />
                  <Label htmlFor={optionId} className="cursor-pointer font-sans">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-accent" />
                      <span className="font-medium text-foreground">{option.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                    <p className="mt-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Example response:</span>{" "}
                      <span>{option.exampleResponse}</span>
                    </p>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        </motion.div>
      </motion.div>

      {/* Actions */}
      <motion.div
        className="flex justify-between pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
      >
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={handleNext}>
            Continue
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
