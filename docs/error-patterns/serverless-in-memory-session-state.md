# Error Pattern: In-Memory Session State in Serverless Runtimes

## What it looks like

Everything works locally, but in production (e.g. Vercel serverless):
- Session creation succeeds, then follow-up requests intermittently fail with `404` (“Session not found”) or `403`.
- Failures happen mid-flow (often after an initial successful response), because later requests hit a different instance.

Example symptoms for “create session → stream → send audio” flows:
- `POST /api/.../session` succeeds
- `GET /api/.../stream` works briefly
- `POST /api/.../audio` returns `404` because the instance handling it doesn’t have the in-memory session

## Why it happens

Serverless functions are **stateless** across requests:
- Each request may run on a different instance.
- `globalThis` singletons and `Map()` caches are **per-instance**, not shared.
- Long-lived resources (WebSockets, streams, SDK sessions) can’t be relied on across separate HTTP invocations.

## How to detect it automatically

Code checks:
- A “session manager” stores sessions in a process-local structure (`Map`, module-level object, `globalThis`).
- API routes require a session ID/secret that is only stored in memory.
- A comment or pattern like “singleton to survive hot reload”.

Behavior checks:
- An integration test that performs `create → stream → send` with multiple requests can be made to fail by forcing separate processes/instances (or by simulating missing state on the second request).

## Preferred fixes

Pick one (don’t combine “stateless HTTP” with “stateful sessions”):

1. **Move the session to the client**  
   If the upstream supports browser WebSockets, connect directly from the browser and avoid server-side session state entirely.

2. **Use a stateful backend for stateful sessions**  
   Run a dedicated WebSocket server / durable runtime (not per-request serverless route handlers) to own the upstream connection.

3. **Shared storage is not enough for live connections**  
   Redis/KV can store metadata, but it cannot store an active WebSocket/SDK session. If the session is a live connection, you still need (1) or (2).

