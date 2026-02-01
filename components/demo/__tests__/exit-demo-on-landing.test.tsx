// @vitest-environment jsdom

import React from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, waitFor } from "@testing-library/react"

vi.mock("@/lib/workspace", () => ({
  isDemoWorkspace: vi.fn(),
  setWorkspace: vi.fn(),
}))

vi.mock("@/lib/navigation/hard-reload", () => ({
  hardReload: vi.fn(),
}))

describe("ExitDemoOnLanding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exits demo workspace and hard reloads", async () => {
    const workspace = await import("@/lib/workspace")
    const nav = await import("@/lib/navigation/hard-reload")
    const { ExitDemoOnLanding } = await import("../exit-demo-on-landing")

    vi.mocked(workspace.isDemoWorkspace).mockReturnValue(true)

    render(<ExitDemoOnLanding />)

    await waitFor(() => {
      expect(workspace.setWorkspace).toHaveBeenCalledWith("real")
      expect(nav.hardReload).toHaveBeenCalledTimes(1)
    })
  })

  it("does nothing when not in demo workspace", async () => {
    const workspace = await import("@/lib/workspace")
    const nav = await import("@/lib/navigation/hard-reload")
    const { ExitDemoOnLanding } = await import("../exit-demo-on-landing")

    vi.mocked(workspace.isDemoWorkspace).mockReturnValue(false)

    render(<ExitDemoOnLanding />)

    await new Promise((r) => setTimeout(r, 0))
    expect(workspace.setWorkspace).not.toHaveBeenCalled()
    expect(nav.hardReload).not.toHaveBeenCalled()
  })
})
