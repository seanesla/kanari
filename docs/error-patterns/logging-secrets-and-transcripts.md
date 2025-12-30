# Error Pattern: Logging Secrets and User Transcripts

## What it looks like

Server logs contain sensitive data such as:
- Per-session secrets (used to authorize SSE/audio endpoints).
- Raw user transcripts (speech-to-text).
- Tool call arguments (may include user content).

This often shows up as `console.log(JSON.stringify(...))` in API routes or session managers.

## Why it happens

During integration/debugging, it’s convenient to log “the whole payload” to understand what the model or client is sending. In production (or shared dev environments), those logs become:
- A source of secret leakage (anyone with log access can replay sessions).
- A privacy risk (transcripts are highly sensitive personal data).

## How to detect it automatically

Code checks:
- Grep for `console.log(` / `console.error(` in server routes that handle:
  - OAuth tokens
  - Session secrets
  - Audio/transcript payloads
- Flag patterns like `JSON.stringify(responseData)` where `responseData` includes secrets.

Behavior checks:
- Ensure sensitive fields (e.g., `secret`, `access_token`, transcripts) never appear in server logs, even in development.

## Preferred fix

- Remove logs that include secrets or transcripts.
- If logging is required, log only metadata (IDs, booleans, sizes) and gate behind dev-only logging.
- Redact any token-like values before logging.

