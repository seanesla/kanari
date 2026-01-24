"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { AlertCircle, Loader2, User } from "@/lib/icons"
import { db } from "@/lib/storage/db"
import { createDefaultSettingsRecord } from "@/lib/settings/default-settings"
import { Deck } from "@/components/dashboard/deck"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function RequireUserName() {
  const settings = useLiveQuery(() => db.settings.get("default"), [])
  const hasCompletedOnboarding = settings?.hasCompletedOnboarding ?? false
  const savedName = settings?.userName?.trim() ?? ""

  const isOpen = hasCompletedOnboarding && savedName.length === 0

  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPortalRoot(document.body)
  }, [])

  const [name, setName] = useState("")
  const [touched, setTouched] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setName("")
    setTouched(false)
    setIsSaving(false)
    setError(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const trimmedName = name.trim()
  const isValid = trimmedName.length > 0
  const showNameError = touched && !isValid

  const saveLabel = useMemo(() => {
    if (isSaving) return "Saving..."
    return "Save & continue"
  }, [isSaving])

  const handleSave = async () => {
    setTouched(true)
    setError(null)

    if (!isValid) return

    setIsSaving(true)
    try {
      const updated = await db.settings.update("default", { userName: trimmedName })
      if (updated === 0) {
        await db.settings.put(
          createDefaultSettingsRecord({
            userName: trimmedName,
            hasCompletedOnboarding: true,
            onboardingCompletedAt: new Date().toISOString(),
          })
        )
      }
    } catch {
      setError("Couldn't save your name. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!portalRoot || !isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10004]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="required-name-title"
      aria-describedby="required-name-description"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-background/80" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Deck tone="raised" className="w-full max-w-md p-6 md:p-7">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl border border-accent/20 bg-accent/10 flex items-center justify-center">
              <User className="h-6 w-6 text-accent" />
            </div>

            <div className="min-w-0">
              <h2 id="required-name-title" className="text-xl font-serif tracking-tight">
                One more thing
              </h2>
              <p id="required-name-description" className="text-sm text-muted-foreground mt-1">
                Kanari needs your name to personalize your check-ins.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label
              htmlFor="required-user-name"
              className="flex items-center justify-between text-sm text-muted-foreground"
            >
              <span>Your name</span>
              <span className="text-xs text-muted-foreground/70">Required</span>
            </Label>
            <Input
              id="required-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSave()
                }
              }}
              autoFocus
              maxLength={50}
              placeholder="Enter your name..."
              aria-invalid={showNameError || !!error}
              aria-describedby={showNameError || error ? "required-user-name-error" : undefined}
              className={cn(
                "h-12 text-lg",
                (showNameError || error) && "border-destructive focus-visible:ring-destructive/40"
              )}
            />

            {showNameError ? (
              <p id="required-user-name-error" className="text-sm text-destructive">
                Please enter your name to continue.
              </p>
            ) : error ? (
              <p id="required-user-name-error" className="text-sm text-destructive">
                <span className="inline-flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </span>
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {saveLabel}
                </>
              ) : (
                saveLabel
              )}
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Stored only on this device.
          </p>
        </Deck>
      </div>
    </div>,
    portalRoot
  )
}
