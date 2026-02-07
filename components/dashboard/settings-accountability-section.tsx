"use client"

import { Heart, Shield, Target } from "@/lib/icons"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ACCOUNTABILITY_MODE_OPTIONS } from "@/lib/settings/accountability-mode-options"
import type { AccountabilityMode } from "@/lib/types"
import { Deck } from "@/components/dashboard/deck"

interface SettingsAccountabilitySectionProps {
  accountabilityMode: AccountabilityMode | undefined
  onAccountabilityModeChange: (mode: AccountabilityMode) => void
}

function getAccountabilityIcon(mode: AccountabilityMode) {
  if (mode === "supportive") return Heart
  if (mode === "balanced") return Shield
  return Target
}

export function SettingsAccountabilitySection({
  accountabilityMode,
  onAccountabilityModeChange,
}: SettingsAccountabilitySectionProps) {
  return (
    <Deck className="p-6 transition-colors hover:bg-card/80">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Check-in Style</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4 font-sans">
        Choose how actively Kanari should engage during your check-ins.
      </p>

      <RadioGroup
        value={accountabilityMode ?? "balanced"}
        onValueChange={(value) => onAccountabilityModeChange(value as AccountabilityMode)}
        className="gap-4"
      >
        {ACCOUNTABILITY_MODE_OPTIONS.map((option) => {
          const Icon = getAccountabilityIcon(option.value)
          const optionId = `accountability-${option.value}`

          return (
            <div key={option.value} className="flex items-start gap-3 rounded-md border border-border p-4">
              <RadioGroupItem value={option.value} id={optionId} className="mt-1" />
              <Label htmlFor={optionId} className="cursor-pointer font-sans">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-accent" />
                  <span className="font-medium text-foreground">{option.label}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                <p className="mt-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Example response:</span>{" "}
                  <span>{option.exampleResponse}</span>
                </p>
              </Label>
            </div>
          )
        })}
      </RadioGroup>
    </Deck>
  )
}
