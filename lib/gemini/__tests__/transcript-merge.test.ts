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

  it("merges overlapping updates to avoid duplicated words", () => {
    const result = mergeTranscriptUpdate("pretty okay", "okay but normal")
    expect(result.next).toBe("pretty okay but normal")
    expect(result.delta).toBe(" but normal")
  })

  it("replaces transcript when a corrected cumulative snapshot diverges", () => {
    const previous =
      "Hey, happy New Years Eve! It was good to see your mood improve after yesterday morning. How are you"
    const incoming =
      "Hey, happy New Year's Eve! It was good to see your mood improve after yesterday morning. How are you feeling as we head into the new year?"

    const result = mergeTranscriptUpdate(previous, incoming)
    expect(result.next).toBe(incoming)
    expect(result.kind).toBe("replace")
  })

  it("replaces transcript when a corrected snapshot revises earlier words", () => {
    const previous =
      "Hey, happy New Year's Eve! It was good to see your mood improve after yesterday morning. How are you feeling tonight?"
    const incoming =
      "Hey, happy New Year's Eve! It was great to see your mood improve after yesterday morning. How are you feeling tonight?"

    const result = mergeTranscriptUpdate(previous, incoming)
    expect(result.next).toBe(incoming)
    expect(result.kind).toBe("replace")
  })

  it("replaces transcript when a corrected snapshot restarts with a different opening", () => {
    const previous =
      "Hey, happy New Year's Eve! It was good to see your mood improve after yesterday morning. How are you feeling tonight?"
    const incoming =
      "Hi, happy New Year's Eve! It was good to see your mood improve after yesterday morning. How are you feeling tonight?"

    const result = mergeTranscriptUpdate(previous, incoming)
    expect(result.next).toBe(incoming)
    expect(result.kind).toBe("replace")
  })

  it("replaces transcript when a corrected snapshot expands and revises earlier phrasing", () => {
    const previous =
      "Hey, happy New Year's Eve! I've noticed you sound tired this week. How are you feeling tonight?"
    const incoming =
      "Hey, happy New Year's Eve! I've noticed you seem tired this week, even if you say you're okay. How are you feeling tonight?"

    const result = mergeTranscriptUpdate(previous, incoming)
    expect(result.next).toBe(incoming)
    expect(result.kind).toBe("replace")
  })
})
