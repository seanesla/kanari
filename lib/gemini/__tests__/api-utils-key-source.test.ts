import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { installFakeIndexedDb, deleteDatabase } from "@/test-utils/indexeddb"

const DB_NAME = "kanari"

describe("gemini api key source", () => {
  const originalEnv = process.env.NEXT_PUBLIC_GEMINI_API_KEY

  beforeEach(async () => {
    vi.resetModules()
    installFakeIndexedDb()
    await deleteDatabase(DB_NAME).catch(() => undefined)
    delete process.env.NEXT_PUBLIC_GEMINI_API_KEY
  })

  afterEach(async () => {
    try {
      const { db } = await import("@/lib/storage/db")
      db.close()
    } catch {
      // ignore
    }

    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY
    } else {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = originalEnv
    }

    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  it("uses NEXT_PUBLIC_GEMINI_API_KEY when no user key is stored", async () => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = "AIzaEnvKey123"
    vi.resetModules()

    const { getGeminiApiKey } = await import("@/lib/gemini/api-utils")

    expect(await getGeminiApiKey()).toBe("AIzaEnvKey123")
  })

  it("prefers a stored user key when geminiApiKeySource is user", async () => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = "AIzaEnvKey123"
    vi.resetModules()

    const { db } = await import("@/lib/storage/db")
    const { createDefaultSettingsRecord } = await import("@/lib/settings/default-settings")

    await db.settings.put(
      createDefaultSettingsRecord({
        geminiApiKeySource: "user",
        geminiApiKey: "AIzaUserKey999",
      })
    )

    const { getGeminiApiKey } = await import("@/lib/gemini/api-utils")

    expect(await getGeminiApiKey()).toBe("AIzaUserKey999")
  })

  it("uses the env key when geminiApiKeySource is kanari", async () => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = "AIzaEnvKey123"
    vi.resetModules()

    const { db } = await import("@/lib/storage/db")
    const { createDefaultSettingsRecord } = await import("@/lib/settings/default-settings")

    await db.settings.put(
      createDefaultSettingsRecord({
        geminiApiKeySource: "kanari",
        geminiApiKey: "AIzaUserKey999",
      })
    )

    const { getGeminiApiKey } = await import("@/lib/gemini/api-utils")

    expect(await getGeminiApiKey()).toBe("AIzaEnvKey123")
  })

  it("does not fall back from DEMO_MODE to env key unless explicitly set to kanari", async () => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = "AIzaEnvKey123"
    vi.resetModules()

    const { db } = await import("@/lib/storage/db")
    const { createDefaultSettingsRecord } = await import("@/lib/settings/default-settings")

    await db.settings.put(
      createDefaultSettingsRecord({
        geminiApiKey: "DEMO_MODE",
      })
    )

    const { getGeminiApiKey } = await import("@/lib/gemini/api-utils")

    expect(await getGeminiApiKey()).toBeUndefined()
  })

  it("createGeminiHeaders includes source and key", async () => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = "AIzaEnvKey123"
    vi.resetModules()

    const { db } = await import("@/lib/storage/db")
    const { createDefaultSettingsRecord } = await import("@/lib/settings/default-settings")

    await db.settings.put(createDefaultSettingsRecord({ geminiApiKeySource: "kanari" }))

    const { createGeminiHeaders } = await import("@/lib/gemini/api-utils")
    const headers = (await createGeminiHeaders({ "Content-Type": "application/json" })) as Record<
      string,
      string
    >

    expect(headers["X-Kanari-Gemini-Key-Source"]).toBe("kanari")
    expect(headers["X-Gemini-Api-Key"]).toBe("AIzaEnvKey123")
    expect(headers["Content-Type"]).toBe("application/json")
  })
})
