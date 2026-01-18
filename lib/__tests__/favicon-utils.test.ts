// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest"

describe("favicon-utils", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("creates a dynamic favicon link and uses a data URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        // Minimal SVG that matches the production icon's fill pattern.
        new Response('<svg width="10" height="10"><path style="fill:#f9f9f9" d="M0 0" /></svg>', {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        })
      )
    )

    const { updateFavicon } = await import("@/lib/favicon-utils")

    updateFavicon("#ff0000")

    // Wait for the async fetch + DOM update.
    await new Promise((r) => setTimeout(r, 0))

    const link = document.head.querySelector<HTMLLinkElement>('link[data-dynamic-favicon="true"]')
    expect(link).toBeTruthy()
    expect(link?.rel).toBe("icon")
    expect(link?.href).toContain("data:image/svg+xml,")
    expect(decodeURIComponent(link!.href.split(",")[1])).toContain("#ff0000")
  })

  it("falls back to /icon.svg when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network")
      })
    )

    const { updateFavicon } = await import("@/lib/favicon-utils")

    updateFavicon("#00ff00")
    await new Promise((r) => setTimeout(r, 0))

    const link = document.head.querySelector<HTMLLinkElement>('link[data-dynamic-favicon="true"]')
    expect(link).toBeTruthy()
    expect(link?.href).toMatch(/\/icon\.svg$/)
  })
})
