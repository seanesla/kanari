// Demo step type definitions

export type DemoPhase =
  | "landing"
  | "onboarding"
  | "dashboard"
  | "checkin"
  | "analytics"
  | "achievements"
  | "complete"

export type TooltipPosition = "top" | "bottom" | "left" | "right"

export type ScrollBehavior = "none" | "center" | "top"

export interface DemoStep {
  /** Unique identifier for this step */
  id: string
  /** Which phase of the demo this step belongs to */
  phase: DemoPhase
  /** Optional route to navigate to when the step activates */
  route?: string
  /** data-demo-id selector to target */
  target: string
  /** Tooltip content to display */
  content: string
  /** Position of tooltip relative to target */
  position: TooltipPosition
  /** How to scroll the target into view */
  scrollBehavior: ScrollBehavior
  /** Wait for this selector to exist before showing step */
  waitFor?: string
  /** Optional title for the step */
  title?: string
}

export interface DemoState {
  /** Whether demo mode is active */
  isActive: boolean
  /** Current step index (0-based) */
  currentStepIndex: number
  /** Total number of steps */
  totalSteps: number
  /** Current phase of the demo */
  currentPhase: DemoPhase
  /** Currently highlighted element's data-demo-id */
  highlightedElement: string | null
  /** Whether we're navigating between pages */
  isNavigating: boolean
  /** Whether the current step is transitioning (waiting/scrolling) */
  isTransitioning: boolean
  /** Whether demo data has been seeded */
  hasSeededData: boolean
}

export interface DemoContextValue extends DemoState {
  /** Start the demo from the beginning */
  startDemo: () => Promise<void>
  /** Stop the demo and clean up (optional redirect) */
  stopDemo: (redirectTo?: string) => void
  /** Go to next step */
  nextStep: () => void
  /** Go to previous step */
  previousStep: () => void
  /** Jump to specific step */
  goToStep: (index: number) => void
  /** Get current step definition */
  getCurrentStep: () => DemoStep | null
}
