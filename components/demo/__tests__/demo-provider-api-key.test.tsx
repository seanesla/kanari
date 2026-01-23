/**
 * @vitest-environment jsdom
 */

import { act, render } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { installFakeIndexedDb, deleteDatabase } from "@/test-utils/indexeddb"

const DB_NAME = "kanari"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

// Avoid running step execution logic (waitForElement/scroll) in tests.
vi.mock("../steps/all-steps", () => ({
  ALL_DEMO_STEPS: [],
}))

describe("DemoProvider (settings safety)", () => {
  beforeEach(async () => {
    vi.resetModules()
    installFakeIndexedDb()
    window.localStorage.clear()
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  afterEach(async () => {
    try {
      const { db } = await import("@/lib/storage/db")
      db.close()
    } catch {
      // ignore
    }
    window.localStorage.clear()
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  it("does not overwrite an existing Gemini API key when demo data is seeded", async () => {
    const { DemoProvider, useDemo } = await import("../demo-provider")
    const { db } = await import("@/lib/storage/db")
    const { createDefaultSettingsRecord } = await import("@/lib/settings/default-settings")

    await db.settings.put(
      createDefaultSettingsRecord({
        userName: "Alex",
        geminiApiKey: "AIzaRealKey123",
        hasCompletedOnboarding: true,
        onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
      })
    )

    let startDemo: (() => Promise<void>) | null = null
    function ExposeStartDemo() {
      startDemo = useDemo().startDemo
      return null
    }

    render(
      <DemoProvider>
        <ExposeStartDemo />
      </DemoProvider>
    )

    await act(async () => {
      await startDemo?.()
    })

    const settings = await db.settings.get("default")
    expect(settings?.geminiApiKey).toBe("AIzaRealKey123")
  })
})
