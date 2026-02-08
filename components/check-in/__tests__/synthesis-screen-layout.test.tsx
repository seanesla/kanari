/**
 * @vitest-environment jsdom
 */

/* eslint-disable @next/next/no-img-element */

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CheckInSession } from "@/lib/types"
import { SynthesisScreen } from "../synthesis-screen"

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}))

vi.mock("@/lib/storage/db", () => ({
  db: {
    checkInSessions: { update: vi.fn(async () => 1) },
    settings: { get: vi.fn(async () => null) },
  },
}))

vi.mock("@/lib/settings/patch-settings", () => ({
  patchSettings: vi.fn(async () => {}),
}))

const baseSession: CheckInSession = {
  id: "session-1",
  startedAt: "2026-02-08T20:38:00.000Z",
  endedAt: "2026-02-08T20:42:00.000Z",
  messages: [],
}

function hasClassToken(container: HTMLElement, token: string): boolean {
  return Array.from(container.querySelectorAll("div")).some(
    (element) => typeof element.className === "string" && element.className.includes(token)
  )
}

describe("SynthesisScreen layout", () => {
  it("keeps compact width in default mode", () => {
    const { container } = render(
      <SynthesisScreen session={baseSession} synthesis={null} isLoading={false} error="Synthesis failed" />
    )

    expect(hasClassToken(container, "max-w-2xl")).toBe(true)
    expect(hasClassToken(container, "max-w-6xl")).toBe(false)
  })

  it("uses a wider two-column desktop layout in wide mode", () => {
    const { container } = render(
      <SynthesisScreen
        session={baseSession}
        synthesis={null}
        isLoading={false}
        error="Synthesis failed"
        layout="wide"
      />
    )

    expect(hasClassToken(container, "max-w-6xl")).toBe(true)
    expect(hasClassToken(container, "lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]")).toBe(true)
  })
})
