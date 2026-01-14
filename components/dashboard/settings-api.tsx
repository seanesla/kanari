"use client"

import { useCallback, useState } from "react"
import { AlertCircle, CheckCircle2, Eye, EyeOff, Key, Loader2 } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { verifyGeminiApiKey } from "@/lib/gemini/client"

interface SettingsApiSectionProps {
  geminiApiKey: string
  onGeminiApiKeyChange: (value: string) => void
}

export function SettingsApiSection({
  geminiApiKey,
  onGeminiApiKeyChange,
}: SettingsApiSectionProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "valid" | "invalid" | "checking">("idle")
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

  // Reset status when API key changes
  const handleApiKeyChange = useCallback((value: string) => {
    onGeminiApiKeyChange(value)
    setApiKeyError(null)
    setApiKeyStatus("idle")
  }, [onGeminiApiKeyChange])

  // Verify API key with Google
  const handleVerifyApiKey = useCallback(async () => {
    if (!geminiApiKey.trim()) {
      setApiKeyError("API key is required")
      return
    }

    setApiKeyStatus("checking")
    setApiKeyError(null)

    const result = await verifyGeminiApiKey(geminiApiKey)

    if (result.valid) {
      setApiKeyStatus("valid")
    } else {
      setApiKeyStatus("invalid")
      setApiKeyError(result.error || "Invalid API key")
    }
  }, [geminiApiKey])

  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40">
      <div className="flex items-center gap-2 mb-6">
        <Key className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Gemini API</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="gemini-api-key" className="text-base font-sans">
            Gemini API Key
          </Label>
          <p className="text-sm text-muted-foreground mb-3 font-sans">
            Required for personalized suggestions. Get one from{" "}
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Google AI Studio
            </a>
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="gemini-api-key"
                type={showApiKey ? "text" : "password"}
                value={geminiApiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Enter your Gemini API key (starts with AIza...)"
                className={`h-10 w-full rounded-md border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-1 font-sans ${
                  apiKeyStatus === "valid"
                    ? "border-green-500 focus:border-green-500 focus:ring-green-500"
                    : apiKeyStatus === "invalid"
                      ? "border-destructive focus:border-destructive focus:ring-destructive"
                      : "border-border focus:border-accent focus:ring-accent"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              onClick={handleVerifyApiKey}
              disabled={!geminiApiKey.trim() || apiKeyStatus === "checking" || apiKeyStatus === "valid"}
            >
              {apiKeyStatus === "checking" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : apiKeyStatus === "valid" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verified
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </div>
          {/* Validation feedback */}
          {apiKeyStatus === "valid" && (
            <p className="mt-2 text-sm text-green-500 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              API key verified successfully!
            </p>
          )}
          {apiKeyError && (
            <p className="mt-2 text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {apiKeyError}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground font-sans">
            Your API key is stored locally in your browser and never sent to our servers.
          </p>
        </div>
      </div>
    </div>
  )
}
