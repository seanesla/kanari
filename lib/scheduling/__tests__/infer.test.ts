import { describe, expect, it } from "vitest"
import { inferScheduleCategory, inferScheduleTitle, isScheduleRequest } from "@/lib/scheduling/infer"

describe("scheduling/infer", () => {
  it("detects schedule requests using a word boundary", () => {
    expect(isScheduleRequest("Please schedule a break")).toBe(true)
    expect(isScheduleRequest("SCHEDULE: a break")).toBe(true)
    expect(isScheduleRequest("Please reschedule this")).toBe(false)
  })

  it("infers a category from keywords", () => {
    expect(inferScheduleCategory("go for a walk")).toBe("exercise")
    expect(inferScheduleCategory("let's meditate")).toBe("mindfulness")
    expect(inferScheduleCategory("meeting with Alex")).toBe("social")
    expect(inferScheduleCategory("rest"))
      // Default
      .toBe("rest")
  })

  it("prefers quoted titles", () => {
    expect(inferScheduleTitle('Schedule "Doctor" today')).toBe("Doctor")
  })
})
