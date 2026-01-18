/**
 * Coach Avatar Generator
 *
 * Generates lightweight 2D avatars from a prebuilt style library (DiceBear).
 *
 * This avoids paid image-generation models and keeps avatar creation fast and
 * reliable. If the user has a Gemini API key configured, we optionally use
 * Gemini 3 Flash (text-only) to pick a "recipe" (style + seed) so the avatar
 * feels tailored without generating pixels from scratch.
 */

import { createAvatar, type Style } from "@dicebear/core"
import {
  botttsNeutral,
  loreleiNeutral,
  notionistsNeutral,
  openPeeps,
  pixelArtNeutral,
} from "@dicebear/collection"

import { generateDarkVariant } from "@/lib/color-utils"
import { logDebug, logError } from "@/lib/logger"
import type { GeminiVoice } from "@/lib/types"

import { getGeminiApiKey } from "./api-utils"
import { parseGeminiJson } from "./json"
import { getVoiceStyle } from "./voices"

type AvatarStyleId =
  | "botttsNeutral"
  | "loreleiNeutral"
  | "notionistsNeutral"
  | "openPeeps"
  | "pixelArtNeutral"

const AVATAR_STYLES: Record<AvatarStyleId, { style: Style<Record<string, unknown>>; label: string }> = {
  notionistsNeutral: { style: notionistsNeutral, label: "Notionist" },
  loreleiNeutral: { style: loreleiNeutral, label: "Lorelei" },
  openPeeps: { style: openPeeps, label: "Peeps" },
  botttsNeutral: { style: botttsNeutral, label: "Bot" },
  pixelArtNeutral: { style: pixelArtNeutral, label: "Pixel" },
}

function isAvatarStyleId(value: string): value is AvatarStyleId {
  return value in AVATAR_STYLES
}

function makeNonce(length = 8) {
  // Deterministic crypto is unnecessary here; we want quick, varied regenerations.
  return Math.random().toString(36).slice(2, 2 + length)
}

function sanitizeSeed(seed: string): string {
  return seed
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 64)
}

function pickFallbackStyleId(voiceName: GeminiVoice): AvatarStyleId {
  const voiceStyle = getVoiceStyle(voiceName)

  // Keep this simple + stable. The user can always regenerate.
  if (["Warm", "Gentle", "Soft", "Breathy"].includes(voiceStyle)) return "loreleiNeutral"
  if (["Knowledgeable", "Informative", "Clear", "Even", "Mature"].includes(voiceStyle)) {
    return "notionistsNeutral"
  }
  if (["Bright", "Upbeat", "Excitable", "Lively"].includes(voiceStyle)) return "botttsNeutral"
  if (["Casual", "Easy-going", "Friendly", "Youthful"].includes(voiceStyle)) return "openPeeps"

  return "notionistsNeutral"
}

type AvatarRecipe = {
  styleId: AvatarStyleId
  seed: string
}

async function suggestRecipeWithGemini(options: {
  apiKey: string
  accentColor: string
  voiceName: GeminiVoice
}): Promise<AvatarRecipe | null> {
  const { apiKey, accentColor, voiceName } = options
  const voiceStyle = getVoiceStyle(voiceName)
  const variationToken = makeNonce(6)

  const allowedStyles = Object.entries(AVATAR_STYLES)
    .map(([id, meta]) => `${id} (${meta.label})`)
    .join(", ")

  const prompt = [
    "You are selecting a prebuilt avatar icon style + seed.",
    "This is NOT image generation. You must choose from the provided styles.",
    "",
    `Context:`,
    `- accentColor: ${accentColor}`,
    `- coachVoiceName: ${voiceName}`,
    `- coachVoiceStyle: ${voiceStyle}`,
    `- variationToken: ${variationToken} (use this to make each pick unique)`,
    "",
    `Allowed styles: ${allowedStyles}`,
    "",
    "Return JSON only with this exact shape:",
    '{"styleId":"<one allowed styleId>","seed":"<3-6 lowercase words separated by hyphens>"}',
  ].join("\n")

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4500)

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 120,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      }
    )

    if (!response.ok) return null

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== "string") return null

    const parsed = parseGeminiJson<{ styleId?: unknown; seed?: unknown }>(text)

    const styleId = typeof parsed?.styleId === "string" ? parsed.styleId.trim() : ""
    const seed = typeof parsed?.seed === "string" ? sanitizeSeed(parsed.seed) : ""

    if (!isAvatarStyleId(styleId)) return null
    if (!seed) return null

    return { styleId, seed }
  } catch {
    // If Gemini fails (network, quota, etc) we silently fall back.
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export interface AvatarGenerationResult {
  /**
   * Avatar image string.
   *
   * Historically this was a base64 PNG (no data: prefix).
   * We now support returning a full SVG data URI (recommended).
   */
  imageBase64: string | null
  /** MIME type of the generated image */
  mimeType: string | null
  /** Any text response from the model (for debugging) */
  textResponse: string | null
  /** Error message if generation failed */
  error: string | null
}

/**
 * Generate a coach avatar.
 *
 * - Always works offline via DiceBear.
 * - Optionally uses Gemini 3 Flash (free tier) to pick a style + seed.
 */
export async function generateCoachAvatar(
  accentColor: string,
  voiceName: GeminiVoice
): Promise<AvatarGenerationResult> {
  try {
    const fallbackStyleId = pickFallbackStyleId(voiceName)
    const fallbackSeed = sanitizeSeed(`kanari-coach-${voiceName}-${makeNonce(10)}`)

    const apiKey = await getGeminiApiKey()
    const recipe = apiKey
      ? await suggestRecipeWithGemini({ apiKey, accentColor, voiceName })
      : null

    const styleId = recipe?.styleId ?? fallbackStyleId
    const seed = recipe?.seed ?? fallbackSeed

    const backgroundA = generateDarkVariant(accentColor)
    const backgroundB = accentColor

    logDebug("avatar-client", `Generating DiceBear avatar style=${styleId} seed=${seed}`)

    const avatar = createAvatar(AVATAR_STYLES[styleId].style, {
      seed,
      size: 512,
      backgroundType: ["gradientLinear"],
      backgroundColor: [backgroundA, backgroundB],
    })

    const dataUri = avatar.toDataUri()

    return {
      imageBase64: dataUri,
      mimeType: "image/svg+xml",
      textResponse: recipe ? `gemini: ${styleId}` : `fallback: ${styleId}`,
      error: null,
    }
  } catch (err) {
    logError("avatar-client", "Avatar generation failed", err)
    const message = err instanceof Error ? err.message : "Unknown error during avatar generation"

    return {
      imageBase64: null,
      mimeType: null,
      textResponse: null,
      error: `Avatar generation failed: ${message}`,
    }
  }
}

/**
 * Validate that an avatar string looks usable.
 * Supports both:
 * - SVG data URIs (preferred)
 * - raw base64 strings (legacy PNG path)
 */
export function isValidBase64Image(value: string): boolean {
  if (!value || typeof value !== "string") return false

  if (value.startsWith("data:image/")) {
    return value.length > 50
  }

  // Legacy base64 (no data: prefix)
  if (value.length < 100) return false
  const base64Regex = /^[A-Za-z0-9+/=]+$/
  return base64Regex.test(value)
}
