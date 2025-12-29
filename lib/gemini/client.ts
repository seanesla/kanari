/**
 * Gemini API client
 *
 * Server-side wrapper for calling Google's Gemini API.
 * Used exclusively in API routes (never client-side).
 */

import type { GeminiSemanticAnalysis } from "@/lib/types"
import { AUDIO_SEMANTIC_PROMPT, AUDIO_SEMANTIC_SCHEMA } from "./prompts"

export interface GeminiRequest {
  contents: Array<{
    role: "user" | "model"
    parts: Array<{
      text?: string
      inlineData?: {
        mimeType: string
        data: string
      }
    }>
  }>
  systemInstruction?: {
    parts: Array<{
      text: string
    }>
  }
  generationConfig?: {
    temperature?: number
    topK?: number
    topP?: number
    maxOutputTokens?: number
    responseMimeType?: string
    responseSchema?: object
  }
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
      role: string
    }
    finishReason: string
    index: number
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export interface GeminiSuggestionRaw {
  content: string
  rationale: string
  duration: number
  category: "break" | "exercise" | "mindfulness" | "social" | "rest"
}

/**
 * Call Gemini API with request payload
 *
 * @param apiKey - Gemini API key (from environment)
 * @param request - Gemini request object
 * @returns Gemini API response
 */
export async function callGeminiAPI(apiKey: string, request: GeminiRequest): Promise<GeminiResponse> {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${errorText}`)
  }

  return response.json()
}

/**
 * Generate wellness suggestions using Gemini
 *
 * @param apiKey - Gemini API key
 * @param systemPrompt - System instruction for Gemini
 * @param userPrompt - User prompt with wellness data
 * @returns Array of raw suggestion objects
 */
export async function generateSuggestions(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GeminiSuggestionRaw[]> {
  const request: GeminiRequest = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.8, // Slightly creative for varied suggestions
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048, // Increased for Gemini 3's thinking tokens
      responseMimeType: "application/json", // Request JSON response
    },
  }

  const response = await callGeminiAPI(apiKey, request)

  // Extract text from first candidate
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("No response from Gemini API")
  }

  const text = response.candidates[0].content.parts[0].text

  // Parse JSON response
  try {
    const suggestions = JSON.parse(text) as GeminiSuggestionRaw[]

    // Validate structure
    if (!Array.isArray(suggestions)) {
      throw new Error("Response is not an array")
    }

    // Validate each suggestion
    for (const suggestion of suggestions) {
      if (
        typeof suggestion.content !== "string" ||
        typeof suggestion.rationale !== "string" ||
        typeof suggestion.duration !== "number" ||
        !["break", "exercise", "mindfulness", "social", "rest"].includes(suggestion.category)
      ) {
        throw new Error("Invalid suggestion structure")
      }
    }

    return suggestions
  } catch (error) {
    throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Validate API key format
 */
export function validateAPIKey(apiKey: string | undefined): string {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set")
  }

  if (!apiKey.startsWith("AIza")) {
    throw new Error("Invalid Gemini API key format")
  }

  return apiKey
}

/**
 * Analyze audio for semantic content and emotion
 *
 * @param apiKey - Gemini API key
 * @param audioBase64 - Base64-encoded audio data
 * @param mimeType - Audio MIME type (e.g., "audio/wav", "audio/webm")
 * @returns Semantic analysis with transcription, emotions, and observations
 */
export async function analyzeAudioSemantic(
  apiKey: string,
  audioBase64: string,
  mimeType: string
): Promise<GeminiSemanticAnalysis> {
  const request: GeminiRequest = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          {
            text: AUDIO_SEMANTIC_PROMPT,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3, // Lower temperature for more consistent analysis
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: AUDIO_SEMANTIC_SCHEMA,
    },
  }

  const response = await callGeminiAPI(apiKey, request)

  // Extract text from first candidate
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("No response from Gemini API")
  }

  const text = response.candidates[0].content.parts[0].text

  // Parse JSON response
  try {
    const analysis = JSON.parse(text) as GeminiSemanticAnalysis

    // Validate structure
    if (!analysis.segments || !Array.isArray(analysis.segments)) {
      throw new Error("Missing or invalid segments array")
    }

    if (!analysis.overallEmotion || typeof analysis.emotionConfidence !== "number") {
      throw new Error("Missing or invalid emotion data")
    }

    if (!analysis.observations || !Array.isArray(analysis.observations)) {
      throw new Error("Missing or invalid observations array")
    }

    if (!analysis.stressInterpretation || !analysis.fatigueInterpretation || !analysis.summary) {
      throw new Error("Missing required interpretation fields")
    }

    // Validate segments
    for (const segment of analysis.segments) {
      if (!segment.timestamp || !segment.content || !segment.emotion) {
        throw new Error("Invalid segment structure")
      }
    }

    // Validate observations
    for (const obs of analysis.observations) {
      if (!obs.type || !obs.observation || !obs.relevance) {
        throw new Error("Invalid observation structure")
      }
    }

    return analysis
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini audio semantic response: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}
