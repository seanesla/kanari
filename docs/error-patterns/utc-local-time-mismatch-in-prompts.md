# UTC/local time mismatch in prompts

## What it looks like

- The model greets with the wrong time-of-day (e.g., “Good morning!” at 10:45 PM local time).
- Time-aware behaviors (evening tone, “tonight”, etc.) feel inconsistent.

## Why it happens

- The app sends a “current time” string derived from `Date.toISOString()` (UTC) while also computing `timeOfDay` from local hours.
- Models may overweight the UTC timestamp (e.g., `06:45Z`) and ignore/underweight the separate `timeOfDay` field.
- A related variant: time context is only attached when optional context-summary generation succeeds, so failures silently drop time context entirely.

## How to detect it automatically

- Grep-based: flag prompt/context builders that use `toISOString()` as a *user-local* “current time” string.
- Code review checklist: if a prompt contains “Current time”, ensure it includes the user’s timezone or offset and is explicitly labeled “user local”.
- Unit test: `buildCheckInSystemInstruction()` should include an explicit local-time label (see `lib/gemini/__tests__/live-prompts.test.ts`).

## Fix

- Format a user-local time string and include a timezone identifier (e.g., `America/Los_Angeles`) or offset.
- Always send `timeContext` even when optional context-summary generation fails.

## References

- `lib/gemini/check-in-context.ts`
- `hooks/use-check-in.ts`
- `lib/gemini/live-prompts.ts`

