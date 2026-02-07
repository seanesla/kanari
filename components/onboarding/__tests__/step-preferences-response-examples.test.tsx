// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ACCOUNTABILITY_MODE_OPTIONS } from "@/lib/settings/accountability-mode-options"

vi.mock("@/lib/scene-context", () => ({
  useSceneMode: () => ({ accentColor: "#d4a574" }),
}))

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({
    isSupported: true,
    permission: "granted",
    canNotify: true,
    requestPermission: vi.fn(async () => "granted"),
    notify: vi.fn(),
  }),
}))

describe("StepPreferences", () => {
  it("renders static coaching examples in onboarding", async () => {
    const { StepPreferences } = await import("../step-preferences")

    render(
      <StepPreferences
        initialSettings={{}}
        onNext={() => {}}
        onBack={() => {}}
      />
    )

    for (const option of ACCOUNTABILITY_MODE_OPTIONS) {
      expect(screen.getByText(option.label)).toBeInTheDocument()
      expect(screen.getByText(option.description)).toBeInTheDocument()
      expect(screen.getByText(option.exampleResponse)).toBeInTheDocument()
    }
  })
})
