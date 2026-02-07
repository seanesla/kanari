// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ACCOUNTABILITY_MODE_OPTIONS } from "@/lib/settings/accountability-mode-options"
import { SettingsAccountabilitySection } from "../settings-accountability-section"

describe("SettingsAccountabilitySection", () => {
  it("renders one static example response for each coaching style", () => {
    render(
      <SettingsAccountabilitySection
        accountabilityMode="balanced"
        onAccountabilityModeChange={() => {}}
      />
    )

    for (const option of ACCOUNTABILITY_MODE_OPTIONS) {
      expect(screen.getByText(option.label)).toBeInTheDocument()
      expect(screen.getByText(option.description)).toBeInTheDocument()
      expect(screen.getByText(option.exampleResponse)).toBeInTheDocument()
    }
  })

  it("updates selection when user chooses a different style", () => {
    const onAccountabilityModeChange = vi.fn()

    render(
      <SettingsAccountabilitySection
        accountabilityMode="balanced"
        onAccountabilityModeChange={onAccountabilityModeChange}
      />
    )

    fireEvent.click(screen.getByRole("radio", { name: /accountability/i }))

    expect(onAccountabilityModeChange).toHaveBeenCalledWith("accountability")
  })
})
