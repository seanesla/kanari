/**
 * @vitest-environment jsdom
 */

/* eslint-disable @next/next/no-img-element */

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
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

describe("SynthesisScreen", () => {
  it("shows an animated loading state while synthesizing, then hides it on error", () => {
    const { rerender } = render(
      <SynthesisScreen session={null} synthesis={null} isLoading error={null} onDone={() => {}} onViewDashboard={() => {}} />
    )

    expect(screen.getByText("Synthesizing your check-in...")).toBeInTheDocument()
    expect(screen.getByLabelText("Loading")).toBeInTheDocument()

    rerender(
      <SynthesisScreen
        session={null}
        synthesis={null}
        isLoading={false}
        error="Synthesis failed"
        onDone={() => {}}
        onViewDashboard={() => {}}
      />
    )

    expect(screen.queryByText("Synthesizing your check-in...")).not.toBeInTheDocument()
    expect(screen.getByText("Synthesis unavailable")).toBeInTheDocument()
    expect(screen.getByText("Synthesis failed")).toBeInTheDocument()
  })
})
