"use client"

/**
 * API Key Step
 *
 * Collects the user's Gemini API key for AI-powered features.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSceneMode } from "@/lib/scene-context"
import { verifyGeminiApiKey } from "@/lib/gemini/client"
import type { GeminiApiKeySource, UserSettings } from "@/lib/types"

interface StepApiKeyProps {
  initialApiKey?: string
  initialApiKeySource?: GeminiApiKeySource
  onNext: (updates: Partial<UserSettings>) => void
  onBack: () => void
  isActive?: boolean
}

export function StepApiKey({
  initialApiKey = "",
  initialApiKeySource,
  onNext,
  onBack,
  isActive = true,
}: StepApiKeyProps) {
  const { accentColor } = useSceneMode()

  const kanariKeyAvailable = Boolean((process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "").trim())

  const [keySource, setKeySource] = useState<GeminiApiKeySource>(() => {
    if (initialApiKeySource) return initialApiKeySource
    const hasUserKey = initialApiKey.trim().length > 0 && initialApiKey.trim() !== "DEMO_MODE"
    if (hasUserKey) return "user"
    return kanariKeyAvailable ? "kanari" : "user"
  })
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<"valid" | "invalid" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)

  // Track if we've already auto-advanced to prevent re-triggering
  const hasAutoAdvanced = useRef(false)

  // Reset auto-advance state when step becomes inactive
  // This prevents the step from auto-advancing again when navigating back
  useEffect(() => {
    if (!isActive) {
      hasAutoAdvanced.current = false
      setIsAutoAdvancing(false)
      // Keep validationResult so the green checkmark persists
    }
  }, [isActive])

  // Auto-advance after successful verification with 1.5s delay
  // Uses ref guard to ensure this only fires once per verification
  useEffect(() => {
    if (
      keySource === "user" &&
      validationResult === "valid" &&
      isAutoAdvancing &&
      isActive &&
      !hasAutoAdvanced.current
    ) {
      hasAutoAdvanced.current = true
      const timer = setTimeout(() => {
        onNext({ geminiApiKey: apiKey, geminiApiKeySource: "user" })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [keySource, validationResult, isAutoAdvancing, apiKey, onNext, isActive])

  const handleVerify = useCallback(async () => {
    if (keySource !== "user") return
    if (!apiKey.trim()) {
      setError("API key is required")
      return
    }

    setIsValidating(true)
    setError(null)
    setValidationResult(null)

    const result = await verifyGeminiApiKey(apiKey)

    setIsValidating(false)

    if (result.valid) {
      setValidationResult("valid")
      setIsAutoAdvancing(true)
    } else {
      setValidationResult("invalid")
      setError(result.error || "Invalid API key")
    }
  }, [apiKey, keySource])

  const handleContinue = () => {
    if (keySource === "kanari") {
      if (!kanariKeyAvailable) {
        setError("Kanari key is not available in this deployment")
        return
      }
      onNext({ geminiApiKeySource: "kanari" })
      return
    }

    // If already verified, just advance immediately
    if (validationResult === "valid") {
      onNext({ geminiApiKey: apiKey, geminiApiKeySource: "user" })
    }
  }

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
    setValidationResult(null)
    setError(null)
    setIsAutoAdvancing(false)
  }

  const handleSourceChange = (value: string) => {
    setKeySource(value as GeminiApiKeySource)
    setIsValidating(false)
    setValidationResult(null)
    setError(null)
    setIsAutoAdvancing(false)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-accent/10 mx-auto"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Image src="/gemini-logo.svg" alt="Gemini" width={40} height={40} priority />
        </motion.div>
        <motion.h1
          className="text-3xl md:text-4xl font-serif"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Connect to Gemini
        </motion.h1>
        <motion.p
          className="text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Kanari uses Google&apos;s Gemini AI to analyze your voice patterns and generate
          personalized insights. Pick the key you want to use.
        </motion.p>
      </div>

      {/* API Key Input */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Gemini key source</Label>
            <RadioGroup value={keySource} onValueChange={handleSourceChange} className="gap-2">
              <label
                htmlFor="gemini-key-kanari"
                className={`flex items-start gap-3 rounded-xl border border-border/50 bg-card/20 px-4 py-3 transition-colors ${
                  keySource === "kanari" ? "border-accent/40 bg-card/30" : "hover:border-accent/20"
                } ${!kanariKeyAvailable ? "opacity-60" : ""}`}
              >
                <RadioGroupItem
                  value="kanari"
                  id="gemini-key-kanari"
                  className="mt-1"
                  disabled={!kanariKeyAvailable}
                />
                <div className="space-y-1">
                  <p className="font-medium">Use Kanari&apos;s key (recommended)</p>
                  <p className="text-sm text-muted-foreground">
                    No setup. Shared key for this deployment.
                    {!kanariKeyAvailable ? " (Not configured)" : ""}
                  </p>
                </div>
              </label>

              <label
                htmlFor="gemini-key-user"
                className={`flex items-start gap-3 rounded-xl border border-border/50 bg-card/20 px-4 py-3 transition-colors ${
                  keySource === "user" ? "border-accent/40 bg-card/30" : "hover:border-accent/20"
                }`}
              >
                <RadioGroupItem value="user" id="gemini-key-user" className="mt-1" />
                <div className="space-y-1">
                  <p className="font-medium">Bring your own key</p>
                  <p className="text-sm text-muted-foreground">Use your own quota and rate limits.</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {keySource === "user" ? (
            <div className="space-y-2">
              <Label htmlFor="api-key">Gemini API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="AIza..."
                    value={apiKey}
                    onChange={handleKeyChange}
                    className={
                      validationResult === "valid"
                        ? "border-green-500 pr-10"
                        : validationResult === "invalid"
                          ? "border-destructive pr-10"
                          : ""
                    }
                  />
                  {validationResult === "valid" && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                  )}
                  {validationResult === "invalid" && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-destructive" />
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={handleVerify}
                  disabled={!apiKey.trim() || isValidating || validationResult === "valid"}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : validationResult === "valid" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Verified
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {validationResult === "valid" && (
                <motion.p
                  className="text-sm text-green-600 flex items-center gap-1"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  API key verified successfully! Continuing...
                </motion.p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-card/20 px-4 py-3 text-sm text-muted-foreground">
              Kanari will use its built-in Gemini key. If you hit a rate limit (HTTP 429), switch to
              “Bring your own key”.
            </div>
          )}

          {keySource === "kanari" && error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        {keySource === "user" ? (
          <motion.div
            className="p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm space-y-2 transition-colors hover:border-accent/30"
            initial={{ opacity: 0, y: 10, boxShadow: "0 0 0px transparent" }}
            animate={{ opacity: 1, y: 0, boxShadow: "0 0 0px transparent" }}
            transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 25 }}
            whileHover={{ boxShadow: `0 0 20px ${accentColor}10` }}
          >
            <p className="text-sm text-muted-foreground">
              <strong>Don&apos;t have an API key?</strong> Get one for free:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Go to Google AI Studio</li>
              <li>Sign in with your Google account</li>
              <li>Click &quot;Get API Key&quot; and create a new key</li>
              <li>Copy and paste it above</li>
            </ol>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-2"
            >
              Open Google AI Studio
              <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        ) : null}

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground text-center">
          {keySource === "user"
            ? "Your API key is stored locally in your browser."
            : "No API key is stored in your browser."}
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        className="flex justify-between pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleContinue}
            disabled={
              (keySource === "user" && (validationResult !== "valid" || isAutoAdvancing)) ||
              (keySource === "kanari" && !kanariKeyAvailable)
            }
          >
            {isAutoAdvancing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Continuing...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
