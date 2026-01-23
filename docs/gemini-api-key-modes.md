# Gemini API Key Modes (BYO vs Built-in)

Kanari supports two ways to provide a Gemini API key:

1. **Use Kanari's built-in key** (demo/hackathon)
   - Configure `NEXT_PUBLIC_GEMINI_API_KEY` in your deployment environment.
   - This key is used automatically by default when present.
   - Important: `NEXT_PUBLIC_*` env vars are shipped to the browser.

2. **Bring your own key** (recommended for production)
   - Users paste their own key in Settings.
   - Stored locally in IndexedDB (browser storage).

## How Kanari decides which key to use

- Setting: `UserSettings.geminiApiKeySource`
  - `"kanari"` -> use `NEXT_PUBLIC_GEMINI_API_KEY`
  - `"user"` -> use `UserSettings.geminiApiKey`
- Backwards-compatible behavior:
  - If no source is stored, Kanari prefers a real user key, otherwise it falls back to the env key.
  - The demo placeholder `"DEMO_MODE"` never auto-falls-back to the env key.

## Rate limits

Gemini rate limits are per-model and per-quota tier, and they can change over time.

- Official docs: https://ai.google.dev/gemini-api/docs/rate-limits
- If you exceed the limit you may see HTTP `429 RESOURCE_EXHAUSTED`.

Kanari also applies a small app-level rate limit on server routes *when the built-in key is selected*,
to reduce accidental abuse of a shared key.
