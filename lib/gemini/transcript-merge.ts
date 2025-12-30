export type TranscriptUpdateKind = "delta" | "cumulative"

export interface TranscriptUpdate {
  /**
   * The updated full transcript value after applying `incoming`.
   */
  next: string
  /**
   * The incremental delta that should be appended to the UI, if using an
   * append-only update strategy.
   */
  delta: string
  kind: TranscriptUpdateKind
}

/**
 * Merge an incoming transcription update into the prior transcript.
 *
 * Some streaming sources emit:
 * - **delta** updates (only the new text since the last event), or
 * - **cumulative** updates (the full transcript-so-far on every event).
 *
 * This helper detects cumulative updates via prefix matching and returns both:
 * - `next`: the updated full transcript
 * - `delta`: the minimal string to append to reach `next` (may be empty)
 */
export function mergeTranscriptUpdate(previous: string, incoming: string): TranscriptUpdate {
  if (!incoming) {
    return { next: previous, delta: "", kind: "delta" }
  }

  if (incoming.startsWith(previous)) {
    return {
      next: incoming,
      delta: incoming.slice(previous.length),
      kind: "cumulative",
    }
  }

  return {
    next: previous + incoming,
    delta: incoming,
    kind: "delta",
  }
}

