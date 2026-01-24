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
  return (
    <Deck className="p-6 transition-colors hover:bg-card/80">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Profile</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4 font-sans">
        Add a name so kanari can greet you more naturally.
      </p>

      <div className="space-y-2">
        <Label htmlFor="user-name" className="text-base font-sans">
          What should I call you?
        </Label>
        <Input
          id="user-name"
          value={userName}
          onChange={(e) => onUserNameChange(e.target.value)}
          placeholder="Your name"
          autoComplete="nickname"
        />
      </div>
    </Deck>
  )
}
