# Accepted suggestions missing from Gemini Memory stats

## What it looks like
- Gemini Memory panel shows `0 Completed` even after the user marks suggestions as **Accepted**.
- Completed list is empty, but the Kanban board moves the item to the Completed column.
- Completion rate stays at 0% while scheduled/dismissed counts update.

## Why it happens
- `useSuggestionMemory` only counted `status === "completed"` when building memory context and stats.
- The app treats `accepted` as “done” in the Kanban/status mapping, so accepted items were never included in completion totals.

## How to detect automatically
- Unit test that feeds suggestions with `status: "accepted"` into the memory builder and asserts they appear in `completed` and `stats.totalCompleted`.
- Lint/search rule: flag filters on suggestions that check only `"completed"` without also considering `"accepted"` when computing completion metrics.

## Related code
- hooks/use-suggestion-memory.ts
- hooks/__tests__/use-suggestion-memory.test.ts
