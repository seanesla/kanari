// @vitest-environment jsdom

import { describe, it, expect } from "vitest"
import {
  getStepsForGuide,
  FIRST_TIME_STEPS,
  DEMO_STEPS,
} from "../guidance-steps"

describe("guidance-steps", () => {
  it("returns first-time steps for 'first-time' guide type", () => {
    const steps = getStepsForGuide("first-time")
    expect(steps).toBe(FIRST_TIME_STEPS)
    expect(steps.length).toBeGreaterThan(0)
  })

  it("returns demo steps for 'demo' guide type", () => {
    const steps = getStepsForGuide("demo")
    expect(steps).toBe(DEMO_STEPS)
    expect(steps.length).toBeGreaterThan(0)
  })

  it("every step has an id, title, and message", () => {
    for (const step of [...FIRST_TIME_STEPS, ...DEMO_STEPS]) {
      expect(step.id).toBeTruthy()
      expect(step.title).toBeTruthy()
      expect(step.message).toBeTruthy()
    }
  })

  it("all step ids are unique", () => {
    const allIds = [...FIRST_TIME_STEPS, ...DEMO_STEPS].map((s) => s.id)
    expect(new Set(allIds).size).toBe(allIds.length)
  })
})
