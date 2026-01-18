/**
 * Avatar Generation Client
 *
 * Uses Gemini's multimodal image generation to create personalized coach avatars.
 * The avatar is abstract/minimalist (no human faces), uses the user's accent color,
 * and reflects the selected voice's personality.
 *
 * Source: Context7 - /googleapis/js-genai docs - "Generate Multimodal Image Outputs"
 */

import { GoogleGenAI } from "@google/genai"
import { getGeminiApiKey } from "./api-utils"
import { getVoiceStyle, type VoiceInfo } from "./voices"
import type { GeminiVoice } from "@/lib/types"
import { logDebug, logError } from "@/lib/logger"

// Model that supports image generation
// Source: Context7 - /websites/ai_google_dev_gemini-api docs - "Gemini 2.5 Flash Image Model"
const IMAGE_GENERATION_MODEL = "gemini-2.5-flash-image"

/**
 * Voice personality descriptions for avatar generation prompts.
 * Maps voice style descriptors to personality traits for the avatar.
 */
const VOICE_PERSONALITY_MAP: Record<string, string> = {
  // Energetic personalities
  Bright: "vibrant, energetic, radiating positivity",
  Upbeat: "cheerful, optimistic, encouraging",
  Excitable: "dynamic, enthusiastic, spirited",
  Lively: "animated, vivacious, full of life",
  Forward: "bold, confident, progressive",

  // Calm personalities
  Soft: "gentle, soothing, peaceful",
  Warm: "nurturing, comforting, welcoming",
  Gentle: "tender, caring, delicate",
  Breezy: "light, carefree, relaxed",
  "Easy-going": "laid-back, approachable, casual",

  // Professional personalities
  Informative: "knowledgeable, clear, helpful",
  Knowledgeable: "wise, insightful, expert",
  Firm: "steady, reliable, grounded",
  Clear: "precise, articulate, transparent",
  Even: "balanced, composed, steady",
  Mature: "experienced, thoughtful, seasoned",

  // Friendly personalities
  Friendly: "approachable, amiable, personable",
  Youthful: "fresh, playful, spirited",
  Casual: "relaxed, informal, conversational",

  // Expressive personalities
  Smooth: "flowing, elegant, refined",
  Breathy: "intimate, ethereal, expressive",
  Gravelly: "textured, deep, resonant",
}

/**
 * Get personality description for a voice.
 */
function getVoicePersonality(voiceName: GeminiVoice): string {
  const style = getVoiceStyle(voiceName)
  return VOICE_PERSONALITY_MAP[style] || "balanced, supportive, understanding"
}

/**
 * Build the avatar generation prompt.
 * Creates an abstract/minimalist avatar that reflects the accent color and voice personality.
 */
function buildAvatarPrompt(accentColor: string, voiceName: GeminiVoice): string {
  const personality = getVoicePersonality(voiceName)
  const voiceStyle = getVoiceStyle(voiceName)

  return `Create an abstract, minimalist avatar icon for a wellness coaching AI assistant.

REQUIREMENTS:
- Abstract geometric or organic shape - NO human faces, NO realistic features
- Circular composition that works well as a profile avatar
- Primary color: ${accentColor} (the user's chosen accent color)
- The design should evoke: ${personality}
- Style inspiration: ${voiceStyle.toLowerCase()} energy
- Clean, modern aesthetic suitable for a wellness app
- Soft gradients and subtle glow effects are encouraged
- Should feel calming and supportive
- High contrast for visibility on dark backgrounds

OUTPUT:
- Square image, 512x512 pixels
- PNG format with transparency if possible
- Single cohesive design element, not multiple objects`
}

export interface AvatarGenerationResult {
  /** Base64-encoded PNG image data (no data: prefix) */
  imageBase64: string | null
  /** MIME type of the generated image */
  mimeType: string | null
  /** Any text response from the model (for debugging) */
  textResponse: string | null
  /** Error message if generation failed */
  error: string | null
}

/**
 * Generate a coach avatar using Gemini's image generation.
 *
 * @param accentColor - The user's chosen accent color (hex string like "#d4a574")
 * @param voiceName - The selected voice name (used for personality traits)
 * @returns Generated avatar data or error
 */
export async function generateCoachAvatar(
  accentColor: string,
  voiceName: GeminiVoice
): Promise<AvatarGenerationResult> {
  try {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) {
      return {
        imageBase64: null,
        mimeType: null,
        textResponse: null,
        error: "No Gemini API key configured. Please add your API key in Settings.",
      }
    }

    logDebug("avatar-client", `Generating avatar for voice=${voiceName}, color=${accentColor}`)

    const ai = new GoogleGenAI({ apiKey })
    const prompt = buildAvatarPrompt(accentColor, voiceName)

    logDebug("avatar-client", `Prompt: ${prompt}`)

    // Use the interactions API for image generation
    // Source: Context7 - /googleapis/js-genai docs - "Generate Multimodal Image Outputs"
    const interaction = await ai.interactions.create({
      model: IMAGE_GENERATION_MODEL,
      input: prompt,
      response_modalities: ["image"],
    })

    let imageBase64: string | null = null
    let mimeType: string | null = null
    let textResponse: string | null = null

    // Process outputs
    if (interaction.outputs) {
      for (const output of interaction.outputs) {
        if (output.type === "image" && output.data) {
          imageBase64 = output.data
          mimeType = output.mime_type || "image/png"
          logDebug("avatar-client", `Generated image mimeType=${mimeType}, dataLength=${imageBase64.length}`)
        } else if (output.type === "text" && output.text) {
          textResponse = output.text
          logDebug("avatar-client", `Text response: ${textResponse}`)
        }
      }
    }

    if (!imageBase64) {
      return {
        imageBase64: null,
        mimeType: null,
        textResponse,
        error: "No image was generated. The model may not support image output or the request was filtered.",
      }
    }

    return {
      imageBase64,
      mimeType,
      textResponse,
      error: null,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error during avatar generation"
    logError("avatar-client", "Avatar generation failed", err)

    // Check for specific error types
    if (errorMessage.includes("API key")) {
      return {
        imageBase64: null,
        mimeType: null,
        textResponse: null,
        error: "Invalid API key. Please check your Gemini API key in Settings.",
      }
    }

    if (errorMessage.includes("quota") || errorMessage.includes("rate")) {
      return {
        imageBase64: null,
        mimeType: null,
        textResponse: null,
        error: "API quota exceeded. Please try again later.",
      }
    }

    if (errorMessage.includes("filtered") || errorMessage.includes("safety")) {
      return {
        imageBase64: null,
        mimeType: null,
        textResponse: null,
        error: "The request was filtered by content safety. Please try regenerating.",
      }
    }

    return {
      imageBase64: null,
      mimeType: null,
      textResponse: null,
      error: `Avatar generation failed: ${errorMessage}`,
    }
  }
}

/**
 * Validate that a base64 string is a valid image.
 * Does basic validation without fully decoding.
 */
export function isValidBase64Image(base64: string): boolean {
  if (!base64 || typeof base64 !== "string") return false
  // Check minimum length for a valid image
  if (base64.length < 100) return false
  // Check for valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/=]+$/
  return base64Regex.test(base64)
}
