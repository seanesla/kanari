# Error Pattern: Transcript “Restart” Heuristic Drops Earlier Text

## What it looks like

- The assistant message starts normally, then a later chunk arrives and the visible text suddenly becomes:
  - only the **later** sentence(s), or
  - missing the first sentence entirely.

This can look like the assistant response was “chopped off” or rewritten mid-stream.

## Why it happens

`mergeTranscriptUpdate()` has a restart-detection heuristic intended to handle Gemini Live’s
interleaved parallel transcript streams (e.g., greeting restarts like “Hey…” → “Happy New Year!...”).

A common signal used is:

- incoming chunk starts with a capital letter, and
- the previous transcript is “incomplete” (no terminal punctuation), and
- there is no boundary overlap.

However, **legitimate delta chunks** can also meet these conditions — especially when a new sentence
arrives as a delta (e.g., `" I hear you"` → `" Let's take a breath."`). If the heuristic treats this as a restart,
it replaces the transcript and drops earlier text.

## How to detect it automatically

- Unit test `mergeTranscriptUpdate("I hear you", " Let's take a breath.")` and assert it appends rather than replaces.
- See: `lib/gemini/__tests__/transcript-merge.test.ts` (“appends delta when a new sentence arrives with no overlap”).

## Fix / Prevention

- Make restart replacement **more strict**:
  - require shared vocabulary (>=2 shared tokens) **or**
  - a strong “greeting-like” opener on the incoming chunk (Hi/Hey/Hello/Happy New Year…)
- Prefer appending for “no overlap” capitalized deltas that don’t look like greetings.

