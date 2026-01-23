import { describe, it, expect } from "vitest"
import { getDemoVideoSources } from "../demo-video-sources"

describe("demo-video-sources", () => {
  it("returns mp4 before webm", () => {
    const sources = getDemoVideoSources({ mp4: "/demo/example.mp4", webm: "/demo/example.webm" })
    expect(sources.map((source) => source.type)).toEqual(["video/mp4", "video/webm"])
  })

  it("omits missing formats", () => {
    expect(getDemoVideoSources({ mp4: "/demo/example.mp4" })).toEqual([{ src: "/demo/example.mp4", type: "video/mp4" }])
    expect(getDemoVideoSources({ webm: "/demo/example.webm" })).toEqual([
      { src: "/demo/example.webm", type: "video/webm" },
    ])
  })
})

