/**
 * Gemini TTS Voice Constants
 *
 * Available prebuilt voices for the Gemini Live API.
 * Source: Context7 - /websites/ai_google_dev_gemini-api docs - "Speech generation"
 * https://ai.google.dev/gemini-api/docs/speech-generation
 */

import type { GeminiVoice } from "@/lib/types"

export interface VoiceInfo {
  name: GeminiVoice
  style: string
}

/**
 * All 30 available Gemini TTS voices with their style descriptors.
 * Sorted alphabetically for easier UI display.
 */
export const GEMINI_VOICES: VoiceInfo[] = [
  { name: "Achernar", style: "Soft" },
  { name: "Achird", style: "Friendly" },
  { name: "Algenib", style: "Gravelly" },
  { name: "Algieba", style: "Smooth" },
  { name: "Alnilam", style: "Firm" },
  { name: "Aoede", style: "Breezy" },
  { name: "Autonoe", style: "Bright" },
  { name: "Callirrhoe", style: "Easy-going" },
  { name: "Charon", style: "Informative" },
  { name: "Despina", style: "Smooth" },
  { name: "Enceladus", style: "Breathy" },
  { name: "Erinome", style: "Clear" },
  { name: "Fenrir", style: "Excitable" },
  { name: "Gacrux", style: "Mature" },
  { name: "Iapetus", style: "Clear" },
  { name: "Kore", style: "Firm" },
  { name: "Laomedeia", style: "Upbeat" },
  { name: "Leda", style: "Youthful" },
  { name: "Orus", style: "Firm" },
  { name: "Puck", style: "Upbeat" },
  { name: "Pulcherrima", style: "Forward" },
  { name: "Rasalgethi", style: "Informative" },
  { name: "Sadachbia", style: "Lively" },
  { name: "Sadaltager", style: "Knowledgeable" },
  { name: "Schedar", style: "Even" },
  { name: "Sulafat", style: "Warm" },
  { name: "Umbriel", style: "Easy-going" },
  { name: "Vindemiatrix", style: "Gentle" },
  { name: "Zephyr", style: "Bright" },
  { name: "Zubenelgenubi", style: "Casual" },
]

/**
 * Get the style descriptor for a voice name.
 */
export function getVoiceStyle(voiceName: GeminiVoice): string {
  const voice = GEMINI_VOICES.find((v) => v.name === voiceName)
  return voice?.style ?? "Unknown"
}

/**
 * Check if a string is a valid Gemini voice name.
 */
export function isValidGeminiVoice(name: string): name is GeminiVoice {
  return GEMINI_VOICES.some((v) => v.name === name)
}

/**
 * Get the preview audio URL for a voice.
 * Voice samples are stored as static WAV files in /voices/{name}.wav
 */
export function getVoicePreviewUrl(voiceName: GeminiVoice): string {
  return `/voices/${voiceName.toLowerCase()}.wav`
}
