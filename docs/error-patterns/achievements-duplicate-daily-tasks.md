# Achievements page shows duplicate daily tasks

## What the error looks like

On the Achievements page, the “Today’s Focus” daily achievements list contains the same challenge more than once (e.g. two “Do Two Suggestions” cards).

Side effects:

- Auto-tracked challenges may auto-complete twice, awarding points twice.
- The daily list looks “buggy” and users don’t know which one to follow.

## Why it happens

The daily achievements system supports carry-over:

- Incomplete challenges from yesterday can be moved to today (`carriedOver: true`).

If generation falls back to the offline starter set (most commonly when the Gemini API key is missing/unconfigured), the starter set can include the same challenge as a carried-over one. If the client persists both, you get duplicates for the same day.

A second (less common) source is the model returning duplicated achievements in its response. If the client slices to `requestedCount` *before* de-duping, it may persist duplicates even if later items were unique.

## How to detect it automatically

Hook-level regression test:

- Seed an incomplete challenge for yesterday that will carry over (e.g. `tracking.key = "complete_suggestions"`).
- Mock “no API key” so generation uses the starter fallback.
- Call `ensureToday()` and assert only one copy exists for today.

See: `hooks/__tests__/use-achievements-no-duplicate-daily-tasks.test.ts`

## Fix / prevention

- Define a stable de-dupe key:
  - Challenges: `challenge:${tracking.key}:${tracking.target}`
  - Badges / untracked challenges: `type:${normalizedTitle}`
- When persisting generated achievements for a day:
  - De-dupe within the candidate set.
  - De-dupe against already-active achievements for that day (including carry-overs).
  - Only then take up to `requestedCount` and `bulkAdd()`.
- De-dupe the hook’s view-model (`achievementsToday`, `history`) so UI + auto-completion cannot double-count even if legacy duplicates exist in IndexedDB.

## References

- `hooks/use-achievements.ts`

