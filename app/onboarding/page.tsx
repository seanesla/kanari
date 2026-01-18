"use client"

/**
 * Onboarding Page
 *
 * Multi-step onboarding flow with 3D floating panels.
 * Camera flies between panels as user navigates steps.
 * All panels exist in 3D space - you physically travel to each one.
 *
 * New flow (navbar steps: intro -> api -> coach -> prefs -> done):
 * - WelcomeSplash: Overlay animation before steps begin
 * - StepIntro: Name + accent color selection
 * - StepApiKey: Gemini API key input
 * - StepMeetCoach: Voice selection + avatar generation
 * - StepPreferences: Accountability mode + reminders
 * - StepComplete: Success screen with avatar greeting
 */

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useOnboarding } from "@/hooks/use-onboarding"
import { useNavbar, TOTAL_ONBOARDING_STEPS } from "@/lib/navbar-context"
import { Onboarding3DScene } from "@/components/onboarding/onboarding-3d-scene"
import { Onboarding2DScene } from "@/components/onboarding/onboarding-2d-scene"
import {
  WelcomeSplash,
  StepIntro,
  StepApiKey,
  StepMeetCoach,
  StepPreferences,
  StepComplete,
} from "@/components/onboarding"
import { usePrefer2DOnboarding } from "@/hooks/use-prefer-2d-onboarding"
import { useSceneMode } from "@/lib/scene-context"
import type { UserSettings } from "@/lib/types"

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoading, hasCompletedOnboarding, settings, updateSettings, completeOnboarding } =
    useOnboarding()
  const { onboardingStep, setOnboardingStep } = useNavbar()
  const prefer2D = usePrefer2DOnboarding()
  const { setMode } = useSceneMode()

  // Pending settings accumulated during onboarding
  const [pendingSettings, setPendingSettings] = useState<Partial<UserSettings>>({})
  // Welcome state (3D scene intro + 2D fallback overlay)
  const [showWelcome, setShowWelcome] = useState(true)

  // Redirect to dashboard if already onboarded
  useEffect(() => {
    if (!isLoading && hasCompletedOnboarding) {
      router.replace("/dashboard")
    }
  }, [isLoading, hasCompletedOnboarding, router])

  // Hide landing background elements while onboarding (TruthCore, section accents, etc).
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Memoized navigation functions - MUST be before early returns
  // to satisfy React's Rules of Hooks (same order every render)
  const goNext = useCallback(() => {
    setOnboardingStep(Math.min(onboardingStep + 1, TOTAL_ONBOARDING_STEPS - 1))
  }, [onboardingStep, setOnboardingStep])

  const goBack = useCallback(() => {
    setOnboardingStep(Math.max(onboardingStep - 1, 0))
  }, [onboardingStep, setOnboardingStep])

  // Handler for StepIntro (name + accent color)
  const handleIntroSubmit = useCallback(async (introSettings: Partial<UserSettings>) => {
    setPendingSettings((prev) => ({ ...prev, ...introSettings }))
    await updateSettings(introSettings)
    goNext()
  }, [updateSettings, goNext])

  // Handler for StepApiKey
  const handleApiKeySubmit = useCallback(async (apiKey: string) => {
    setPendingSettings((prev) => ({ ...prev, geminiApiKey: apiKey }))
    await updateSettings({ geminiApiKey: apiKey })
    goNext()
  }, [updateSettings, goNext])

  // Handler for StepMeetCoach (voice + avatar)
  const handleCoachSubmit = useCallback(async (coachSettings: Partial<UserSettings>) => {
    setPendingSettings((prev) => ({ ...prev, ...coachSettings }))
    await updateSettings(coachSettings)
    goNext()
  }, [updateSettings, goNext])

  // Handler for StepPreferences
  const handlePreferencesSubmit = useCallback(async (prefs: Partial<UserSettings>) => {
    setPendingSettings((prev) => ({ ...prev, ...prefs }))
    await updateSettings(prefs)
    goNext()
  }, [updateSettings, goNext])

  // Handler for final completion
  const handleComplete = useCallback(async () => {
    await completeOnboarding()
  }, [completeOnboarding])

  // Handle welcome completion
  const handleWelcomeComplete = useCallback(() => {
    setShowWelcome(false)
  }, [])

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

  // Merged settings for passing to components
  const mergedSettings = { ...settings, ...pendingSettings }

  // New flow steps: intro -> api -> coach -> prefs -> done
  const steps = [
    // Step 0: Intro (name + accent color)
    <StepIntro
      key="intro"
      initialSettings={mergedSettings}
      onNext={handleIntroSubmit}
    />,
    // Step 1: API Key
    <StepApiKey
      key="apiKey"
      initialApiKey={mergedSettings?.geminiApiKey || ""}
      onNext={handleApiKeySubmit}
      onBack={goBack}
      isActive={onboardingStep === 1}
    />,
    // Step 2: Meet Your Coach (voice + avatar)
    <StepMeetCoach
      key="coach"
      initialSettings={mergedSettings}
      onNext={handleCoachSubmit}
      onBack={goBack}
    />,
    // Step 3: Preferences (accountability + reminders)
    <StepPreferences
      key="preferences"
      initialSettings={mergedSettings}
      onNext={handlePreferencesSubmit}
      onBack={goBack}
    />,
    // Step 4: Complete
    <StepComplete
      key="complete"
      onComplete={handleComplete}
      onNavigate={() => router.push("/dashboard")}
      settings={mergedSettings}
    />,
  ]

  // All step components are passed as children - they'll be placed in 3D panels
  if (prefer2D) {
    return (
      <>
        {showWelcome && <WelcomeSplash onComplete={handleWelcomeComplete} />}
        <Onboarding2DScene currentStep={onboardingStep}>
          {steps}
        </Onboarding2DScene>
      </>
    )
  }

  return (
    <>
      <Onboarding3DScene
        currentStep={onboardingStep}
        totalSteps={TOTAL_ONBOARDING_STEPS}
        showWelcome={showWelcome}
        onWelcomeComplete={handleWelcomeComplete}
      >
        {steps}
      </Onboarding3DScene>
    </>
  )
}
