# Error Pattern: Transcript Regression Truncates Assistant Messages

## What it looks like

- While the assistant is responding, the message text briefly grows, then suddenly becomes **shorter**.
- The final assistant message can look “chopped off” mid-sentence.

This is intermittent and is easiest to notice during streaming responses.

## Why it happens

Some transcript streams are not strictly monotonic. Occasionally an “incoming” update can be a **shorter prefix** of what we already accumulated. This can happen due to:

- out-of-order events
- partial snapshots interleaving with cumulative snapshots
- transcription finalization that temporarily emits a smaller window

If the merge strategy treats “incoming is a prefix of previous” as authoritative and **replaces** the transcript, the UI will shrink and appear truncated.

## How to detect it automatically

- Unit test `mergeTranscriptUpdate(previous, incoming)` where `incoming` is a shorter prefix of `previous`.
- Assert the merged transcript does **not** shrink.

## Fix / Prevention

- In `mergeTranscriptUpdate`, detect “regressive prefix snapshots” (`previous` starts with `incoming`) and treat them as **no-ops** (keep the longer transcript).

