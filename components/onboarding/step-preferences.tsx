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
import type { UserSettings } from "@/lib/types"

interface StepPreferencesProps {
  initialSettings: Partial<UserSettings>
  onNext: (settings: Partial<UserSettings>) => void
  onBack: () => void
}

export function StepPreferences({ initialSettings, onNext, onBack }: StepPreferencesProps) {
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
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Recording duration */}
        <div className="p-4 rounded-lg border border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
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
        </div>

        {/* Voice Activity Detection */}
        <div className="p-4 rounded-lg border border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mic className="h-5 w-5 text-muted-foreground" />
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
        </div>

        {/* Notifications */}
        <div className="p-4 rounded-lg border border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
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
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        className="flex justify-between pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext}>
          Continue
        </Button>
      </motion.div>
    </div>
  )
}
