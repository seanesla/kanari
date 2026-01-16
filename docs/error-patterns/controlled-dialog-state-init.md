# Error Pattern: Controlled Dialog State Init

## What it looks like

- A dialog opens, but its form state is uninitialized:
  - Primary action button stays disabled (e.g. “Schedule” is always disabled).
  - A date/time picker appears, but selecting “today” doesn’t enable scheduling.
- Often reproducible when the dialog is opened **programmatically** (state-driven), not via a direct click on the dialog trigger.

## Why it happens

Many dialog primitives (e.g. Radix) are controlled with an `open` prop and an `onOpenChange` callback.

`onOpenChange` fires in response to **user-driven** open/close events (overlay click, Escape, trigger click), but it does **not** fire just because the parent renders the dialog with `open={true}`.

If you initialize dialog state in `onOpenChange` like:

- `if (newOpen) setDefaults()`

…then opening the dialog via state (e.g. `setOpen(true)`) won’t run that initialization, leaving default selections unset.

## How to detect it automatically

- Add a regression test that renders the dialog with `open={true}` and asserts the primary CTA is enabled with valid defaults.
  - Example: `components/dashboard/suggestions/__tests__/schedule-time-dialog.test.tsx`

## How we fix it in this repo

- Initialize dialog defaults in a `useEffect` that runs when `open` becomes true (and the underlying entity/id changes), rather than relying on `onOpenChange`.

See: `components/dashboard/suggestions/schedule-time-dialog.tsx`
