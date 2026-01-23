"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { verifyGeminiApiKey } from "@/lib/gemini/client"
import type { GeminiApiKeySource } from "@/lib/types"

interface SettingsApiSectionProps {
  geminiApiKey: string
  geminiApiKeySource: GeminiApiKeySource
  onGeminiApiKeyChange: (value: string) => void
  onGeminiApiKeySourceChange: (value: GeminiApiKeySource) => void
}

export function SettingsApiSection({
  geminiApiKey,
  geminiApiKeySource,
  onGeminiApiKeyChange,
  onGeminiApiKeySourceChange,
}: SettingsApiSectionProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "valid" | "invalid" | "checking">("idle")
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

  const kanariKeyAvailable = Boolean((process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "").trim())

  // Reset status when API key changes
  const handleApiKeyChange = useCallback((value: string) => {
    onGeminiApiKeyChange(value)
    setApiKeyError(null)
    setApiKeyStatus("idle")
  }, [onGeminiApiKeyChange])

  const handleApiKeySourceChange = useCallback((value: string) => {
    onGeminiApiKeySourceChange(value as GeminiApiKeySource)
    setApiKeyError(null)
    setApiKeyStatus("idle")
  }, [onGeminiApiKeySourceChange])

  // Verify API key with Google
  const handleVerifyApiKey = useCallback(async () => {
    if (geminiApiKeySource !== "user") return
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
  }, [geminiApiKey, geminiApiKeySource])

  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40">
      <div className="flex items-center gap-2 mb-6">
        <Image src="/gemini-logo.svg" alt="Gemini" width={20} height={20} />
        <h2 className="text-lg font-semibold font-serif">Gemini API</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-sans">Gemini Key</Label>

          <p className="text-sm text-muted-foreground mb-3 font-sans">
            Pick whether to use Kanari&apos;s built-in key, or your own key from{" "}
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Google AI Studio
            </a>
            .
          </p>

          <RadioGroup value={geminiApiKeySource} onValueChange={handleApiKeySourceChange} className="gap-2 mb-4">
            <label
              htmlFor="settings-gemini-key-kanari"
              className={`flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 transition-colors ${
                geminiApiKeySource === "kanari" ? "border-accent/40 bg-background/60" : "hover:border-accent/20"
              } ${!kanariKeyAvailable ? "opacity-60" : ""}`}
            >
              <RadioGroupItem
                value="kanari"
                id="settings-gemini-key-kanari"
                className="mt-1"
                disabled={!kanariKeyAvailable}
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Use Kanari&apos;s key</p>
                <p className="text-xs text-muted-foreground">
                  Shared key for this deployment.{!kanariKeyAvailable ? " (Not configured)" : ""}
                </p>
              </div>
            </label>

            <label
              htmlFor="settings-gemini-key-user"
              className={`flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 transition-colors ${
                geminiApiKeySource === "user" ? "border-accent/40 bg-background/60" : "hover:border-accent/20"
              }`}
            >
              <RadioGroupItem value="user" id="settings-gemini-key-user" className="mt-1" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Bring your own key</p>
                <p className="text-xs text-muted-foreground">Uses your own quota and rate limits.</p>
              </div>
            </label>
          </RadioGroup>

          {geminiApiKeySource === "user" ? (
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
          ) : (
            <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
              Kanari will use the built-in key. If you hit a rate limit (HTTP 429), switch to “Bring your own key”.
            </div>
          )}
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
            {geminiApiKeySource === "user"
              ? "Your API key is stored locally in your browser."
              : "No API key is stored in your browser."}
          </p>
        </div>
      </div>
    </div>
  )
}
