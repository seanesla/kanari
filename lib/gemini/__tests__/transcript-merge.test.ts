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

  it("appends delta when a new sentence arrives with no overlap", () => {
    const result = mergeTranscriptUpdate("I hear you", " Let's take a breath.")
    expect(result.next).toBe("I hear you Let's take a breath.")
    expect(result.kind).toBe("delta")
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

  it("does not regress when incoming is a shorter prefix", () => {
    const previous = "Hey, happy New Year's Eve! It was good to see your mood improve after yesterday morning."
    const incoming = "Hey, happy New Year's Eve! It was good to see your mood"

    const result = mergeTranscriptUpdate(previous, incoming)
    expect(result.next).toBe(previous)
    expect(result.delta).toBe("")
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

  it("does not shorten the transcript when a corrected snapshot would make text disappear mid-stream", () => {
    const previous =
      "Hey, happy New Year's Eve! It was good to see your mood improve after yesterday morning. How are you feeling tonight?"
    const incoming =
      "Hey, happy New Year's Eve! It was great to see your mood improve after yesterday morning."

    const result = mergeTranscriptUpdate(previous, incoming)
    expect(result.next).toBe(previous)
    expect(result.delta).toBe("")
  })

  it("ignores replayed subset chunks that are already present in the transcript", () => {
    const previous =
      "Got it, I've scheduled that 5-minute journaling exercise for 10:00 PM tonight. Now, circling back to your commitment for tomorrow, how are you feeling about sticking to the plan?"
    const incoming =
      "I've scheduled that 5-minute journaling exercise for 10:00 PM tonight. Now, circling back to your commitment for tomorrow, how are you feeling about sticking to the plan?"

    const result = mergeTranscriptUpdate(previous, incoming)
    expect(result.next).toBe(previous)
    expect(result.delta).toBe("")
  })

  // Tests for short message restart detection (garbled greeting bug)
  // Pattern doc: docs/error-patterns/transcript-stream-duplication.md
  describe("short message restart detection", () => {
    it("replaces when a short greeting restarts with different opening", () => {
      const previous = "How are you doing today"
      const incoming = "Happy New Year! How are you feeling"
      const result = mergeTranscriptUpdate(previous, incoming)
      expect(result.next).toBe(incoming)
      expect(result.kind).toBe("replace")
    })

    it("replaces when only the opener overlaps (parallel-stream greeting interleave)", () => {
      const previous = "Hey! I know"
      const incoming = "Hey, happy"
      const result = mergeTranscriptUpdate(previous, incoming)
      expect(result.next).toBe(incoming)
      expect(result.kind).toBe("replace")
    })

    it("replaces when incoming starts with capital letter mid-flow", () => {
      const previous = "Hey, checking in. I noticed your energy"
      const incoming = "Happy New Year! I noticed your energy has been"
      const result = mergeTranscriptUpdate(previous, incoming)
      expect(result.next).toBe(incoming)
      expect(result.kind).toBe("replace")
    })

    it("replaces when model restarts greeting with shared context words", () => {
      const previous = "I know your energy has been getting lower this week"
      const incoming = "Happy New Year! Your energy levels seemed to be dipping"
      const result = mergeTranscriptUpdate(previous, incoming)
      expect(result.next).toBe(incoming)
      expect(result.kind).toBe("replace")
    })

    it("still detects cumulative for short messages that extend naturally", () => {
      const previous = "Hello! How are"
      const incoming = "Hello! How are you doing today?"
      const result = mergeTranscriptUpdate(previous, incoming)
      expect(result.next).toBe(incoming)
      expect(result.kind).toBe("cumulative")
    })
  })
})
