# Settings `put(createDefaultSettingsRecord(...))` overwrites fields

## What the error looks like

- User completes onboarding (entered name), but immediately gets prompted again for their name.
- A setting like `accentColor`, `timeZone`, or `selectedGeminiVoice` saves correctly, but **other settings silently reset**.
- In IndexedDB, `settings.id = "default"` exists, but fields like `userName` are suddenly `undefined`.

## Why it happens

Many call sites use this pattern:

1. `db.settings.update("default", updates)`
2. If the result is `0` (record missing), fall back to:
   `db.settings.put(createDefaultSettingsRecord(updates))`

`put()` is an **upsert**.

If another write creates `settings.default` between (1) and (2), the fallback `put()` will overwrite the entire record with defaults + `updates`, wiping any fields that weren't included in `updates` (e.g. `userName`).

This can happen in real flows when one function fires-and-forgets a settings write (no `await`), while another step creates the record immediately after.

## How to fix

- Never use `put(createDefaultSettingsRecord(partialUpdates))` as a fallback after an `update()` miss.
- Use a **race-safe patch helper**:
  - `update()` first
  - if missing, try `add()` (not `put()`)
  - if `add()` fails with `ConstraintError`, retry `update()`

In this repo, use `lib/settings/patch-settings.ts` (`patchSettings`).

## How to detect it automatically

- Search for `db.settings.put(createDefaultSettingsRecord(`
- Search for `updated === 0` near settings writes

Any instance of that pattern is a candidate for this bug.
