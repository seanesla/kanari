/**
 * @vitest-environment jsdom
 */

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { AudioFeatures, CheckInSession } from "@/lib/types"
import { VoiceBiomarkerReport } from "../voice-biomarker-report"

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

vi.mock("@/lib/storage/db", () => ({
  db: {
    settings: {
      get: vi.fn(async () => null),
    },
  },
}))

function hasClassToken(container: HTMLElement, token: string): boolean {
  return Array.from(container.querySelectorAll("*")).some(
    (element) => typeof element.className === "string" && element.className.includes(token)
  )
}

const metrics: NonNullable<CheckInSession["acousticMetrics"]> = {
  stressScore: 61,
  fatigueScore: 69,
  stressLevel: "moderate",
  fatigueLevel: "tired",
  confidence: 0.81,
  features: {
    speechRate: 4.1,
    pauseRatio: 0.22,
    rms: 0.045,
    pitchMean: 196,
    pitchStdDev: 28,
    pitchRange: 142,
    spectralCentroid: 0.41,
    spectralFlux: 0.33,
    zcr: 0.09,
    pauseCount: 9,
    avgPauseDuration: 180,
    mfcc: [0.4, -0.2, 0.15, -0.08, 0.11, -0.06, 0.04, -0.03, 0.02, -0.01, 0.01, -0.01],
  } as AudioFeatures,
} as NonNullable<CheckInSession["acousticMetrics"]>

describe("VoiceBiomarkerReport mobile overflow safety", () => {
  it("uses mobile-safe overflow and wrapping classes in technical details", () => {
    const { container } = render(
      <VoiceBiomarkerReport metrics={metrics} state="final" defaultExpanded />
    )

    expect(hasClassToken(container, "overflow-y-hidden")).toBe(true)
    expect(hasClassToken(container, "overflow-x-auto")).toBe(true)
    expect(hasClassToken(container, "[&_th]:whitespace-normal")).toBe(true)
    expect(hasClassToken(container, "sm:[&_th]:whitespace-nowrap")).toBe(true)
  })
})
