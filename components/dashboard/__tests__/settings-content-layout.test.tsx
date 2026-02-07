// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const mockSettingsGet = vi.fn(async () => undefined)

vi.mock("@/lib/scene-context", () => ({
  useSceneMode: () => ({
    previewAccentColor: vi.fn(),
    previewSansFont: vi.fn(),
    previewSerifFont: vi.fn(),
    previewGraphicsQuality: vi.fn(),
  }),
  setDisableStartupAnimationSync: vi.fn(),
}))

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({
    setTimeZone: vi.fn(),
    availableTimeZones: ["UTC"],
    isLoading: false,
  }),
}))

vi.mock("@/lib/storage/db", () => ({
  db: {
    settings: {
      get: mockSettingsGet,
    },
  },
}))

vi.mock("@/lib/settings/patch-settings", () => ({
  patchSettings: vi.fn(async () => {}),
}))

vi.mock("@/components/dashboard/settings-profile-section", () => ({
  SettingsProfileSection: () => <div data-testid="profile-section" />,
}))

vi.mock("@/components/dashboard/settings-voice-section", () => ({
  SettingsVoiceSection: () => <div data-testid="voice-section" />,
}))

vi.mock("@/components/dashboard/settings-biomarkers-section", () => ({
  SettingsBiomarkersSection: () => <div className="md:col-span-2" data-testid="biomarkers-section" />,
}))

vi.mock("@/components/dashboard/settings-accountability-section", () => ({
  SettingsAccountabilitySection: () => <div data-testid="accountability-section" />,
}))

vi.mock("@/components/dashboard/settings-appearance", () => ({
  SettingsAppearanceSection: () => <div data-testid="appearance-section" />,
}))

vi.mock("@/components/dashboard/settings-graphics", () => ({
  SettingsGraphicsSection: () => <div data-testid="graphics-section" />,
}))

vi.mock("@/components/dashboard/settings-timezone", () => ({
  SettingsTimeZoneSection: () => <div data-testid="timezone-section" />,
}))

vi.mock("@/components/dashboard/settings-account", () => ({
  SettingsAccountSection: () => <div data-testid="account-section" />,
}))

vi.mock("@/components/dashboard/settings-api", () => ({
  SettingsApiSection: () => <div data-testid="api-section" />,
}))

describe("SettingsContent layout", () => {
  it("keeps Time Zone and Account in a full-width row on desktop", async () => {
    const { SettingsContent } = await import("../settings-content")

    render(<SettingsContent />)
    await waitFor(() => expect(mockSettingsGet).toHaveBeenCalled())

    const timeZoneHeading = screen.getByRole("heading", { name: "Time Zone" })
    const timeZoneDeck = timeZoneHeading.closest("[data-deck]")

    expect(timeZoneDeck).not.toBeNull()
    if (!timeZoneDeck) {
      throw new Error("Expected Time Zone heading to be inside a Deck")
    }

    expect(timeZoneDeck).toHaveClass("md:col-span-2")

    const desktopSplit = Array.from(timeZoneDeck.querySelectorAll("div")).find((element) => {
      return typeof element.className === "string" && element.className.includes("md:grid-cols-2")
    })

    expect(desktopSplit).not.toBeNull()
    expect(screen.getByTestId("timezone-section")).toBeInTheDocument()
    expect(screen.getByTestId("account-section")).toBeInTheDocument()
  })
})
