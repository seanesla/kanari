# Microphone init fails with NotAllowedError

## What it looks like

- In the browser console, `navigator.mediaDevices.getUserMedia()` rejects with a `DOMException` such as:
  - `NotAllowedError: The request is not allowed by the user agent or the platform in the current context...`
  - `SecurityError` (often when embedded / blocked by policy)
- The UI may show a generic "connection" error even though the real issue is microphone access.

## Why it happens

Common causes:

1. User denied microphone permission (or previously clicked "Block")
2. Insecure context (`http://` on a non-localhost origin). This is especially common when testing on a phone via a LAN IP.
3. The page is embedded in an iframe and microphone access is blocked by browser policy / Permissions Policy.
4. Platform quirks (notably some Safari/iOS flows) where permission prompts are stricter.

## How to detect it automatically

- Catch errors from `getUserMedia()` and inspect:
  - `error.name` (preferred) or
  - fallback to `error.message` in mocked/test environments
- If `window.isSecureContext === false`, assume mic will be blocked.

## Fix / mitigation

- Surface a user-facing error message that tells them how to allow microphone access.
- Include guidance for insecure contexts: "Use https (or http://localhost)".
- Avoid logging these as `console.error` in development; they are often expected user/environment issues.

## References in code

- `hooks/use-check-in-audio.ts`
