# Error Pattern: Env Gemini API Key Fallback

## What it looks like

Server API routes accept requests **without** a user-provided `X-Gemini-Api-Key` header because they silently fall back to `process.env.GEMINI_API_KEY`.

Symptoms:
- Public callers can hit `/api/gemini/*` and get successful responses without sending a key.
- Gemini quota/billing spikes even though no authenticated user action occurred.

## Why it happens

It’s tempting to add a “dev convenience” fallback in shared code (e.g., `getAPIKeyFromRequest()`), but in a deployed app it effectively turns your server into an unauthenticated proxy for Gemini:

- Any reachable endpoint can be used to consume your shared server key.
- Rate limits and quotas get burned by whoever discovers the endpoint.

## How to detect it automatically

Code checks:
- Grep for `process.env.GEMINI_API_KEY` usage in request/route code paths.
- Audit helpers like `getAPIKeyFromRequest()` for env fallbacks.

Behavior checks (tests):
- With `process.env.GEMINI_API_KEY` set, a request **without** `X-Gemini-Api-Key` should still be rejected (401).

