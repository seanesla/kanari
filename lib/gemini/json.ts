/**
 * Helpers for parsing structured JSON returned by Gemini.
 *
 * Even when using `responseMimeType: "application/json"` + `responseSchema`,
 * models may occasionally wrap JSON in Markdown fences or include extra text.
 * These utilities aim to robustly extract and parse the JSON payload.
 */

function stripMarkdownCodeFences(text: string): string {
  const trimmed = text.trim()

  // ```json\n{...}\n```  OR  ```\n{...}\n```
  if (!trimmed.startsWith("```")) return trimmed

  // Remove opening fence (optionally with "json" language id)
  const withoutOpen = trimmed.replace(/^```(?:json)?\s*/i, "")

  // Remove closing fence
  return withoutOpen.replace(/\s*```$/, "").trim()
}

function extractJsonSubstring(text: string): string | null {
  const trimmed = text.trim()
  const firstObject = trimmed.indexOf("{")
  const firstArray = trimmed.indexOf("[")

  if (firstObject === -1 && firstArray === -1) return null

  const startsWithArray = firstArray !== -1 && (firstObject === -1 || firstArray < firstObject)
  const start = startsWithArray ? firstArray : firstObject
  const endChar = startsWithArray ? "]" : "}"
  const end = trimmed.lastIndexOf(endChar)

  if (end === -1 || end <= start) return null
  return trimmed.slice(start, end + 1)
}

export function parseGeminiJson<T>(rawText: string): T {
  const cleaned = stripMarkdownCodeFences(rawText)

  try {
    return JSON.parse(cleaned) as T
  } catch (error) {
    const extracted = extractJsonSubstring(cleaned)
    if (extracted) {
      return JSON.parse(extracted) as T
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    throw new Error(`Gemini response parse error: ${message}`)
  }
}

