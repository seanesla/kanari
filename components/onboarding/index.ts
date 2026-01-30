/**
 * Onboarding Components
 *
 * Components for the first-time user onboarding flow.
 * Uses 3D floating panels with camera fly-through navigation.
 *
 * New flow (navbar steps: intro -> graphics -> api -> coach -> prefs -> done):
 * - WelcomeSplash: Overlay animation before steps begin
 * - StepIntro: Name + accent color selection
 * - StepGraphicsQuality: Graphics quality selection
 * - StepApiKey: Gemini API key input
 * - StepMeetCoach: Voice selection + avatar generation
 * - StepPreferences: Accountability mode + reminders
 * - StepComplete: Success screen with avatar greeting
 */

// Onboarding flow components (intro -> graphics -> api -> coach -> prefs -> done)
export { WelcomeSplash } from "./welcome-splash"
export { StepIntro } from "./step-intro"
export { StepGraphicsQuality } from "./step-graphics-quality"
export { StepApiKey } from "./step-api-key"
export { StepMeetCoach } from "./step-meet-coach"
export { StepPreferences } from "./step-preferences"
export { StepComplete } from "./step-complete"
