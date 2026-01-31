// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => [],
}))

vi.mock("@/lib/storage/db", () => ({
  db: {},
  toCheckInSession: (input: unknown) => input,
}))

describe("useHistory", () => {
  it("does not throw when CheckInSessionsProvider is missing (falls back safely)", async () => {
    const { useHistory } = await import("../use-history")
    const { result } = renderHook(() => useHistory())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.items).toEqual([])
  })
})

