import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { formatDuration, formatDate, formatScheduledTime } from "../date-utils"

describe("formatDuration", () => {
  it("formats 0 seconds as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00")
  })

  it("formats seconds less than 60", () => {
    expect(formatDuration(5)).toBe("0:05")
    expect(formatDuration(30)).toBe("0:30")
    expect(formatDuration(59)).toBe("0:59")
  })

  it("formats exactly 60 seconds as 1:00", () => {
    expect(formatDuration(60)).toBe("1:00")
  })

  it("formats minutes and seconds correctly", () => {
    expect(formatDuration(90)).toBe("1:30")
    expect(formatDuration(125)).toBe("2:05")
    expect(formatDuration(3599)).toBe("59:59")
  })

  it("formats hours correctly (as minutes)", () => {
    expect(formatDuration(3600)).toBe("60:00")
    expect(formatDuration(3665)).toBe("61:05")
  })

  it("handles fractional seconds by flooring", () => {
    expect(formatDuration(90.7)).toBe("1:30")
    expect(formatDuration(59.9)).toBe("0:59")
  })
})

describe("formatDate", () => {
  it("formats ISO date string with weekday, month, day, and time", () => {
    const result = formatDate("2024-12-23T15:45:00Z")
    // Result will include weekday, month, day, and time
    // Exact format depends on locale, but should contain key parts
    expect(result).toMatch(/Dec/)
    expect(result).toMatch(/23/)
  })

  it("handles different time zones in ISO string", () => {
    const result = formatDate("2024-06-15T10:30:00-05:00")
    expect(result).toMatch(/Jun/)
    expect(result).toMatch(/15/)
  })
})

describe("formatScheduledTime", () => {
  beforeEach(() => {
    // Mock the current date to 2024-12-24 12:00:00
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-12-24T12:00:00"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns 'Today at [time]' for same day", () => {
    const result = formatScheduledTime("2024-12-24T15:30:00")
    expect(result).toMatch(/Today at/)
    expect(result).toMatch(/3:30/)
  })

  it("returns 'Tomorrow at [time]' for next day", () => {
    const result = formatScheduledTime("2024-12-25T10:00:00")
    expect(result).toMatch(/Tomorrow at/)
    expect(result).toMatch(/10:00/)
  })

  it("returns formatted date for future dates beyond tomorrow", () => {
    const result = formatScheduledTime("2024-12-30T14:00:00")
    expect(result).toMatch(/Dec/)
    expect(result).toMatch(/30/)
    expect(result).toMatch(/at/)
  })

  it("returns formatted date for past dates", () => {
    const result = formatScheduledTime("2024-12-20T09:00:00")
    expect(result).toMatch(/Dec/)
    expect(result).toMatch(/20/)
    expect(result).toMatch(/at/)
  })
})
