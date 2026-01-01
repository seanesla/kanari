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

## Implementation
**User transcripts** use `mergeTranscriptUpdate()` from `lib/gemini/transcript-merge.ts`:

```typescript
// User transcripts (use-check-in-messages.ts:296)
const mergedUser = mergeTranscriptUpdate(userTranscriptRef.current, text)
```

**Assistant transcripts** use simple append (see "Known Gemini API Issue" below):

```typescript
// Assistant transcripts (use-check-in-messages.ts:385)
currentTranscriptRef.current = currentTranscriptRef.current + text
```

Enable debug logging to see merge operations:
```javascript
localStorage.setItem("kanari.debugTranscriptMerge", "1")
```

## Known Gemini API Issue: Interleaved Parallel Streams

The Gemini Live API `outputTranscription` sends transcript chunks from **multiple
parallel streams** that arrive interleaved. For example, when the AI says:

> "Hey, happy New Year! I know your energy has been dipping..."

The chunks may arrive as:
1. "Hey! I" (Stream A)
2. " know" (Stream A)
3. "Hey, happy" (Stream B - different greeting variant!)
4. " late" (Stream B)
5. " it's" (Stream A)
...etc.

This produces jumbled output like:
> "Hey! I knowHey, happy late it's really..."

### Why `mergeTranscriptUpdate()` doesn't help
The merge logic was designed for **cumulative snapshots** (where the API sends
the full transcript-so-far on each event). But Gemini Live sends truly **out-of-order
delta chunks** from parallel streams, with no sequence numbers or stream IDs.

Using `mergeTranscriptUpdate()` for assistant transcripts actually makes it **worse**
because it falsely detects overlapping words as "restarts" and replaces content.

### Implemented fix
The UI now hides the broken transcript during streaming and shows "Speaking..."
instead. When `isStreaming: true` for an assistant message, `MessageBubble`
displays a placeholder rather than the jumbled content.

```tsx
// components/check-in/message-bubble.tsx
const isAssistantStreaming = isAssistant && message.isStreaming
// ...
{isAssistantStreaming ? (
  <p className="text-muted-foreground italic">Speaking...</p>
) : (
  <p>{message.content}</p>
)}
```

The AI's spoken audio is correct - only the text transcription was affected.
Once the turn completes and `isStreaming` becomes false, the final (still
jumbled) transcript is hidden by the "Speaking..." placeholder being replaced
with the actual content. Since users primarily rely on audio during the
conversation, this provides a clean UX.

### Alternative approaches considered
1. **File bug with Google** - This is a Gemini Live API issue where
   `outputTranscription` doesn't provide ordering guarantees
2. **Client-side Speech-to-Text** - Use Web Speech API to transcribe the audio
   ourselves (adds latency and processing overhead)
