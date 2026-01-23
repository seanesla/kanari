/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest"
import { applySafariViewTransitionFix, isSafariUserAgent } from "@/lib/utils"

function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value,
    configurable: true,
  })
}

describe("view transition Safari shim", () => {
  const originalUserAgent = window.navigator.userAgent

  afterEach(() => {
    setUserAgent(originalUserAgent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).startViewTransition
  })

  it("detects Safari user agents", () => {
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ),
    ).toBe(true)

    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(false)

    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/605.1.15",
      ),
    ).toBe(false)
  })

  it("patches document.startViewTransition on Safari", async () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(document as any).startViewTransition = () => {
      throw new Error("native should not be called")
    }

    const patched = applySafariViewTransitionFix()
    expect(patched).toBe(true)

    let ran = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transition = (document as any).startViewTransition(() => {
      ran = true
    })

    expect(ran).toBe(true)
    await expect(transition.ready).resolves.toBeUndefined()
    await expect(transition.updateCallbackDone).resolves.toBeUndefined()
    await expect(transition.finished).resolves.toBeUndefined()
  })
})
