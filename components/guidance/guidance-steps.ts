export type GuidanceType = "first-time" | "demo"

export interface GuidanceStep {
  id: string
  title: string
  message: string
  /** Optional route the user should be on (no auto-navigation, just context) */
  route?: string
}

// ---------------------------------------------------------------------------
// First-time user guide
// Shows after first onboarding completion on real workspace
// ---------------------------------------------------------------------------

export const FIRST_TIME_STEPS: GuidanceStep[] = [
  {
    id: "ft-welcome",
    title: "Welcome to Kanari",
    message:
      "This is your personal burnout prevention dashboard. It tracks your voice biomarkers over time to help you stay ahead of stress.",
    route: "/overview",
  },
  {
    id: "ft-checkin",
    title: "Start a Check-in",
    message:
      'Tap the "Check in" button in the sidebar to have a quick voice conversation with your AI coach. Kanari analyzes your tone and speech patterns to gauge how you\'re doing.',
    route: "/overview",
  },
  {
    id: "ft-suggestions",
    title: "Recovery Suggestions",
    message:
      "After each check-in, Kanari generates personalized recovery suggestions. You can schedule them directly to your Google Calendar.",
    route: "/overview",
  },
  {
    id: "ft-ready",
    title: "You're all set!",
    message:
      "Start your first check-in whenever you're ready. The more you check in, the better Kanari understands your patterns and can forecast burnout risk.",
  },
]

// ---------------------------------------------------------------------------
// Demo mode guide
// Shows every time demo workspace is activated after onboarding
// ---------------------------------------------------------------------------

export const DEMO_STEPS: GuidanceStep[] = [
  {
    id: "demo-intro",
    title: "Demo Mode",
    message:
      "You're exploring Kanari with sample data. Everything here is pre-generated so you can see how the app works without doing a real check-in.",
    route: "/overview",
  },
  {
    id: "demo-metrics",
    title: "Burnout Metrics",
    message:
      "These cards show stress, energy, and mood scores from past check-ins. In your real workspace, they'll reflect your actual voice biomarkers.",
    route: "/overview",
  },
  {
    id: "demo-suggestions",
    title: "Suggestions Board",
    message:
      "The kanban board organizes recovery suggestions by status. Drag cards between columns or schedule them to your calendar.",
    route: "/overview",
  },
  {
    id: "demo-checkins",
    title: "Check-in History",
    message:
      "Visit the Check-ins page to see past sessions, journal entries, and detailed biomarker breakdowns for each conversation.",
    route: "/check-ins",
  },
  {
    id: "demo-done",
    title: "Ready to try it for real?",
    message:
      "Switch back to your real workspace from Settings whenever you want to start tracking your own burnout risk.",
  },
]

export function getStepsForGuide(type: GuidanceType): GuidanceStep[] {
  return type === "first-time" ? FIRST_TIME_STEPS : DEMO_STEPS
}
