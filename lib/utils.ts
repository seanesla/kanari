import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSafariUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return false
  return /^((?!chrome|android).)*safari/i.test(userAgent)
}

type ViewTransitionHandle = {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
}

export function applySafariViewTransitionFix(): (() => void) | null {
  if (typeof document === "undefined") return null
  if (!isSafariUserAgent(window?.navigator?.userAgent)) return null

  const doc = document as Document
  const original = doc.startViewTransition

  const safariSafeTransition = ((callback: () => void | Promise<void>) => {
    const runCallback = () => {
      try {
        return Promise.resolve(callback())
      } catch (error) {
        return Promise.reject(error)
      }
    }

    const updateCallbackDone = runCallback()
    const settled = updateCallbackDone.then(() => undefined)

    return {
      ready: settled,
      finished: settled,
      updateCallbackDone,
    } satisfies ViewTransitionHandle
  }) as unknown as typeof document.startViewTransition

  doc.startViewTransition = safariSafeTransition

  return () => {
    if (original) {
      doc.startViewTransition = original
    } else {
      delete (doc as { startViewTransition?: typeof document.startViewTransition }).startViewTransition
    }
  }
}

// Re-export Gemini utilities for backwards compatibility
// Import from @/lib/gemini/api-utils for new code
export { getGeminiApiKey, createGeminiHeaders } from "@/lib/gemini/api-utils"
