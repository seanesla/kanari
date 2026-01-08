import { describe, it, expect, vi, afterEach } from "vitest"
import { Temporal } from "temporal-polyfill"
import { createCalendarEvent } from "@/lib/calendar/api"

const tokens = {
  access_token: "test-access-token",
  expires_at: Date.now() + 60_000,
  token_type: "Bearer",
  scope: "https://www.googleapis.com/auth/calendar.events",
}

function mockFetchOnce(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe("createCalendarEvent", () => {
  it("sends RFC3339 timestamps without forcing a timezone when timeZone is omitted", async () => {
    const start = "2026-01-08T17:00:00.000Z"
    const end = "2026-01-08T17:30:00.000Z"

    const fetchMock = mockFetchOnce(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as any

      expect(body.start).toEqual({ dateTime: start })
      expect(body.end).toEqual({ dateTime: end })
      expect(body.start.timeZone).toBeUndefined()
      expect(body.end.timeZone).toBeUndefined()

      return new Response(
        JSON.stringify({
          id: "evt_1",
          summary: "Test event",
          start: { dateTime: start },
          end: { dateTime: end },
        }),
        { status: 200 }
      )
    })

    await createCalendarEvent(
      {
        summary: "Test event",
        start,
        end,
      },
      tokens
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("converts timestamps and includes timeZone when timeZone is provided", async () => {
    const start = "2026-01-08T17:00:00.000Z"
    const end = "2026-01-08T17:30:00.000Z"
    const timeZone = "America/New_York"

    const expectedStart = Temporal.Instant.from(start)
      .toZonedDateTimeISO(timeZone)
      .toString({ timeZoneName: "never" })
    const expectedEnd = Temporal.Instant.from(end)
      .toZonedDateTimeISO(timeZone)
      .toString({ timeZoneName: "never" })

    const fetchMock = mockFetchOnce(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as any

      expect(body.start).toEqual({ dateTime: expectedStart, timeZone })
      expect(body.end).toEqual({ dateTime: expectedEnd, timeZone })

      return new Response(
        JSON.stringify({
          id: "evt_2",
          summary: "Test event",
          start: { dateTime: expectedStart },
          end: { dateTime: expectedEnd },
        }),
        { status: 200 }
      )
    })

    await createCalendarEvent(
      {
        summary: "Test event",
        start,
        end,
        timeZone,
      },
      tokens
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

