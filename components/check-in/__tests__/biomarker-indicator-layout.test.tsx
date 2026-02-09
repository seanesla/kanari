/**
 * @vitest-environment jsdom
 */

import React from "react"
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { AudioFeatures, CheckInSession } from "@/lib/types"
import { BiomarkerIndicator } from "../biomarker-indicator"

const metrics: NonNullable<CheckInSession["acousticMetrics"]> = {
  stressScore: 62,
  fatigueScore: 58,
  stressLevel: "moderate",
  fatigueLevel: "normal",
  confidence: 0.82,
  features: {} as AudioFeatures,
}

function hasClassToken(container: HTMLElement, token: string): boolean {
  return Array.from(container.querySelectorAll("div")).some(
    (element) => typeof element.className === "string" && element.className.includes(token)
  )
}

describe("BiomarkerIndicator mobile layout", () => {
  it("uses one column on mobile and two columns from small breakpoint", () => {
    const { container } = render(<BiomarkerIndicator metrics={metrics} />)

    expect(hasClassToken(container, "grid-cols-1 sm:grid-cols-2")).toBe(true)
  })

  it("stays single-column in compact mode", () => {
    const { container } = render(<BiomarkerIndicator metrics={metrics} compact />)

    expect(hasClassToken(container, "grid-cols-1 sm:grid-cols-2")).toBe(false)
    expect(hasClassToken(container, "grid-cols-1")).toBe(true)
  })
})
