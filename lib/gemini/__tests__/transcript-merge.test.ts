import { describe, it, expect } from "vitest"
import { mergeTranscriptUpdate } from "../transcript-merge"

describe("mergeTranscriptUpdate", () => {
  it("returns no-op when incoming is empty", () => {
    const result = mergeTranscriptUpdate("hello", "")
    expect(result).toEqual({ next: "hello", delta: "", kind: "delta" })
  })

  it("treats incoming as delta when it is not cumulative", () => {
    const result = mergeTranscriptUpdate("hello", " world")
    expect(result.next).toBe("hello world")
    expect(result.delta).toBe(" world")
    expect(result.kind).toBe("delta")
  })

  it("treats incoming as cumulative when it starts with previous", () => {
    const result = mergeTranscriptUpdate("hello", "hello world")
    expect(result.next).toBe("hello world")
    expect(result.delta).toBe(" world")
    expect(result.kind).toBe("cumulative")
  })

  it("handles repeated cumulative snapshots with empty delta", () => {
    const result = mergeTranscriptUpdate("hello world", "hello world")
    expect(result.next).toBe("hello world")
    expect(result.delta).toBe("")
    expect(result.kind).toBe("cumulative")
  })
})

