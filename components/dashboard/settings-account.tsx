"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, RefreshCw, Trash2, User } from "@/lib/icons"
import { useClearAllData } from "@/hooks/use-storage"
import { db } from "@/lib/storage/db"
import { Deck } from "@/components/dashboard/deck"
import { Switch } from "@/components/ui/switch"

interface SettingsAccountSectionProps {
  isSaving: boolean
  localStorageOnly: boolean
  onLocalStorageOnlyChange: (checked: boolean) => void
  embedded?: boolean
}

export function SettingsAccountSection({
  isSaving,
  localStorageOnly,
  onLocalStorageOnlyChange,
  embedded = false,
}: SettingsAccountSectionProps) {
  const router = useRouter()
  const clearAllData = useClearAllData()

  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Modify onboarding - restart onboarding flow while keeping data
  const handleModifyOnboarding = useCallback(async () => {
    try {
      const existingSettings = await db.settings.get("default")
      if (existingSettings) {
        await db.settings.update("default", {
          hasCompletedOnboarding: false,
          onboardingCompletedAt: undefined,
        })
      }
      router.push("/onboarding")
    } catch (error) {
      console.error("Failed to modify onboarding:", error)
    }
  }, [router])

  // Reset all data - clear everything and restart onboarding
  const handleResetAllData = useCallback(async () => {
    setIsResetting(true)
    try {
      // Clear all user data
      await clearAllData()

      // Delete settings entirely (will be recreated during onboarding)
      await db.settings.delete("default")

      // Clear sessionStorage (OAuth tokens, dedup hashes)
      sessionStorage.clear()

      // Redirect to onboarding
      router.push("/onboarding")
    } catch (error) {
      console.error("Failed to reset data:", error)
      setIsResetting(false)
    }
  }, [clearAllData, router])

  const content = (
    <div className="space-y-6">
          {/* Privacy */}
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="local-storage" className="text-base font-sans">
                  Local Storage Only
                </Label>
                <p className="text-sm text-muted-foreground font-sans">
                  Store all data locally in your browser. No cloud sync.
                </p>
              </div>
              <Switch
                id="local-storage"
                checked={localStorageOnly}
                onCheckedChange={onLocalStorageOnlyChange}
                aria-label="Local Storage Only"
              />
            </div>
          </div>

          {/* Modify Onboarding */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-sans">Modify Onboarding</Label>
            </div>
            <p className="text-sm text-muted-foreground mb-3 font-sans">
              Go through the onboarding steps again without losing your check-ins or data.
            </p>
            <Button
              variant="outline"
              onClick={handleModifyOnboarding}
              disabled={isSaving || isResetting}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Restart Onboarding
            </Button>
          </div>

          {/* Reset All Data */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <Label className="text-base font-sans text-destructive">Reset All Data</Label>
            </div>
            <p className="text-sm text-muted-foreground mb-3 font-sans">
              Permanently delete all your check-ins, suggestions, and settings. This cannot be undone.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(true)}
              disabled={isSaving || isResetting}
              className="w-full bg-transparent text-destructive hover:bg-destructive/10 border-destructive/50"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset All Data
                </>
              )}
            </Button>
          </div>
        </div>
  )

  return (
    <>
      {embedded ? (
        content
      ) : (
        <Deck className="p-6 transition-colors hover:bg-card/80">
          <div className="flex items-center gap-2 mb-6">
            <User className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold font-serif">Account</h2>
          </div>
          {content}
        </Deck>
      )}

      {/* Reset All Data Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your check-ins, suggestions, trends, and settings.
              You&apos;ll be taken through the onboarding process again as a new user.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAllData}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Everything"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
