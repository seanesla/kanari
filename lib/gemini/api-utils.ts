import { db } from "@/lib/storage/db"
import type { GeminiApiKeySource } from "@/lib/types"

const KANARI_ENV_GEMINI_API_KEY = (process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "").trim() || undefined
const GEMINI_KEY_SOURCE_HEADER = "X-Kanari-Gemini-Key-Source"

function shouldSilenceIndexedDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("NoSuchObjectStore") ||
    message.includes("NotFoundError") ||
    message.includes("does not exist") ||
    message.includes("DatabaseClosedError")
  )
}

async function resolveGeminiApiKey(): Promise<{ apiKey?: string; source?: GeminiApiKeySource }> {
  try {
    const settings = await db.settings.get("default")

    const storedKey = settings?.geminiApiKey?.trim() || undefined
    const storedSource = settings?.geminiApiKeySource

    // Demo mode seeds a placeholder key ("DEMO_MODE"). Treat it as "not configured".
    // IMPORTANT: Do NOT automatically fall back to Kanari's env key in this case,
    // otherwise demo mode would unexpectedly burn real quota.
    if (storedKey === "DEMO_MODE") {
      return { apiKey: undefined, source: storedSource }
    }

    if (storedSource === "kanari") {
      return { apiKey: KANARI_ENV_GEMINI_API_KEY, source: "kanari" }
    }

    if (storedSource === "user") {
      return { apiKey: storedKey, source: "user" }
    }

    // Back-compat default (no source stored):
    // - prefer a real user key
    // - otherwise use the deployment-provided key (if present)
    if (storedKey) {
      return { apiKey: storedKey, source: "user" }
    }

    if (KANARI_ENV_GEMINI_API_KEY) {
      return { apiKey: KANARI_ENV_GEMINI_API_KEY, source: "kanari" }
    }

    return { apiKey: undefined, source: undefined }
  } catch (error) {
    if (!shouldSilenceIndexedDbError(error)) {
      console.error("Failed to read Gemini API key settings:", error)
    }

    // If IndexedDB is unavailable, still allow the deployment key to work.
    return KANARI_ENV_GEMINI_API_KEY
      ? { apiKey: KANARI_ENV_GEMINI_API_KEY, source: "kanari" }
      : { apiKey: undefined, source: undefined }
  }
}

/**
 * Get the Gemini API key from IndexedDB settings.
 * Returns undefined if no key is stored.
 * This is used client-side to add the key to API request headers.
 */
export async function getGeminiApiKey(): Promise<string | undefined> {
  const { apiKey } = await resolveGeminiApiKey()
  return apiKey
}

/**
 * Create headers object with Gemini API key if available.
 * Merges with any existing headers provided.
 */
export async function createGeminiHeaders(
  existingHeaders?: HeadersInit
): Promise<HeadersInit> {
  const { apiKey, source } = await resolveGeminiApiKey()
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

  // Include which key source is active so server routes can apply tighter
  // rate limits when running on the shared Kanari key.
  // Add API key header if available.
  if (apiKey) {
    headers["X-Gemini-Api-Key"] = apiKey
    if (source) {
      headers[GEMINI_KEY_SOURCE_HEADER] = source
    }
  }

  return headers
}
