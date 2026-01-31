export type TranscriptUpdateKind = "delta" | "cumulative" | "replace"

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

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
])

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/(\p{L})['’](\p{L})/gu, "$1$2")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
}

type Token = { norm: string; start: number; end: number }

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const regex = /\S+/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0]
    const norm = normalizeToken(raw)
    if (!norm) continue
    tokens.push({ norm, start: match.index, end: match.index + raw.length })
  }

  return tokens
}

function countCommonPrefixTokens(previousTokens: Token[], incomingTokens: Token[]): number {
  const max = Math.min(previousTokens.length, incomingTokens.length)
  let count = 0
  for (let i = 0; i < max; i++) {
    if (previousTokens[i]?.norm !== incomingTokens[i]?.norm) break
    count++
  }
  return count
}

function meaningfulTokenSet(tokens: Token[]): Set<string> {
  const set = new Set<string>()
  for (const token of tokens) {
    if (!token.norm) continue
    if (token.norm.length < 2) continue
    if (STOPWORDS.has(token.norm)) continue
    set.add(token.norm)
  }
  return set
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const value of small) {
    if (large.has(value)) count++
  }
  return count
}

function shouldAcceptSingleTokenOverlap(token: string): boolean {
  return token.length >= 3 && !STOPWORDS.has(token)
}

