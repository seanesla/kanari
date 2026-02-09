# Check-in greeting has no audio until the user replies

## What the error looks like

- On mobile, a new check-in opens and Kanari's first message appears as text.
- The user cannot hear the greeting audio.
- After the user speaks/replies once, later assistant turns play audio normally.

## Why it happens

- During the `ai_greeting` state (before playback has actually started), ambient microphone noise can trigger local barge-in logic.
- That early interruption clears/suppresses assistant output for the first turn.
- The UI then looks like "text arrived, but no voice" until the next user-driven turn resets conversation flow.

## How to detect it automatically

- Hook regression test:
  - Force `ai_greeting` state.
  - Simulate loud mic chunks/noise.
  - Assert the state does **not** switch to `user_speaking` and greeting audio is not cleared.
- Interrupt regression test:
  - Call `interruptAssistant()` while in `ai_greeting`.
  - Assert it does not clear queue / suppress first turn.

## Fix / prevention

- Only allow barge-in once assistant playback is truly active (`assistant_speaking`), not during `ai_greeting` pre-playback.
- Ignore manual interrupt requests during `ai_greeting`.
- Keep explicit regression tests for both state-machine interruption and mic-noise interruption paths.
