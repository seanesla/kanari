## What it looks like

When starting a Gemini Live session, the UI shows a connection failure and the console includes an error like:

```
Invalid JSON payload received. Unknown name "enableAffectiveDialog" at "setup.generation_config": Cannot find field.
```

## Why it happens

`enableAffectiveDialog` is a preview feature for the Live API that is only accepted on the `v1alpha` API version.

If we send `enableAffectiveDialog: true` while the SDK is using a different API version (or the backend temporarily rejects the field), Gemini rejects the entire setup message and the session never connects.

## How we fix it

1. Force Live sessions to use `v1alpha`.
2. If Gemini still rejects the field, retry once without `enableAffectiveDialog` so the check-in can continue in standard mode.
3. Notify the user that affective mode was unavailable for that session.

Related code:
- `lib/gemini/live-client.ts`
- `lib/gemini/session-manager.ts`
- `hooks/use-check-in.ts`

## How to detect it automatically

- Unit tests:
  - `lib/gemini/__tests__/live-client.test.ts` asserts we use `v1alpha` and retry without the field.
  - `lib/gemini/__tests__/session-manager.test.ts` asserts the same behavior on the server-side session manager.
- Static scan:
  - Search for experimental Live config fields like `enableAffectiveDialog`.
  - Verify that any `v1alpha`-only fields are paired with an explicit `httpOptions.apiVersion = "v1alpha"`.
