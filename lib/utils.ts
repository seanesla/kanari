import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSafariUserAgent(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")
  if (!ua) return false

  const isAppleWebKit = /AppleWebKit\//.test(ua)
  const isSafariLike = /Safari\//.test(ua)
  const isChromiumLike = /Chrome\//.test(ua) || /Chromium\//.test(ua) || /Edg\//.test(ua) || /OPR\//.test(ua)
  const isOtherIosBrowser = /CriOS\//.test(ua) || /FxiOS\//.test(ua) || /EdgiOS\//.test(ua)

  // Safari on iOS/macOS includes "Safari" and "AppleWebKit" but not Chromium tokens.
  return isAppleWebKit && isSafariLike && !isChromiumLike && !isOtherIosBrowser
}

type ViewTransitionLike = {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition?: () => void
}

export function applySafariViewTransitionFix(): boolean {
  if (typeof document === "undefined") return false
  if (!isSafariUserAgent()) return false

  const anyDoc = document as unknown as {
    startViewTransition?: ((updateCallback: () => void | Promise<void>) => ViewTransitionLike) & {
      __kanariPatched?: boolean
      __kanariOriginal?: unknown
    }
  }

  if (typeof anyDoc.startViewTransition !== "function") return false
  if (anyDoc.startViewTransition.__kanariPatched) return true

  const original = anyDoc.startViewTransition
  anyDoc.startViewTransition = ((updateCallback: () => void | Promise<void>) => {
    // Safari's native implementation has been unstable around portals/overlays.
    // This shim runs the callback immediately and resolves transition promises.
    let callbackResult: void | Promise<void>
    try {
      callbackResult = updateCallback()
    } catch (error) {
      const rejected = Promise.reject(error)
      return {
        ready: Promise.resolve(),
        finished: rejected,
        updateCallbackDone: rejected,
        skipTransition: () => {},
      }
    }

    const updateCallbackDone = Promise.resolve(callbackResult)
    const ready = Promise.resolve()
    const finished = updateCallbackDone.then(() => undefined)

    return {
      ready,
      finished,
      updateCallbackDone,
      skipTransition: () => {},
    }
  }) as typeof original

  anyDoc.startViewTransition.__kanariPatched = true
  anyDoc.startViewTransition.__kanariOriginal = original

  return true
}

// Re-export Gemini utilities for backwards compatibility
// Import from @/lib/gemini/api-utils for new code
export { getGeminiApiKey, createGeminiHeaders } from "@/lib/gemini/api-utils"