function looksLikeGreetingStart(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/^(hi|hey|hello)\b/i.test(trimmed)) return true
  if (/^good (morning|afternoon|evening)\b/i.test(trimmed)) return true
  if (/^happy new year(['’]?s)?\b/i.test(trimmed)) return true
  return false
}

function shouldAllowShorteningReplace(options: {
  previous: string
  incoming: string
  previousTokens: Token[]
  incomingTokens: Token[]
}): boolean {
  const { previous, incoming, previousTokens, incomingTokens } = options

  if (incoming.length >= previous.length) return true
  if (previous.length - incoming.length <= 8) return true

  // If we're still in the "greeting" / very short starter phase, allow
  // replacement even if it shortens. This avoids garbled openers from
  // parallel/interleaved streams.
  const previousIsShort = previousTokens.length <= 6 && previous.trim().length <= 60
  if (previousIsShort) return true

  const incomingTrimmed = incoming.trim()
  const incomingLooksGreeting = looksLikeGreetingStart(incomingTrimmed)
  // Only treat greeting-like openings as "safe to shorten" while the transcript
  // is still very short. Once the assistant has produced a longer message,
  // shortening replacements read as text disappearing.
  if (incomingLooksGreeting && previousTokens.length <= 10 && previous.trim().length <= 80) return true

  // If incoming looks like a restart (capitalized start, no boundary overlap),
  // allow replacement even if it shortens.
  const incomingStartsCapital = /^[A-Z]/.test(incomingTrimmed)
  const previousEndsIncomplete = !/[.!?]$/.test(previous.trim())
  const boundaryOverlap = findOverlapCount(previousTokens, incomingTokens)
  if (incomingStartsCapital && previousEndsIncomplete && boundaryOverlap === 0) return true

  // Otherwise, avoid shortening replacements: they look like text "disappearing"
  // while the model is streaming.
  // Pattern doc: docs/error-patterns/transcript-replace-shortening.md
  return false
}

function findOverlapCount(previousTokens: Token[], incomingTokens: Token[]): number {
  const maxOverlap = Math.min(previousTokens.length, incomingTokens.length)
  for (let count = maxOverlap; count >= 1; count--) {
    let matches = true
    for (let i = 0; i < count; i++) {
      const prevToken = previousTokens[previousTokens.length - count + i]
      const nextToken = incomingTokens[i]
      if (!prevToken || !nextToken || prevToken.norm !== nextToken.norm) {
        matches = false
        break
      }
    }
    if (matches) return count
  }
  return 0
}

/**
 * Merge an incoming transcription update into the prior transcript.
 *
 * Some streaming sources emit:
 * - **delta** updates (only the new text since the last event), or
 * - **cumulative** updates (the full transcript-so-far on every event).
 *
 * This helper detects cumulative updates via prefix matching, overlap
 * heuristics, and replacement handling to avoid duplicated phrases.
 *
 * Pattern doc: docs/error-patterns/transcript-stream-duplication.md
 */
export function mergeTranscriptUpdate(previous: string, incoming: string): TranscriptUpdate {
  if (!incoming) {
    return { next: previous, delta: "", kind: "delta" }
  }

  if (!previous) {
    return { next: incoming, delta: incoming, kind: "delta" }
  }

  const normalizedPrevious = normalizeForCompare(previous)
  const normalizedIncoming = normalizeForCompare(incoming)

  if (!normalizedIncoming) {
    return { next: previous, delta: "", kind: "delta" }
  }

  if (normalizedIncoming.startsWith(normalizedPrevious)) {
    if (incoming.startsWith(previous)) {
      return {
        next: incoming,
        delta: incoming.slice(previous.length),
        kind: "cumulative",
      }
    }

    return {
      next: incoming,
      delta: "",
      kind: "replace",
    }
  }

  if (normalizedPrevious.startsWith(normalizedIncoming)) {
    // Regressive snapshot: some streaming sources (or out-of-order events) can emit
    // a shorter "prefix" after we've already accumulated a longer transcript.
    // Replacing in that case makes the UI look like the assistant message got
    // chopped off mid-sentence.
    // Pattern doc: docs/error-patterns/transcript-regression-truncation.md
    return {
      next: previous,
      delta: "",
      kind: "delta",
    }
  }

  const previousTokens = tokenize(previous)
  const incomingTokens = tokenize(incoming)

  // Detect greeting restart: incoming starts with capital and looks like a new sentence.
  // This catches cases where the model restarts with a different greeting variant.
  // Pattern doc: docs/error-patterns/transcript-stream-duplication.md
  // Guardrail doc: docs/error-patterns/transcript-restart-misclassification.md
  const incomingTrimmed = incoming.trim()
  const incomingStartsCapital = /^[A-Z]/.test(incomingTrimmed)
  const previousEndsIncomplete = !/[.!?]$/.test(previous.trim())

  if (incomingStartsCapital && previousEndsIncomplete) {
    // Check boundary overlap - if no overlap at previous/incoming boundary, it's a restart
    const boundaryOverlap = findOverlapCount(previousTokens, incomingTokens)

    if (boundaryOverlap === 0) {
      // No boundary overlap means incoming doesn't continue from where previous left off
      // Check if they share ANY words (including stopwords) - different from meaningfulTokenSet
      const prevAllWords = new Set(previousTokens.map((t) => t.norm))
      const incAllWords = new Set(incomingTokens.map((t) => t.norm))
      const sharedAnyCount = intersectionSize(prevAllWords, incAllWords)
      const commonPrefix = countCommonPrefixTokens(previousTokens, incomingTokens)

      // If there's word overlap (shared vocabulary) but no boundary overlap, replace
      // This catches restarts like "How are you doing" → "Happy New Year! How are you feeling"
      // where "how", "are", "you" are shared but aren't at the boundary
      // Also handle short greeting restarts where only the opener overlaps:
      // e.g. "Hey! I know" → "Hey, happy ..." (parallel-stream interleave).
      // Pattern doc: docs/error-patterns/transcript-stream-duplication.md
      const previousIsShort = previousTokens.length <= 6 && previous.trim().length <= 60
      const incomingLooksGreeting = looksLikeGreetingStart(incomingTrimmed)

	      if (
	        sharedAnyCount >= 2 ||
	        (commonPrefix >= 1 && previousTokens.length >= 3 && incomingTokens.length <= 3) ||
	        (incomingLooksGreeting && previousIsShort)
	      ) {
	        return shouldAllowShorteningReplace({ previous, incoming, previousTokens, incomingTokens })
	          ? { next: incoming, delta: "", kind: "replace" }
	          : { next: previous, delta: "", kind: "delta" }
	      }
	    }
	  }

  // Detect corrected cumulative snapshots that revise earlier words.
  // These can share a long prefix or have high token overlap, but won't
  // pass strict prefix checks. In these cases, replacing avoids duplicated
  // "restart" phrases in the UI.
  const previousMeaning = meaningfulTokenSet(previousTokens)
  const incomingMeaning = meaningfulTokenSet(incomingTokens)
  if (previousMeaning.size >= 8 && incomingMeaning.size >= 8) {
    const commonPrefix = countCommonPrefixTokens(previousTokens, incomingTokens)
    const overlap = intersectionSize(previousMeaning, incomingMeaning)
    const overlapMin = overlap / Math.min(previousMeaning.size, incomingMeaning.size)
    const overlapPrev = overlap / previousMeaning.size
    const overlapInc = overlap / incomingMeaning.size

    const shouldReplace =
      commonPrefix >= 5 ||
      overlapMin >= 0.85 ||
      ((overlapPrev >= 0.75 || overlapInc >= 0.75) && overlapMin >= 0.7)

	    if (shouldReplace) {
	      return shouldAllowShorteningReplace({ previous, incoming, previousTokens, incomingTokens })
	        ? {
	            next: incoming,
	            delta: "",
	            kind: "replace",
	          }
	        : { next: previous, delta: "", kind: "delta" }
	    }
	  }

  const overlapCount = findOverlapCount(previousTokens, incomingTokens)

  if (overlapCount > 0) {
    const lastOverlapToken = incomingTokens[overlapCount - 1]
    const allowOverlap =
      overlapCount >= 2 || (lastOverlapToken && shouldAcceptSingleTokenOverlap(lastOverlapToken.norm))

    if (allowOverlap) {
      const delta = incoming.slice(lastOverlapToken.end)
      return {
        next: previous + delta,
        delta,
        kind: "delta",
      }
    }
  }

  return {
    next: previous + incoming,
    delta: incoming,
    kind: "delta",
  }
}
