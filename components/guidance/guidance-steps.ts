export type GuidanceType = "first-time" | "demo"

export interface GuidanceStep {
  id: string
  title: string
  message: string
  /** Optional route the user should be on */
  route?: string
  /** Optional demo target element (data-demo-id) for spotlight + anchored card */
  target?: string
  /** Optional required element (data-demo-id) that must exist before Next is enabled */
  completionTarget?: string
  /** Optional auto-open behavior for responsive UI */
  autoOpen?: "checkins-mobile-sidebar"
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
    target: "demo-metrics-header",
  },
  {
    id: "demo-metrics",
    title: "Burnout Metrics",
    message:
      "These cards show stress, energy, and mood scores from past check-ins. In your real workspace, they'll reflect your actual voice biomarkers.",
    route: "/overview",
    target: "demo-metrics-header",
  },
  {
    id: "demo-suggestions",
    title: "Suggestions Board",
    message:
      "The kanban board organizes recovery suggestions by status. Drag cards between columns or schedule them to your calendar.",
    route: "/overview",
    target: "demo-suggestions-kanban",
  },
  {
    id: "demo-forecast",
    title: "Forecast Trends",
    message:
      "Kanari can show a 3-7 day burnout forecast from recent voice trends. We'll switch to Trends for this step automatically.",
    route: "/overview?view=trends",
    target: "demo-burnout-prediction",
  },
  {
    id: "demo-checkins",
    title: "Start a Check-in",
    message:
      "Use New Check-in to open the live check-in view. You'll move forward once that view is open.",
    route: "/check-ins",
    target: "demo-new-checkin-button",
    completionTarget: "demo-new-checkin-view",
    autoOpen: "checkins-mobile-sidebar",
  },
  {
    id: "demo-done",
    title: "Ready to try it for real?",
    message:
      "Switch back to your real workspace from Settings whenever you want to start tracking your own burnout risk.",
    route: "/overview",
    target: "demo-metrics-header",
  },
]

export function getStepsForGuide(type: GuidanceType): GuidanceStep[] {
  return type === "first-time" ? FIRST_TIME_STEPS : DEMO_STEPS
}
