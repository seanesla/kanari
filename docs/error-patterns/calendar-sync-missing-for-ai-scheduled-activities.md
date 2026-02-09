# Calendar sync missing for AI-scheduled activities

## What the error looks like

When the user tells the AI chat to schedule an activity (Gemini widget/tool `schedule_activity`):

- The UI shows a “Scheduled activity” confirmation.
- The activity appears (or should appear) in Kanari’s in-app calendar.
- But it **does not create a `RecoveryBlock`** in IndexedDB.
- The suggestion looks scheduled, but there is no persisted calendar block backing it.

## Why it happens

The `schedule_activity` widget handler was only writing a `Suggestion` (status `"scheduled"`) into IndexedDB, but it **did not call the calendar persistence path**:

- No persisted `RecoveryBlock` (which tracks scheduling metadata and powers calendar rendering)

This creates a split-brain state: the app believes something is scheduled, but nothing exists in calendar storage.

## How to detect it automatically

- Unit test: when `schedule_activity` is triggered, assert we call the local calendar scheduling function and persist a `RecoveryBlock`.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
- Code audit: search for any code paths that create a `Suggestion` with `status: "scheduled"` and a `scheduledFor` timestamp but do **not**:
  - create a `RecoveryBlock`, and/or
  - persist calendar state for that suggestion.

## Fix / prevention

- Centralize the “scheduled suggestion → calendar persist → RecoveryBlock persist” path and reuse it across:
  - scheduling from the dashboard calendar UI
  - scheduling from AI chat widgets/tools
- Keep “Undo” semantics consistent: remove both the suggestion and any linked `RecoveryBlock` entries.
