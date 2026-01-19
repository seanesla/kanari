/**
 * Demo Mode Components
 *
 * Export all demo-related components for easy imports.
 */

export { DemoProvider, useDemo, useDemoStatus } from "./demo-provider"
export { DemoOverlay } from "./demo-overlay"
export { DemoSpotlight } from "./demo-spotlight"
export { DemoTooltip } from "./demo-tooltip"
export { DemoControls } from "./demo-controls"
export { DemoProgress } from "./demo-progress"
export { DemoTriggerButton } from "./demo-trigger-button"

// Re-export step types and utilities
export type { DemoStep, DemoPhase, DemoState, DemoContextValue } from "./steps/types"
export { ALL_DEMO_STEPS, getStepById, getStepIndexById } from "./steps/all-steps"
