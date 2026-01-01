# Transcript Stream Duplication

## What it looks like
- Streaming transcript bubbles repeat words or phrases, e.g.:
  - “pretty pretty pretty okay okay but but normal …”
  - “Hey, happy New Year’s Eve! … How are youHey, happy New …”

## Why it happens
- Some streaming transcription sources send **cumulative** snapshots that are
  *not* strict string prefixes of the previous snapshot.
- The old merge logic only detected cumulative updates via `startsWith`.
  When that check failed, it appended the entire incoming snapshot as a delta,
  producing duplicated phrases and repeated words.
- Cumulative snapshots may also **revise earlier words** (e.g., “good” → “great”)
  or restart the opening (“Hey …” → “Hi …”), which breaks strict-prefix checks.
- Another common case is overlap: the incoming snapshot begins with the last
  word or two of the previous transcript (e.g. “okay” → “okay but …”).

## How to detect it automatically
- Unit tests for `mergeTranscriptUpdate` that cover:
  - Overlapping suffix/prefix updates (single-word overlap).
  - Cumulative snapshots that diverge only by punctuation (normalized prefix).
- Integration tests that simulate transcript streams and assert the final
  message does **not** repeat words.

## Fix strategy
- Normalize transcripts before comparison (ignore punctuation/whitespace).
- Treat normalized-prefix updates as **replace** operations, not appends.
- Use token overlap detection to merge suffix/prefix overlaps safely.
- On assistant streaming messages, **replace** the message content when a
  corrected cumulative snapshot arrives.
