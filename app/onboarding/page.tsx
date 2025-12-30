"use client"

/**
 * Onboarding Page
 *
 * Multi-step onboarding flow with 3D floating panels.
 * Camera flies between panels as user navigates steps.
 * All panels exist in 3D space - you physically travel to each one.
 */

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useOnboarding } from "@/hooks/use-onboarding"
import { useNavbar, TOTAL_ONBOARDING_STEPS } from "@/lib/navbar-context"
import { Onboarding3DScene } from "@/components/onboarding/onboarding-3d-scene"
import {
  StepWelcome,
  StepTheme,
  StepApiKey,
  StepPreferences,
  StepComplete,
} from "@/components/onboarding"
import type { UserSettings } from "@/lib/types"

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoading, hasCompletedOnboarding, settings, updateSettings, completeOnboarding } =
    useOnboarding()
  const { onboardingStep, setOnboardingStep } = useNavbar()

  const [pendingSettings, setPendingSettings] = useState<Partial<UserSettings>>({})

  // Redirect to dashboard if already onboarded
  useEffect(() => {
    if (!isLoading && hasCompletedOnboarding) {
      router.replace("/dashboard")
    }
  }, [isLoading, hasCompletedOnboarding, router])

  // Memoized navigation functions - MUST be before early returns
  // to satisfy React's Rules of Hooks (same order every render)
  const goNext = useCallback(() => {
    setOnboardingStep(Math.min(onboardingStep + 1, TOTAL_ONBOARDING_STEPS - 1))
  }, [onboardingStep, setOnboardingStep])

  const goBack = useCallback(() => {
    setOnboardingStep(Math.max(onboardingStep - 1, 0))
  }, [onboardingStep, setOnboardingStep])

  const handleApiKeySubmit = useCallback(async (apiKey: string) => {
    setPendingSettings((prev) => ({ ...prev, geminiApiKey: apiKey }))
    await updateSettings({ geminiApiKey: apiKey })
    setOnboardingStep(Math.min(onboardingStep + 1, TOTAL_ONBOARDING_STEPS - 1))
  }, [updateSettings, onboardingStep, setOnboardingStep])

  const handlePreferencesSubmit = useCallback(async (prefs: Partial<UserSettings>) => {
    setPendingSettings((prev) => ({ ...prev, ...prefs }))
    await updateSettings(prefs)
    setOnboardingStep(Math.min(onboardingStep + 1, TOTAL_ONBOARDING_STEPS - 1))
  }, [updateSettings, onboardingStep, setOnboardingStep])

  const handleComplete = useCallback(async () => {
    await completeOnboarding()
  }, [completeOnboarding])

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

  // All step components are passed as children - they'll be placed in 3D panels
  return (
    <Onboarding3DScene currentStep={onboardingStep} totalSteps={TOTAL_ONBOARDING_STEPS}>
      {/* Panel 0: Welcome */}
      <StepWelcome onNext={goNext} />

      {/* Panel 1: Theme */}
      <StepTheme onNext={goNext} onBack={goBack} />

      {/* Panel 2: API Key */}
      <StepApiKey
        initialApiKey={settings?.geminiApiKey || pendingSettings.geminiApiKey || ""}
        onNext={handleApiKeySubmit}
        onBack={goBack}
        isActive={onboardingStep === 2}
      />

      {/* Panel 3: Preferences */}
      <StepPreferences
        initialSettings={{ ...settings, ...pendingSettings }}
        onNext={handlePreferencesSubmit}
        onBack={goBack}
      />

      {/* Panel 4: Complete */}
      <StepComplete onComplete={handleComplete} onNavigate={() => router.push("/dashboard")} />
    </Onboarding3DScene>
  )
}
