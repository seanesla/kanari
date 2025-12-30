# Error Pattern: OAuth PKCE/State Stored Client-Side But Exchanged Server-Side

## What it looks like

Google OAuth redirect returns to `/api/auth/google/callback` with a valid `code`, but token exchange fails with errors like:
- “Code verifier not found”
- “OAuth flow may have been tampered with”

Or, worse, the callback **never validates** the `state` parameter, weakening CSRF protection.

## Why it happens

PKCE requires two values generated during OAuth initiation:
- `state` (CSRF protection)
- `code_verifier` (PKCE secret)

If these are stored in `sessionStorage` (or any browser-only storage) but the token exchange happens in a server route handler:
- The server can’t read `sessionStorage`, so it can’t supply `code_verifier` to the token endpoint.
- The server can’t reliably validate `state`, so CSRF protection can be bypassed or unintentionally disabled.

## How to detect it automatically

Code checks:
- `generateAuthUrl()` or similar writes `state` / `code_verifier` to `sessionStorage` or `localStorage`.
- The OAuth callback handler is implemented server-side (Next.js route handler, API route, server action).
- Callback handler does **not** compare `state` query param with a server-stored value.

Behavior checks (tests):
- `exchangeCodeForTokens()` works in a Node (server) test without `window/sessionStorage`.
- Callback rejects when `state` does not match the value stored server-side.

## Preferred fix

Persist `state` and `code_verifier` server-side for a short TTL:
- Use `httpOnly` cookies (short-lived, `SameSite=Lax`) or a server session store.
- Validate `state` in the callback.
- Clear the temporary cookies after success/failure.

