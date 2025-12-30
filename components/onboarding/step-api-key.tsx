"use client"

/**
 * API Key Step
 *
 * Collects the user's Gemini API key for AI-powered features.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Key, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSceneMode } from "@/lib/scene-context"
import { verifyGeminiApiKey } from "@/lib/gemini/client"

interface StepApiKeyProps {
  initialApiKey?: string
  onNext: (apiKey: string) => void
  onBack: () => void
  isActive?: boolean
}

export function StepApiKey({ initialApiKey = "", onNext, onBack, isActive = true }: StepApiKeyProps) {
  const { accentColor } = useSceneMode()
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
    if (validationResult === "valid" && isAutoAdvancing && isActive && !hasAutoAdvanced.current) {
      hasAutoAdvanced.current = true
      const timer = setTimeout(() => {
        onNext(apiKey)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [validationResult, isAutoAdvancing, apiKey, onNext, isActive])

  const handleVerify = useCallback(async () => {
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
  }, [apiKey])

  const handleContinue = () => {
    // If already verified, just advance immediately
    if (validationResult === "valid") {
      onNext(apiKey)
    }
  }

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
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
          <Key className="h-8 w-8 text-accent" />
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
          personalized insights. You&apos;ll need a free API key to continue.
        </motion.p>
      </div>

      {/* API Key Input */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
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

        {/* Help text */}
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

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground text-center">
          Your API key is stored locally in your browser and never sent to our servers.
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
            disabled={validationResult !== "valid" || isAutoAdvancing}
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
