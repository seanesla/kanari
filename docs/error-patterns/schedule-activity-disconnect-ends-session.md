# Scheduling an activity ends the current check-in session

## What the error looks like

During an AI voice check-in, the user says something like:

- “Schedule me a check-in today at 10:00 PM.”

The app successfully creates the scheduled item (you see the `schedule_activity` confirmation), but then:

- The current check-in session abruptly transitions to **Complete** (synthesis screen).
- The user can’t continue talking with the AI in the same session.

## Why it happens

- Gemini Live can occasionally drop the WebSocket connection right after a tool call (notably `schedule_activity`).
- `hooks/use-check-in-session.ts` treats unexpected disconnects as an “end call” and finalizes the session (by design, to avoid losing data).
- When the disconnect is a transient post-tool-call drop, finalizing is the wrong UX: the user expects to keep chatting.

## How to detect it automatically

Hook-level test:

- Start a session, add a user message, simulate a `schedule_activity` widget event, then fire `onDisconnected("Session closed")`.
- Assert the hook attempts to reconnect (calls `gemini.connect()` again) and does **not** finalize the session.

See: `hooks/__tests__/use-check-in-session.test.ts`

## Fix / prevention

- When Gemini disconnects unexpectedly during an active session (and the user participated), attempt to reconnect and continue the same check-in.
- Do **not** auto-complete the session on disconnect; if reconnect fails, surface a connection error and let the user explicitly end/save if desired.

## References

- `hooks/use-check-in-session.ts`
- `hooks/use-check-in.ts`
- `hooks/use-check-in-widgets.ts`
