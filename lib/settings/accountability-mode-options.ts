import type { AccountabilityMode } from "@/lib/types"

export interface AccountabilityModeOption {
  value: AccountabilityMode
  label: string
  description: string
  exampleResponse: string
}

export const ACCOUNTABILITY_MODE_OPTIONS: AccountabilityModeOption[] = [
  {
    value: "supportive",
    label: "Supportive",
    description: "Gentle, validating, and low-pressure.",
    exampleResponse: "That sounds heavy - we can keep this light today if you want.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "A mix of empathy and practical next steps.",
    exampleResponse: "I hear you. What is one small step that would make today feel 10% easier?",
  },
  {
    value: "accountability",
    label: "Accountability",
    description: "More direct prompts and follow-through.",
    exampleResponse:
      "You said you would do the 10-minute reset yesterday - did it happen? If not, what blocked it, and when will you do it today?",
  },
]
