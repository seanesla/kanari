# Calendar sync missing for AI-scheduled activities

## What the error looks like

When the user tells the AI chat to schedule an activity (Gemini widget/tool `schedule_activity`):

- The UI shows a “Scheduled activity” confirmation.
- The activity appears (or should appear) in Kanari’s in-app calendar.
- But it **does not create a Google Calendar event**, even when Google Calendar is connected.
- The in-app calendar event also won’t show the “GC” (Google Calendar) synced indicator because no `RecoveryBlock` record exists.

## Why it happens

The `schedule_activity` widget handler was only writing a `Suggestion` (status `"scheduled"`) into IndexedDB, but it **did not call the calendar sync path**:

- No call to `POST /api/calendar/event`
- No persisted `RecoveryBlock` (which tracks `calendarEventId` and is used by the UI for “synced” state)

This creates a split-brain state: the app believes something is scheduled, but nothing exists in the external calendar.

## How to detect it automatically

- Unit test: when `schedule_activity` is triggered and calendar is connected, assert we call the calendar scheduling function and persist a `RecoveryBlock`.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
- Code audit: search for any code paths that create a `Suggestion` with `status: "scheduled"` and a `scheduledFor` timestamp but do **not**:
  - create a `RecoveryBlock`, and/or
  - attempt Google Calendar sync when connected.

## Fix / prevention

- Centralize the “scheduled suggestion → calendar sync → RecoveryBlock persist” path and reuse it across:
  - scheduling from the dashboard calendar UI
  - scheduling from AI chat widgets/tools
- Keep “Undo” semantics consistent: if the suggestion was synced to Google Calendar, best-effort delete the external event and remove the local `RecoveryBlock`.

