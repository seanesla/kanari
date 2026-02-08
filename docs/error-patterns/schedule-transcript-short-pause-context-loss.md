# scheduling context loss from short-pause transcript splits

## What the error looks like

During voice scheduling, a user gives one intent across short pauses, for example:

- "schedule study from 3pm"
- "to 8pm Monday through Friday"
- "until March 1st"

But the app treats these as separate turns and only uses the latest fragment when resolving tool args.
This causes wrong or missing fields (duration/title/time), failed recurring scheduling, or confirmations that do not match calendar state.

## Why it happens

- Voice activity detection can emit end-of-speech on brief pauses.
- The app previously finalized user turns immediately on speech-end.
- Scheduling resolution used only the single latest user message instead of the active scheduling intent context.
- Speech-to-text artifacts like `28pm` (from "to 8pm") were not normalized.

## How to detect it automatically

- Add tests where one scheduling request is split into multiple user transcript chunks/turns.
- Assert that scheduling uses combined context (title, duration, recurrence stop condition) across those chunks.
- Add parser tests for STT artifacts (`28pm`, `2 8pm`) and range-derived duration (`from 3pm to 8pm` => 300).
- See:
  - `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
  - `hooks/__tests__/use-check-in-messages.test.ts`
  - `lib/scheduling/__tests__/time.test.ts`
  - `lib/scheduling/__tests__/duration.test.ts`

## Fix / prevention

- Add a short merge window before finalizing speech-end so brief pauses stay in one utterance.
- Tune Live API realtime activity detection to be less aggressive (`silenceDurationMs`, low end sensitivity).
- Resolve scheduling args from the latest scheduling-intent context window, not just the newest user bubble.
- Normalize STT artifacts in time parsing and support time-range duration extraction.
- Return structured `invalid_args` details in tool responses so the model can self-correct instead of falsely confirming success.
