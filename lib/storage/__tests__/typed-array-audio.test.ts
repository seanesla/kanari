import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deleteDatabase, installFakeIndexedDb } from "@/test-utils/indexeddb"
import type { CheckInSession, Recording } from "@/lib/types"

const DB_NAME = "kanari"

describe("IndexedDB typed-array audio persistence", () => {
  beforeEach(async () => {
    vi.resetModules()
    installFakeIndexedDb()
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  afterEach(async () => {
    try {
      const { db } = await import("@/lib/storage/db")
      db.close()
    } catch {
      // ignore
    }
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  it("stores and loads Recording.audioData as Float32Array", async () => {
    const { db, fromRecording, toRecording } = await import("@/lib/storage/db")

    const audio = new Float32Array([0.1, -0.2, 0.3, 0.4])
    const recording = {
      id: "rec_1",
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      duration: 4,
      status: "complete" as const,
      audioData: audio,
      sampleRate: 16000,
    } satisfies Recording

    await db.recordings.add(fromRecording(recording))

    const raw = await db.recordings.get(recording.id)
    expect(raw).toBeTruthy()
    expect(raw!.audioData).toBeInstanceOf(Float32Array)

    const loaded = toRecording(raw!)
    expect(loaded.audioData).toBeInstanceOf(Float32Array)
    expect((loaded.audioData as Float32Array).length).toBe(audio.length)
    expect(Array.from(loaded.audioData as Float32Array)).toEqual(Array.from(audio))
  })

  it("stores and loads CheckInSession.audioData as Float32Array", async () => {
    const { db, fromCheckInSession, toCheckInSession } = await import("@/lib/storage/db")

    const audio = new Float32Array([1, 2, 3])
    const session = {
      id: "session_1",
      startedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      messages: [],
      audioData: audio,
      sampleRate: 16000,
    } satisfies CheckInSession

    await db.checkInSessions.add(fromCheckInSession(session))

    const raw = await db.checkInSessions.get(session.id)
    expect(raw).toBeTruthy()
    expect(raw!.audioData).toBeInstanceOf(Float32Array)

    const loaded = toCheckInSession(raw!)
    expect(loaded.audioData).toBeInstanceOf(Float32Array)
    expect(Array.from(loaded.audioData as Float32Array)).toEqual(Array.from(audio))
  })
})
