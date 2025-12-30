"use client"

/**
 * API Key Step
 *
 * Collects the user's Gemini API key for AI-powered features.
 */

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Key, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSceneMode } from "@/lib/scene-context"

interface StepApiKeyProps {
  initialApiKey?: string
  onNext: (apiKey: string) => void
  onBack: () => void
}

export function StepApiKey({ initialApiKey = "", onNext, onBack }: StepApiKeyProps) {
  const { accentColor } = useSceneMode()
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<"valid" | "invalid" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validateApiKey = useCallback(async (key: string) => {
    if (!key.trim()) {
      setError("API key is required")
      return false
    }

    setIsValidating(true)
    setError(null)
    setValidationResult(null)

    try {
      // Test the API key with a simple request
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      )

      if (response.ok) {
        setValidationResult("valid")
        return true
      } else {
        setValidationResult("invalid")
        setError("Invalid API key. Please check and try again.")
        return false
      }
    } catch {
      setError("Failed to validate API key. Please check your connection.")
      return false
    } finally {
      setIsValidating(false)
    }
  }, [])

  const handleNext = async () => {
    const isValid = await validateApiKey(apiKey)
    if (isValid) {
      onNext(apiKey)
    }
  }

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
    setValidationResult(null)
    setError(null)
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
          <div className="relative">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          {validationResult === "valid" && (
            <p className="text-sm text-green-600">API key verified successfully!</p>
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
          <Button onClick={handleNext} disabled={!apiKey.trim() || isValidating}>
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
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
