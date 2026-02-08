# Error Pattern: Journal Widget Saved State Hidden After Exit

## What it looks like

- A user taps **Save** in the check-in journal prompt, leaves the focused editor, then feels unsure whether anything was actually persisted.
- The collapsed journal card still looks like a fresh prompt, so users think they need to close/dismiss another popup to "finish saving".
- Leaving the editor can feel like it and saving are the same action, even though they are different code paths.

## Why it happens

This pattern appears when:

1. Persistence state (`saved` vs `draft`) is visible only in one UI mode (focused editor) and hidden in another mode (collapsed card).
2. Exit controls (back/close/dismiss) are visually prominent while save confirmation is transient or easy to miss.
3. The UI does not explicitly reinforce that drafts are local and only become persistent on `Save`.

## How to detect it automatically

- Tests: Render `JournalPrompt` in inline mode with `status: "saved"` and assert a clear saved confirmation is visible.
- Tests: Render focus mode with `status: "draft"` and assert explicit copy that draft text is not saved until `Save`.
- Tests: Simulate a `draft -> saved` status transition in focus mode and assert the component exits focus once saved (or otherwise surfaces explicit completion state).
- Code search: Find components with multi-mode views where status-driven copy appears in one mode but not the other.

## How we fix it in this repo

- Show an explicit success state in collapsed mode (`Saved to your journal.`) with a clear completion action (`Done`).
- Keep a visible reminder in focus mode that text is still a draft until `Save`.
- Auto-return from focus mode when the widget transitions from `draft` to `saved`, so users land on a clear post-save state instead of an ambiguous in-between view.
