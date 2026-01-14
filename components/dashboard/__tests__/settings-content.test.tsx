// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { SceneProvider } from "@/lib/scene-context"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

const settingsGet = vi.fn()
const settingsUpdate = vi.fn()
const settingsAdd = vi.fn()
const settingsPut = vi.fn()

vi.mock("@/lib/storage/db", () => ({
  db: {
    settings: {
      get: (...args: unknown[]) => settingsGet(...args),
      update: (...args: unknown[]) => settingsUpdate(...args),
      add: (...args: unknown[]) => settingsAdd(...args),
      put: (...args: unknown[]) => settingsPut(...args),
    },
  },
}))

vi.mock("@/hooks/use-calendar", () => ({
  useCalendar: () => ({
    isConnected: false,
    isLoading: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearError: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-suggestion-memory", () => ({
  useSuggestionMemory: () => ({
    memoryContext: {
      completed: [],
      dismissed: [],
      scheduled: [],
      stats: {
        totalCompleted: 0,
        totalDismissed: 0,
        averageCompletionRate: 0,
        mostUsedCategory: null,
        leastUsedCategory: null,
        categoryStats: {
          break: { completed: 0, dismissed: 0, total: 0, completionRate: 0, preference: "medium" },
          exercise: { completed: 0, dismissed: 0, total: 0, completionRate: 0, preference: "medium" },
          mindfulness: { completed: 0, dismissed: 0, total: 0, completionRate: 0, preference: "medium" },
          social: { completed: 0, dismissed: 0, total: 0, completionRate: 0, preference: "medium" },
          rest: { completed: 0, dismissed: 0, total: 0, completionRate: 0, preference: "medium" },
        },
        preferredCategories: [],
        avoidedCategories: [],
        effectivenessByCategory: {
          break: { totalRatings: 0, helpfulRatings: 0, notHelpfulRatings: 0, helpfulRate: 0 },
          exercise: { totalRatings: 0, helpfulRatings: 0, notHelpfulRatings: 0, helpfulRate: 0 },
          mindfulness: { totalRatings: 0, helpfulRatings: 0, notHelpfulRatings: 0, helpfulRate: 0 },
          social: { totalRatings: 0, helpfulRatings: 0, notHelpfulRatings: 0, helpfulRate: 0 },
          rest: { totalRatings: 0, helpfulRatings: 0, notHelpfulRatings: 0, helpfulRate: 0 },
        },
      },
    },
  }),
}))

vi.mock("@/components/voice-list", () => ({
  VoiceList: ({
    selectedVoice,
    onVoiceSelect,
  }: {
    selectedVoice: string | null
    onVoiceSelect: (voice: string) => void
  }) => (
    <div>
      <div data-testid="selected-voice">{selectedVoice ?? "none"}</div>
      <button type="button" onClick={() => onVoiceSelect("Aoede")}>
        Select Aoede
      </button>
    </div>
  ),
}))

describe("SettingsContent", () => {
  beforeEach(() => {
    settingsGet.mockReset()
    settingsUpdate.mockReset()
    settingsAdd.mockReset()
    settingsPut.mockReset()
  })

  it("renders a single Save Changes button only when there are unsaved changes", async () => {
    settingsGet.mockResolvedValue({
      id: "default",
      defaultRecordingDuration: 45,
      enableVAD: true,
      enableNotifications: true,
      calendarConnected: false,
      autoScheduleRecovery: false,
      preferredRecoveryTimes: [],
      localStorageOnly: true,
      geminiApiKey: "old-key",
      selectedGeminiVoice: "Zephyr",
    })

    const { SettingsContent } = await import("../settings-content")

    render(
      <SceneProvider>
        <SettingsContent />
      </SceneProvider>
    )

    // No Save button while clean.
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument()

    // Make a change to dirty the form.
    await waitFor(() => {
      expect(screen.getByLabelText(/default check-in duration/i)).toHaveValue("45")
    })
    fireEvent.change(screen.getByLabelText(/default check-in duration/i), {
      target: { value: "60" },
    })

    const buttons = await screen.findAllByRole("button", { name: /save changes/i })
    expect(buttons).toHaveLength(1)
  })

  it("saves all editable settings via the floating Save Changes bar", async () => {
    settingsGet.mockResolvedValue({
      id: "default",
      defaultRecordingDuration: 45,
      enableVAD: false,
      enableNotifications: true,
      dailyReminderTime: undefined,
      calendarConnected: true,
      autoScheduleRecovery: true,
      preferredRecoveryTimes: ["10:00"],
      localStorageOnly: false,
      geminiApiKey: "old-key",
      selectedGeminiVoice: "Zephyr",
    })

    settingsUpdate.mockResolvedValue(1)

    const { SettingsContent } = await import("../settings-content")

    render(
      <SceneProvider>
        <SettingsContent />
      </SceneProvider>
    )

    // Wait for persisted settings to hydrate into the form.
    await waitFor(() => {
      expect(screen.getByLabelText(/default check-in duration/i)).toHaveValue("45")
    })

    fireEvent.change(screen.getByLabelText(/default check-in duration/i), {
      target: { value: "60" },
    })

    fireEvent.click(screen.getByRole("switch", { name: /voice activity detection/i }))
    fireEvent.click(screen.getByRole("switch", { name: /browser notifications/i }))

    fireEvent.click(screen.getByRole("switch", { name: /daily reminder/i }))
    fireEvent.change(screen.getByLabelText(/daily reminder time/i), {
      target: { value: "10:15" },
    })

    fireEvent.click(screen.getByRole("switch", { name: /local storage only/i }))

    fireEvent.change(screen.getByLabelText(/gemini api key/i), {
      target: { value: "new-key" },
    })

    fireEvent.click(screen.getByRole("button", { name: /select aoede/i }))
    expect(screen.getByTestId("selected-voice")).toHaveTextContent("Aoede")

    fireEvent.click(await screen.findByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(settingsUpdate).toHaveBeenCalled()
    })

    expect(settingsUpdate).toHaveBeenCalledWith("default", {
      defaultRecordingDuration: 60,
      enableVAD: true,
      enableNotifications: false,
      dailyReminderTime: "10:15",
      localStorageOnly: true,
      autoScheduleRecovery: true,
      geminiApiKey: "new-key",
      selectedGeminiVoice: "Aoede",
      accountabilityMode: "balanced",
    })
  })

  it("resets settings to defaults with confirmation (without auto-saving)", async () => {
    settingsGet.mockResolvedValue({
      id: "default",
      defaultRecordingDuration: 45,
      enableVAD: false,
      enableNotifications: true,
      dailyReminderTime: undefined,
      calendarConnected: false,
      autoScheduleRecovery: false,
      preferredRecoveryTimes: [],
      localStorageOnly: true,
      geminiApiKey: "old-key",
      selectedGeminiVoice: "Zephyr",
    })

    settingsUpdate.mockResolvedValue(1)

    const { SettingsContent } = await import("../settings-content")

    render(
      <SceneProvider>
        <SettingsContent />
      </SceneProvider>
    )

    // Wait for persisted settings to hydrate into the form.
    await waitFor(() => {
      expect(screen.getByLabelText(/default check-in duration/i)).toHaveValue("45")
    })

    // Reset to defaults.
    fireEvent.click(screen.getByRole("button", { name: /reset to defaults/i }))
    expect(await screen.findByText(/reset to defaults\?/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^reset$/i }))

    // Draft should change (and become dirty), but it should not save automatically.
    expect(settingsUpdate).not.toHaveBeenCalled()
    expect(await screen.findByText(/you have unsaved changes/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByLabelText(/default check-in duration/i)).toHaveValue("30")
    })

    expect(screen.getByTestId("selected-voice")).toHaveTextContent("none")

    // Save defaults.
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(settingsUpdate).toHaveBeenCalled()
    })

    expect(settingsUpdate).toHaveBeenCalledWith("default", {
      defaultRecordingDuration: 30,
      enableVAD: true,
      enableNotifications: false,
      dailyReminderTime: undefined,
      localStorageOnly: true,
      autoScheduleRecovery: false,
      geminiApiKey: undefined,
      selectedGeminiVoice: undefined,
      accountabilityMode: "balanced",
    })
  })
})
