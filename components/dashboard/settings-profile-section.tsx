"use client"

import { User } from "@/lib/icons"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Deck } from "@/components/dashboard/deck"

interface SettingsProfileSectionProps {
  userName: string
  onUserNameChange: (name: string) => void
}

export function SettingsProfileSection({ userName, onUserNameChange }: SettingsProfileSectionProps) {
  const trimmedName = userName.trim()
  const showNameError = trimmedName.length === 0

  return (
    <Deck className="p-6 transition-colors hover:bg-card/80">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Profile</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4 font-sans">
        Your name is required so kanari can personalize your check-ins.
      </p>

      <div className="space-y-2">
        <Label
          htmlFor="user-name"
          className="flex items-center justify-between text-base font-sans"
        >
          <span>What should I call you?</span>
          <span className="text-xs text-muted-foreground/70">Required</span>
        </Label>
        <Input
          id="user-name"
          value={userName}
          onChange={(e) => onUserNameChange(e.target.value)}
          placeholder="Your name"
          autoComplete="nickname"
          aria-invalid={showNameError}
          aria-describedby={showNameError ? "user-name-error" : undefined}
          className={showNameError ? "border-destructive focus-visible:ring-destructive/40" : undefined}
        />
        {showNameError && (
          <p id="user-name-error" className="text-sm text-destructive">
            Please enter your name.
          </p>
        )}
      </div>
    </Deck>
  )
}
