import { describe, it, expect } from "vitest"
import { checkRateLimit, getClientIp } from "../rate-limit"

describe("rate-limit", () => {
  it("extracts client ip from x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.10, 203.0.113.11" },
    })

    expect(getClientIp(request)).toBe("203.0.113.10")
  })

  it("enforces a fixed window limit", () => {
    const key = `test:${Math.random()}`

    const first = checkRateLimit({ key, limit: 2, windowMs: 1000, nowMs: 0 })
    expect(first.allowed).toBe(true)
    expect(first.remaining).toBe(1)

    const second = checkRateLimit({ key, limit: 2, windowMs: 1000, nowMs: 10 })
    expect(second.allowed).toBe(true)
    expect(second.remaining).toBe(0)

    const third = checkRateLimit({ key, limit: 2, windowMs: 1000, nowMs: 20 })
    expect(third.allowed).toBe(false)
    expect(third.remaining).toBe(0)

    // Window resets
    const fourth = checkRateLimit({ key, limit: 2, windowMs: 1000, nowMs: 1000 })
    expect(fourth.allowed).toBe(true)
  })
})
