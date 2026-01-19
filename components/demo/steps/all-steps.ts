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
    content: "Kanari detects burnout through voice biomarkers - your voice changes days before you consciously feel exhausted.",
    position: "right",
    scrollBehavior: "center",
  },
  {
    id: "landing-how-it-works",
    phase: "landing",
    target: "demo-how-it-works",
    title: "How It Works",
    content: "30-second voice check-in → AI analyzes locally → Predicts risk 3-7 days ahead → Personalized recovery suggestions.",
    position: "top",
    scrollBehavior: "center",
  },

  // Dashboard - 3 steps
  {
    id: "dashboard-metrics",
    phase: "dashboard",
    route: "/dashboard",
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
    content: "Schedule recovery time and sync with Google Calendar. Block time for self-care.",
    position: "top",
    scrollBehavior: "center",
  },

  // Check-ins - 2 steps
  {
    id: "checkin-sidebar",
    phase: "checkin",
    route: "/dashboard/history",
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
    route: "/dashboard/analytics",
    target: "demo-burnout-prediction",
    title: "Burnout Forecast",
    content: "AI predicts your burnout risk for the coming week based on voice patterns and trends.",
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
    route: "/dashboard/achievements",
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
