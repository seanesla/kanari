/**
 * Gemini API client
 *
 * Server-side wrapper for calling Google's Gemini API.
 * Used exclusively in API routes (never client-side).
 */

export interface GeminiRequest {
  contents: Array<{
    role: "user" | "model"
    parts: Array<{
      text: string
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
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

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
      maxOutputTokens: 1024,
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
