"use client"

import { Heart, Shield, Target } from "lucide-react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { AccountabilityMode } from "@/lib/types"

interface SettingsAccountabilitySectionProps {
  accountabilityMode: AccountabilityMode | undefined
  onAccountabilityModeChange: (mode: AccountabilityMode) => void
}

export function SettingsAccountabilitySection({
  accountabilityMode,
  onAccountabilityModeChange,
}: SettingsAccountabilitySectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
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
        <div className="flex items-start gap-3 rounded-md border border-border p-4">
          <RadioGroupItem value="supportive" id="accountability-supportive" className="mt-1" />
          <Label htmlFor="accountability-supportive" className="cursor-pointer font-sans">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-accent" />
              <span className="font-medium text-foreground">Supportive Listener</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Listen, validate, and don&apos;t push.
            </p>
          </Label>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-4">
          <RadioGroupItem value="balanced" id="accountability-balanced" className="mt-1" />
          <Label htmlFor="accountability-balanced" className="cursor-pointer font-sans">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <span className="font-medium text-foreground">Balanced Companion</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Gentle follow-ups and small next steps.
            </p>
          </Label>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-4">
          <RadioGroupItem value="accountability" id="accountability-coach" className="mt-1" />
          <Label htmlFor="accountability-coach" className="cursor-pointer font-sans">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <span className="font-medium text-foreground">Accountability Coach</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Direct follow-ups, challenges patterns, and pushes for action.
            </p>
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}

