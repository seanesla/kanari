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

  it("renders a single Save Changes button", async () => {
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

    const buttons = await screen.findAllByRole("button", { name: /save changes/i })
    expect(buttons).toHaveLength(1)
  })

  it("saves all editable settings via the bottom Save Changes button", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

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
    })
  })

  it("shows a popup reminder when there are unsaved changes", async () => {
    settingsGet.mockResolvedValue({
      id: "default",
      defaultRecordingDuration: 45,
      enableVAD: true,
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

    // Make a change to dirty the form.
    await waitFor(() => {
      expect(screen.getByLabelText(/default check-in duration/i)).toHaveValue("45")
    })
    fireEvent.change(screen.getByLabelText(/default check-in duration/i), {
      target: { value: "60" },
    })

    expect(await screen.findByText(/don't forget to save/i)).toBeInTheDocument()

    // Save from the reminder.
    fireEvent.click(screen.getByRole("button", { name: /save now/i }))

    await waitFor(() => {
      expect(settingsUpdate).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.queryByText(/don't forget to save/i)).not.toBeInTheDocument()
    })
  })
})
