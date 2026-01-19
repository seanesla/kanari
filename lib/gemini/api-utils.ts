import { db } from '@/lib/storage/db'

/**
 * Get the Gemini API key from IndexedDB settings.
 * Returns undefined if no key is stored.
 * This is used client-side to add the key to API request headers.
 */
export async function getGeminiApiKey(): Promise<string | undefined> {
  try {
    const settings = await db.settings.get("default")
    return settings?.geminiApiKey
  } catch (error) {
    console.error("Failed to get Gemini API key from settings:", error)
    return undefined
  }
}

/**
 * Create headers object with Gemini API key if available.
 * Merges with any existing headers provided.
 */
export async function createGeminiHeaders(
  existingHeaders?: HeadersInit
): Promise<HeadersInit> {
  const apiKey = await getGeminiApiKey()
  const headers: Record<string, string> = {}

  // Copy existing headers
  if (existingHeaders) {
    if (existingHeaders instanceof Headers) {
      existingHeaders.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(existingHeaders)) {
      existingHeaders.forEach(([key, value]) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, existingHeaders)
    }
  }

  // Add API key header if available.
  // Note: demo mode seeds a placeholder key ("DEMO_MODE") to avoid forcing judges
  // through Settings during a demo. That value is intentionally NOT a real Gemini key,
  // so we should not forward it to server routes (it triggers noisy 401s).
  if (apiKey && apiKey !== "DEMO_MODE") {
    headers["X-Gemini-Api-Key"] = apiKey
  }

  return headers
}
