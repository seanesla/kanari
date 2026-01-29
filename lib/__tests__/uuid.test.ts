/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest"

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe("safeRandomUUID", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses crypto.randomUUID when available", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "00000000-0000-4000-8000-000000000000"),
      getRandomValues: vi.fn(),
    })

    const { safeRandomUUID } = await import("@/lib/uuid")
    const id = safeRandomUUID()
    expect(id).toBe("00000000-0000-4000-8000-000000000000")
  })

  it("falls back to getRandomValues when randomUUID is missing", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i
        return arr
      },
    })

    const { safeRandomUUID } = await import("@/lib/uuid")
    const id = safeRandomUUID()
    expect(id).toMatch(UUID_V4_REGEX)
  })

  it("falls back to a non-crypto unique string when crypto is missing", async () => {
    vi.stubGlobal("crypto", undefined)
    const { safeRandomUUID } = await import("@/lib/uuid")
    const id = safeRandomUUID()
    expect(id).toMatch(/^uuid_[0-9a-f]+_[0-9a-f]+$/)
  })
})

