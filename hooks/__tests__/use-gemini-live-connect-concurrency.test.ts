// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe("useGeminiLive connect concurrency", () => {
  it("does not return a resolved promise while a connection attempt is in-flight", async () => {
    const deferredConnect = createDeferred<void>()
    let latestEvents: Record<string, unknown> | null = null

    vi.resetModules()
    vi.unmock("@/hooks/use-gemini-live")

    vi.doMock("@/lib/gemini/live-client", () => ({
      GeminiLiveClient: class {},
      createLiveClient: vi.fn((config: { events: Record<string, unknown> }) => {
        latestEvents = config.events
        return {
          connect: vi.fn(async () => deferredConnect.promise),
          disconnect: vi.fn(),
          isReady: vi.fn(() => false),
          sendAudio: vi.fn(),
          sendText: vi.fn(),
          injectContext: vi.fn(),
          sendAudioEnd: vi.fn(),
          isConnectionHealthy: vi.fn(() => false),
          detachEventHandlers: vi.fn(),
          reattachEventHandlers: vi.fn(),
        }
      }),
    }))

    const { useGeminiLive } = await import("@/hooks/use-gemini-live")
    const { result } = renderHook(() => useGeminiLive())

    let promise1!: Promise<void>
    let promise2!: Promise<void>

    act(() => {
      promise1 = result.current[1].connect()
    })
    act(() => {
      promise2 = result.current[1].connect()
    })

    let promise2Settled = false
    void promise2.then(
      () => {
        promise2Settled = true
      },
      () => {
        promise2Settled = true
      }
    )

    await flushMicrotasks()

    // If connect() returns early during an in-flight attempt, callers can think
    // we're connected and proceed (which can strand the check-in UI in "setting up").
    expect(promise2Settled).toBe(false)

    await act(async () => {
      ;(latestEvents?.onConnected as undefined | (() => void))?.()
      deferredConnect.resolve(undefined)
      await promise1
      await promise2
    })
  })
})
