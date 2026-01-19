// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { applySafariViewTransitionFix, isSafariUserAgent } from "../utils"

type StartViewTransition = (callback: () => void | Promise<void>) => {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: StartViewTransition
}

const safariUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15"
const chromeUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"

const setUserAgent = (value: string) => {
  Object.defineProperty(window.navigator, "userAgent", {
    value,
    configurable: true,
  })
}

describe("isSafariUserAgent", () => {
  it("detects Safari", () => {
    expect(isSafariUserAgent(safariUserAgent)).toBe(true)
  })

  it("ignores Chrome", () => {
    expect(isSafariUserAgent(chromeUserAgent)).toBe(false)
  })
})

describe("applySafariViewTransitionFix", () => {
  const originalUserAgent = window.navigator.userAgent
  let originalStartViewTransition: DocumentWithViewTransition["startViewTransition"]

  beforeEach(() => {
    originalStartViewTransition = (document as DocumentWithViewTransition).startViewTransition
  })

  afterEach(() => {
    setUserAgent(originalUserAgent)

    const doc = document as DocumentWithViewTransition
    if (originalStartViewTransition) {
      Object.defineProperty(doc, "startViewTransition", {
        value: originalStartViewTransition,
        configurable: true,
        writable: true,
      })
    } else {
      delete (doc as Partial<DocumentWithViewTransition>).startViewTransition
    }
  })

  it("stubs startViewTransition on Safari", async () => {
    setUserAgent(safariUserAgent)

    const native = vi.fn((callback: () => void | Promise<void>) => {
      void callback()
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      }
    })

    Object.defineProperty(document, "startViewTransition", {
      value: native,
      configurable: true,
      writable: true,
    })

    const cleanup = applySafariViewTransitionFix()
    const doc = document as DocumentWithViewTransition

    expect(typeof cleanup).toBe("function")
    expect(doc.startViewTransition).not.toBe(native)

    const callback = vi.fn()
    const transition = doc.startViewTransition?.(() => callback())
    await transition?.updateCallbackDone

    expect(callback).toHaveBeenCalled()

    cleanup?.()
    expect(doc.startViewTransition).toBe(native)
  })

  it("keeps native startViewTransition on non-Safari", () => {
    setUserAgent(chromeUserAgent)

    const native = vi.fn((callback: () => void | Promise<void>) => {
      void callback()
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      }
    })

    Object.defineProperty(document, "startViewTransition", {
      value: native,
      configurable: true,
      writable: true,
    })

    const cleanup = applySafariViewTransitionFix()
    const doc = document as DocumentWithViewTransition

    expect(cleanup).toBeNull()
    expect(doc.startViewTransition).toBe(native)
  })
})
