/**
 * Simplified Demo Steps
 * ~10 essential steps covering the core Kanari experience
 * Steps can be advanced manually or via autoplay.
 */

import type { DemoStep } from "./types"

export const ALL_DEMO_STEPS: DemoStep[] = [
  // Landing - 2 steps
  {
    id: "landing-hero",
    phase: "landing",
    target: "demo-hero",
    title: "Welcome to Kanari",
    content: "Kanari estimates stress + fatigue signals from voice patterns and trends them over time. It’s a wellness tool, not a diagnosis.",
    position: "right",
    scrollBehavior: "center",
  },
  {
    id: "landing-feature-tour",
    phase: "landing",
    target: "demo-feature-tour",
    title: "Walkthrough",
    content: "A quick tour of Kanari: check-in -> on-device biomarkers -> insights -> 3-7 day forecast -> recovery actions.",
    position: "top",
    scrollBehavior: "center",
  },

  // Dashboard - 3 steps
  {
    id: "dashboard-metrics",
    phase: "dashboard",
    route: "/overview",
    target: "demo-metrics-header",
    title: "Real-time Metrics",
    content: "Your stress and fatigue scores derived from voice biomarkers. Updated with each check-in.",
    position: "bottom",
    scrollBehavior: "top",
    waitFor: "demo-metrics-header",
  },
  {
    id: "dashboard-suggestions",
    phase: "dashboard",
    target: "demo-suggestions-kanban",
    title: "AI Suggestions",
    content: "Personalized recovery activities based on your voice analysis. Drag to schedule or mark complete.",
    position: "top",
    scrollBehavior: "center",
  },
  {
    id: "dashboard-calendar",
    phase: "dashboard",
    target: "demo-calendar",
    title: "Calendar",
    content: "Schedule recovery time directly in Kanari. Block time for self-care.",
    position: "top",
    scrollBehavior: "center",
  },

  // Check-ins - 2 steps
  {
    id: "checkin-sidebar",
    phase: "checkin",
    route: "/check-ins",
    target: "demo-checkin-sidebar",
    title: "Check-in History",
    content: "Browse previous check-ins. Each shows your wellness scores and full AI conversation.",
    position: "right",
    scrollBehavior: "top",
    waitFor: "demo-checkin-sidebar",
  },
  {
    id: "checkin-new-button",
    phase: "checkin",
    target: "demo-new-checkin-button",
    title: "New Check-in",
    content: "Start a voice check-in. You'll have a natural conversation while AI analyzes your voice in real-time.",
    position: "bottom",
    scrollBehavior: "none",
  },

  // Analytics - 2 steps
  {
    id: "analytics-burnout",
    phase: "analytics",
    route: "/overview?view=trends",
    target: "demo-burnout-prediction",
    title: "Burnout Forecast",
    content: "A 3–7 day heuristic forecast from your recent trend. Confidence drops when data is sparse or noisy.",
    position: "bottom",
    scrollBehavior: "center",
    waitFor: "demo-burnout-prediction",
  },
  {
    id: "analytics-trends",
    phase: "analytics",
    target: "demo-trend-charts",
    title: "Trend Charts",
    content: "Track your stress and fatigue over time. See patterns and progress.",
    position: "top",
    scrollBehavior: "center",
  },

  // Achievements - 1 step
  {
    id: "achievements-daily",
    phase: "achievements",
    route: "/achievements",
    target: "demo-daily-challenges",
    title: "Achievements",
    content: "Complete daily challenges to earn points and badges. Build healthy habits with gamified wellness.",
    position: "bottom",
    scrollBehavior: "top",
    waitFor: "demo-daily-challenges",
  },
]

// Export helpers
export function getStepById(id: string): DemoStep | undefined {
  return ALL_DEMO_STEPS.find((step) => step.id === id)
}

export function getStepIndexById(id: string): number {
  return ALL_DEMO_STEPS.findIndex((step) => step.id === id)
}
