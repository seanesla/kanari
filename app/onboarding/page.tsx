"use client"

/**
 * Onboarding Page
 *
 * Multi-step onboarding flow for first-time users.
 * Collects API key and basic preferences before redirecting to dashboard.
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useOnboarding } from "@/hooks/use-onboarding"
import {
  OnboardingLayout,
  StepWelcome,
  StepApiKey,
  StepPreferences,
  StepComplete,
} from "@/components/onboarding"
import type { UserSettings } from "@/lib/types"

const TOTAL_STEPS = 4

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

  return (
    <OnboardingLayout currentStep={currentStep} totalSteps={TOTAL_STEPS}>
      {currentStep === 0 && <StepWelcome onNext={goNext} />}

      {currentStep === 1 && (
        <StepApiKey
          initialApiKey={settings?.geminiApiKey || pendingSettings.geminiApiKey || ""}
          onNext={handleApiKeySubmit}
          onBack={goBack}
        />
      )}

      {currentStep === 2 && (
        <StepPreferences
          initialSettings={{ ...settings, ...pendingSettings }}
          onNext={handlePreferencesSubmit}
          onBack={goBack}
        />
      )}

      {currentStep === 3 && <StepComplete onComplete={handleComplete} />}
    </OnboardingLayout>
  )
}
