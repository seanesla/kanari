import { describe, expect, it, vi } from "vitest"

describe("context-fingerprint", () => {
  it("limits session reads to avoid loading the entire check-in table", async () => {
    vi.resetModules()

    const recordingsQuery = {
      reverse: vi.fn(),
      limit: vi.fn(),
      toArray: vi.fn(async () => [
        { id: "rec-1", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      ]),
    }
    recordingsQuery.reverse.mockReturnValue(recordingsQuery)
    recordingsQuery.limit.mockReturnValue(recordingsQuery)

    const sessionsQuery = {
      reverse: vi.fn(),
      limit: vi.fn(),
      toArray: vi.fn(async () => [
        {
          id: "sess-1",
          startedAt: new Date("2026-01-01T00:00:00.000Z"),
          endedAt: new Date("2026-01-01T00:01:00.000Z"),
          messages: [],
        },
      ]),
    }
    sessionsQuery.reverse.mockReturnValue(sessionsQuery)
    sessionsQuery.limit.mockReturnValue(sessionsQuery)

    vi.doMock("@/lib/storage/db", () => ({
      db: {
        recordings: {
          orderBy: vi.fn(() => recordingsQuery),
          count: vi.fn(async () => 1),
        },
        checkInSessions: {
          orderBy: vi.fn(() => sessionsQuery),
          count: vi.fn(async () => 1),
        },
      },
      toRecording: (r: { id: string; createdAt: Date }) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
      }),
      toCheckInSession: (s: { id: string; startedAt: Date; endedAt?: Date | undefined }) => ({
        id: s.id,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString(),
        messages: [],
      }),
    }))

    const { getContextFingerprintData } = await import("@/lib/gemini/context-fingerprint")
    const data = await getContextFingerprintData()

    expect(data.latestRecordingId).toBe("rec-1")
    expect(data.latestCheckInSessionId).toBe("sess-1")
    expect(recordingsQuery.limit).toHaveBeenCalledWith(1)
    expect(sessionsQuery.limit).toHaveBeenCalledWith(5)
  })
})

