# Check-in results missing after disconnect / early end

## What it looks like

- You end a check-in (or it stops automatically) and the UI **does not show** the biomarker/synthesis screen (stress, fatigue, etc.).
- The check-in sometimes **does not appear in History**.

## Why it happens

- `hooks/use-check-in-session.ts` handled Gemini disconnects by cleaning up and setting UI state, but **did not finalize the session** (no `endedAt`, no session-level metrics/audio capture, and no `onSessionEnd` callback to persist).
- UI persistence logic inferred “user participation” from `session.messages.length <= 1`. When transcripts fail to commit before the session ends/disconnects, the session can look like “AI greeting only”, so it is **skipped**.
- Cleanup logic (`deleteIncompleteSessions`) also used `messages.length <= 1` and could **delete** sessions that actually had voice metrics.

## How to detect it automatically

- Hook-level test:
  - Start a session, add a user message, then fire `onDisconnected("network lost")`.
  - Assert the hook finalizes and triggers `onSessionEnd` with `endedAt`.
- UI-level test:
  - Invoke the `onSessionEnd` callback with a session that has `acousticMetrics` but only an assistant message.
  - Assert the session is still saved.

## Fix

- Treat unexpected disconnects like an explicit “End call”:
  - finalize the session (compute metrics, capture audioData, set `endedAt`)
  - invoke `onSessionEnd` so storage/history updates consistently
- Determine participation using **user messages OR voice metrics**, not message count alone.
- Do not delete “incomplete” sessions purely by message count if they have voice metrics.

## References

- `hooks/use-check-in-session.ts`
- `components/check-in/check-in-dialog.tsx`
- `components/dashboard/check-in-ai-chat.tsx`
- `hooks/use-storage.ts`
- Regression tests:
  - `hooks/__tests__/use-check-in-session.test.ts`
  - `components/dashboard/__tests__/check-in-ai-chat.test.tsx`

