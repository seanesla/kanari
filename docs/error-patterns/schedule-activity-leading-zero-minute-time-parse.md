# schedule_activity leading-zero minute time parse

## What the error looks like

When a user says a time like `9:07 PM`, explicit-time parsing can fail.

Downstream effects:

- user-time correction does not run for `schedule_activity` tool args
- fallback auto-scheduling may skip because it cannot extract a single explicit time

## Why it happens

The explicit-time parser supports both:

- `HH:MM AM/PM` (e.g. `9:07 PM`)
- short `H AM/PM` (e.g. `9 PM`)

The short pattern accidentally matched the minute fragment (`07 PM`) inside `9:07 PM`.
That produced two distinct matches (`21:07` and `19:00`), so the parser rejected the input as ambiguous.

## How to detect it automatically

- **Unit test**
  - Assert `extractExplicitTimeFromText("Schedule at 9:07 PM")` returns `{ hour: 21, minute: 7 }`.
  - See: `lib/scheduling/__tests__/time.test.ts`

- **Scheduling integration test**
  - Use a fallback auto-scheduling request that includes `9:07 PM` and assert the schedule is created.
  - See: `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`

## Fix / prevention

- Ignore short `H AM/PM` matches when the match is immediately preceded by `:` or `.`.
- Keep strict ambiguity protection for genuinely multi-time inputs (`9pm or 10pm`).

## References

- `lib/scheduling/time.ts`
- `lib/scheduling/__tests__/time.test.ts`
- `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
