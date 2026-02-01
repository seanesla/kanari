# Suggestion completion: feedback dialog hidden after “Mark Complete”

## What it looks like

- You click “Mark Complete” (or “Done”) on a scheduled suggestion.
- The dialog closes and *nothing happens*.
- When you open the same suggestion again and click “Mark Complete” a second time, the feedback dialog finally appears.
- After giving feedback, the suggestion completes.

## Why it happens

The completion flow intentionally:

1. stores the suggestion being completed in local state, then
2. closes the suggestion detail dialog by clearing the selected suggestion in the parent, then
3. shows the effectiveness feedback dialog.

If the detail component has an early return like `if (!suggestion) return null`, the parent’s “close” step removes `suggestion` and the component stops rendering **before** the feedback dialog can appear — even though local state says it should be open. The feedback only appears later when `suggestion` becomes non-null again (after a second click).

## How to detect it automatically

- Regression test: render the detail dialog inside a parent that clears `suggestion` when `onOpenChange(false)` is called; click “Mark Complete”; assert the feedback dialog is immediately visible.

## Fix

- Don’t early-return while the feedback dialog is open.
- Render the feedback dialog independently of whether the detail dialog is currently open (i.e., `suggestion` can be null while feedback is shown).

Related implementation: `components/dashboard/suggestions/suggestion-detail-dialog.tsx`.

