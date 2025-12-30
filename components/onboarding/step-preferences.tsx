"use client"

/**
 * Preferences Step
 *
 * Optional step to configure basic preferences.
 */

import { useState } from "react"
import { motion } from "framer-motion"
import { Settings, Bell, Clock, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSceneMode } from "@/lib/scene-context"
import type { UserSettings } from "@/lib/types"

interface StepPreferencesProps {
  initialSettings: Partial<UserSettings>
  onNext: (settings: Partial<UserSettings>) => void
  onBack: () => void
}

export function StepPreferences({ initialSettings, onNext, onBack }: StepPreferencesProps) {
  const { accentColor } = useSceneMode()
  const [enableVAD, setEnableVAD] = useState(initialSettings.enableVAD ?? true)
  const [enableNotifications, setEnableNotifications] = useState(
    initialSettings.enableNotifications ?? false
  )
  const [recordingDuration, setRecordingDuration] = useState(
    String(initialSettings.defaultRecordingDuration ?? 30)
  )

  const handleNext = () => {
    onNext({
      enableVAD,
      enableNotifications,
      defaultRecordingDuration: parseInt(recordingDuration, 10),
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
        {/* Recording duration */}
        <motion.div
          className="p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm space-y-3 transition-colors hover:border-accent/30"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 25 }}
          whileHover={{ boxShadow: `0 0 20px ${accentColor}10` }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 400, damping: 15 }}
            >
              <Clock className="h-5 w-5 text-accent" />
            </motion.div>
            <div className="flex-1">
              <Label htmlFor="duration">Default Recording Duration</Label>
              <p className="text-sm text-muted-foreground">
                How long each voice check-in should be
              </p>
            </div>
          </div>
          <Select value={recordingDuration} onValueChange={setRecordingDuration}>
            <SelectTrigger id="duration" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 seconds (recommended)</SelectItem>
              <SelectItem value="45">45 seconds</SelectItem>
              <SelectItem value="60">60 seconds</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Voice Activity Detection */}
        <motion.div
          className="p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm transition-colors hover:border-accent/30"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45, type: "spring", stiffness: 300, damping: 25 }}
          whileHover={{ boxShadow: `0 0 20px ${accentColor}10` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 15 }}
              >
                <Mic className="h-5 w-5 text-accent" />
              </motion.div>
              <div>
                <Label htmlFor="vad">Smart Recording</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically detect when you start/stop speaking
                </p>
              </div>
            </div>
            <Switch
              id="vad"
              checked={enableVAD}
              onCheckedChange={setEnableVAD}
            />
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div
          className="p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm transition-colors hover:border-accent/30"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.55, type: "spring", stiffness: 300, damping: 25 }}
          whileHover={{ boxShadow: `0 0 20px ${accentColor}10` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 400, damping: 15 }}
              >
                <Bell className="h-5 w-5 text-accent" />
              </motion.div>
              <div>
                <Label htmlFor="notifications">Daily Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get reminded to do your daily check-in
                </p>
              </div>
            </div>
            <Switch
              id="notifications"
              checked={enableNotifications}
              onCheckedChange={setEnableNotifications}
            />
          </div>
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
