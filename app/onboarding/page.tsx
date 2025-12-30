"use client"

/**
 * Onboarding Page
 *
 * Multi-step onboarding flow with 3D floating panels.
 * Camera flies between panels as user navigates steps.
 * All panels exist in 3D space - you physically travel to each one.
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useOnboarding } from "@/hooks/use-onboarding"
import { Onboarding3DScene } from "@/components/onboarding/onboarding-3d-scene"
import {
  StepWelcome,
  StepTheme,
  StepApiKey,
  StepPreferences,
  StepComplete,
} from "@/components/onboarding"
import type { UserSettings } from "@/lib/types"

const TOTAL_STEPS = 5

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoading, hasCompletedOnboarding, settings, updateSettings, completeOnboarding } =
    useOnboarding()

  const [currentStep, setCurrentStep] = useState(0)
  const [pendingSettings, setPendingSettings] = useState<Partial<UserSettings>>({})

  // Redirect to dashboard if already onboarded
  useEffect(() => {
    if (!isLoading && hasCompletedOnboarding) {
      router.replace("/dashboard")
    }
  }, [isLoading, hasCompletedOnboarding, router])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Already onboarded - will redirect
  if (hasCompletedOnboarding) {
    return null
  }

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0))

  const handleApiKeySubmit = async (apiKey: string) => {
    setPendingSettings((prev) => ({ ...prev, geminiApiKey: apiKey }))
    await updateSettings({ geminiApiKey: apiKey })
    goNext()
  }

  const handlePreferencesSubmit = async (prefs: Partial<UserSettings>) => {
    setPendingSettings((prev) => ({ ...prev, ...prefs }))
    await updateSettings(prefs)
    goNext()
  }

  const handleComplete = async () => {
    await completeOnboarding()
  }

  // All step components are passed as children - they'll be placed in 3D panels
  return (
    <Onboarding3DScene currentStep={currentStep} totalSteps={TOTAL_STEPS}>
      {/* Panel 0: Welcome */}
      <StepWelcome onNext={goNext} />

      {/* Panel 1: Theme */}
      <StepTheme onNext={goNext} onBack={goBack} />

      {/* Panel 2: API Key */}
      <StepApiKey
        initialApiKey={settings?.geminiApiKey || pendingSettings.geminiApiKey || ""}
        onNext={handleApiKeySubmit}
        onBack={goBack}
      />

      {/* Panel 3: Preferences */}
      <StepPreferences
        initialSettings={{ ...settings, ...pendingSettings }}
        onNext={handlePreferencesSubmit}
        onBack={goBack}
      />

      {/* Panel 4: Complete */}
      <StepComplete onComplete={handleComplete} />
    </Onboarding3DScene>
  )
}
