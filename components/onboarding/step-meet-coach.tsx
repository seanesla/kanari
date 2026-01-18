"use client"

/**
 * Meet Your Coach Step
 *
 * Voice selection and avatar generation step in onboarding.
 * Users pick their coach's voice and generate a lightweight 2D avatar.
 * Uses a prebuilt icon style library (fast + reliable, no paid image models).
 */

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Sparkles, RefreshCw, AlertCircle } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { VoiceList } from "@/components/voice-list"
import { CoachAvatar, CoachAvatarLoading } from "@/components/coach-avatar"
import { useSceneMode } from "@/lib/scene-context"
import { generateCoachAvatar } from "@/lib/gemini/avatar-client"
import type { GeminiVoice, UserSettings } from "@/lib/types"

interface StepMeetCoachProps {
  initialSettings: Partial<UserSettings>
  onNext: (settings: Partial<UserSettings>) => Promise<void>
  onBack: () => void
}

const MAX_REGENERATIONS = 3

export function StepMeetCoach({ initialSettings, onNext, onBack }: StepMeetCoachProps) {
  const { accentColor } = useSceneMode()

  // Voice selection state
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoice | null>(
    initialSettings?.selectedGeminiVoice || initialSettings?.coachAvatarVoice || null
  )

  // Avatar generation state
  const [avatarBase64, setAvatarBase64] = useState<string | null>(
    initialSettings?.coachAvatarBase64 || null
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [regenerationCount, setRegenerationCount] = useState(0)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canRegenerate = regenerationCount < MAX_REGENERATIONS && !isGenerating

  /**
   * Generate or regenerate the avatar
   */
  const handleGenerateAvatar = useCallback(async () => {
    if (!selectedVoice) {
      setGenerationError("Please select a voice first")
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    const result = await generateCoachAvatar(accentColor, selectedVoice)

    if (result.error) {
      setGenerationError(result.error)
    } else if (result.imageBase64) {
      setAvatarBase64(result.imageBase64)
      setRegenerationCount((prev) => prev + 1)
    }

    setIsGenerating(false)
  }, [selectedVoice, accentColor])

  /**
   * Handle voice selection change
   */
  const handleVoiceSelect = useCallback((voice: GeminiVoice) => {
    setSelectedVoice(voice)
    // Clear avatar when voice changes (personality affects avatar)
    if (avatarBase64) {
      setAvatarBase64(null)
      // Don't reset regeneration count - they still used their attempts
    }
    setGenerationError(null)
  }, [avatarBase64])

  /**
   * Submit and proceed to next step
   */
  const handleNext = async () => {
    if (!selectedVoice) {
      setGenerationError("Please select a voice for your coach")
      return
    }

    setIsSubmitting(true)

    // Save settings
    const settings: Partial<UserSettings> = {
      selectedGeminiVoice: selectedVoice,
    }

    // Only save avatar if one was generated
    if (avatarBase64) {
      settings.coachAvatarBase64 = avatarBase64
      settings.coachAvatarVoice = selectedVoice
    }

    await onNext(settings)
    setIsSubmitting(false)
  }

  const hasAvatar = !!avatarBase64

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-accent/10 mx-auto"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Sparkles className="h-8 w-8 text-accent" />
        </motion.div>
        <motion.h1
          className="text-3xl md:text-4xl font-serif"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Meet Your <span className="text-accent">Coach</span>
        </motion.h1>
        <motion.p
          className="text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Choose a voice for your coach, then generate a lightweight icon-style avatar.
        </motion.p>
      </div>

      {/* Voice Selection */}
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <label className="text-sm text-muted-foreground">Select voice</label>
        <VoiceList
          selectedVoice={selectedVoice}
          onVoiceSelect={handleVoiceSelect}
          height="200px"
        />
      </motion.div>

      {/* Avatar Generation Section */}
      <motion.div
        className="space-y-4 p-4 rounded-xl border border-border/50 bg-card/30"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-start gap-4">
          {/* Avatar Preview */}
          <div className="flex-shrink-0">
            {isGenerating ? (
              <CoachAvatarLoading size="xl" />
            ) : (
              <CoachAvatar base64={avatarBase64} size="xl" />
            )}
          </div>

          {/* Avatar Controls */}
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-medium">
                {hasAvatar ? "Your Coach Avatar" : "Generate Avatar"}
              </h3>
              <p className="text-xs text-muted-foreground">
                 {hasAvatar
                   ? `${MAX_REGENERATIONS - regenerationCount} regeneration${MAX_REGENERATIONS - regenerationCount !== 1 ? "s" : ""} remaining`
                   : "Picks a style from a prebuilt library based on your voice + color"}

              </p>
            </div>

            <Button
              variant={hasAvatar ? "outline" : "default"}
              size="sm"
              onClick={handleGenerateAvatar}
              disabled={!selectedVoice || isGenerating || !canRegenerate}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : hasAvatar ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Avatar
                </>
              )}
            </Button>

            {!canRegenerate && regenerationCount >= MAX_REGENERATIONS && (
              <p className="text-xs text-muted-foreground">
                Maximum regenerations reached
              </p>
            )}
          </div>
        </div>

        {/* Error Message */}
        {generationError && (
          <motion.div
            className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{generationError}</span>
          </motion.div>
        )}
      </motion.div>

      {/* Info Note */}
      <motion.p
        className="text-xs text-muted-foreground text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Avatar generation is optional. You can skip it and use the default icon.
      </motion.p>

      {/* Actions */}
      <motion.div
        className="flex justify-between pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting || isGenerating}>
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!selectedVoice || isSubmitting || isGenerating}
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </motion.div>
    </div>
  )
}
