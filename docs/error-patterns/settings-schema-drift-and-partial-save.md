# Error Pattern: Settings Schema Drift + Partial Save

## What it looks like

- A settings screen “saves”, but some settings never persist (or revert on refresh).
- The settings UI uses fields that don't exist in `UserSettings` (e.g. `dailyReminder` vs `dailyReminderTime`).
- Clicking **Save** unexpectedly overwrites unrelated settings because the saved object is incomplete or built from stale defaults.

## Why it happens

This pattern usually shows up when:

1. The UI maintains its own `DraftSettings` type that drifts from the canonical `UserSettings` schema.
2. Only a subset of settings is hydrated from storage on mount.
3. Saving uses an object constructed from defaults + partial UI state, which can silently:
   - drop fields that weren’t included, or
   - revert fields that weren’t loaded into state.

## How to detect it automatically

- Type-level: Avoid standalone `DraftSettings` types; derive drafts from `UserSettings` with `Pick<>`.
- Tests: Render settings, mutate multiple controls, click Save once, and assert a single storage write includes *all* editable fields.
- Code search: Look for `db.settings.put(...)` with “defaults” + partial settings state, or any settings UI that doesn’t load the fields it saves.

## How we fix it in this repo

- Centralize defaults in `lib/settings/default-settings.ts`.
- Hydrate the full editable draft from `db.settings.get("default")`.
- Track a `baseline` snapshot and compute `isDirty`.
- Save via `db.settings.update("default", updates)` (fallback to `put(createDefaultSettingsRecord(updates))` if missing).

