import { describe, expect, it, vi } from "vitest"
import { extractDateISOFromText } from "@/lib/scheduling/date"

describe("scheduling/date", () => {
  it("extracts explicit ISO dates", () => {
    expect(extractDateISOFromText("Schedule on 2026-01-10", "UTC")).toBe("2026-01-10")
  })

  it("resolves today/tomorrow/tonight in the provided time zone", () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-01-09T21:54:16Z"))

      expect(extractDateISOFromText("today", "UTC")).toBe("2026-01-09")
      expect(extractDateISOFromText("tonight", "UTC")).toBe("2026-01-09")
      expect(extractDateISOFromText("tomorrow", "UTC")).toBe("2026-01-10")

      // 2026-01-10T06:30Z is still 2026-01-09 in America/Los_Angeles.
      vi.setSystemTime(new Date("2026-01-10T06:30:00Z"))
      expect(extractDateISOFromText("today", "America/Los_Angeles")).toBe("2026-01-09")
      expect(extractDateISOFromText("tomorrow", "America/Los_Angeles")).toBe("2026-01-10")
    } finally {
      vi.useRealTimers()
    }
  })
})
