# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

**Production:** https://kanari-three.vercel.app
**Auto-deploys:** Push to `main` triggers Vercel deployment
**No env vars required:** Users provide Gemini API key via Settings UI

## Naming: Dashboard vs Overview

- **Dashboard** = the route group (`app/dashboard/`) containing all app pages
- **Overview** = the main page at `/dashboard` (NOT called "Dashboard")

Do NOT rename `OverviewPage` to `DashboardPage` or change "Overview" labels to "Dashboard".

## Hackathon Context

**Google DeepMind Gemini 3 Hackathon** (Dec 17, 2025 - Feb 9, 2026)
Submission: kanari - browser-based burnout prediction using voice biomarkers and Gemini 3 Flash

## Commands

```bash
pnpm dev          # Dev server at localhost:3000
pnpm build        # Production build
pnpm lint         # ESLint
pnpm test         # Vitest watch mode
pnpm test:run     # Vitest single run
```

## Environment

Copy `.env.example` to `.env.local` with:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` - For Calendar integration

Gemini API keys are user-provided via Settings UI and sent to server routes via `X-Gemini-Api-Key` (no shared env fallback).

## Architecture

**Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4

### Data Flow
1. **AI Chat check-in**: `use-check-in` captures mic audio → Meyda features (client-side) → Gemini Live API (real-time) → IndexedDB session storage
2. `lib/ml/forecasting.ts` predicts 3-7 day burnout risk from check-in acoustic trends
3. Gemini generates recovery suggestions → user schedules via Google Calendar

### Key Directories
- `app/api/gemini/live/` - Gemini Live streaming routes (WebSocket proxy)
- `app/api/gemini/synthesize/` - Post-check-in synthesis API (insights, journal entries)
- `components/check-in/` - Check-in dialog, voice picker, synthesis screen, conversation UI
- `components/dashboard/` - Dashboard UI (recording, charts, kanban, history, insights panel, journal entries panel)
- `hooks/` - `use-check-in`, `use-gemini-live`, `use-audio-playback`, `use-recording`, `use-storage`, `use-voice-preview`
- `lib/audio/` - Web Audio, VAD, Meyda features, PCM conversion
- `lib/gemini/` - API client, prompts, `live-client.ts` (WebSocket), `synthesis-client.ts`, `voices.ts`, mismatch detection
- `lib/ml/` - Forecasting, inference, `thresholds.ts` (constants)
- `lib/settings/` - Default settings configuration

### State Management
- `SceneProvider` - Scene mode, accent color, loading
- `NavbarProvider` - Navigation state
- Domain hooks: `use-check-in` (orchestrates AI chat + biomarker capture), `use-gemini-live` (WebSocket session)

### APIs
- **Gemini Flash**: REST API for async analysis
- **Gemini Live**: WebSocket at `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`
- **Google Calendar**: OAuth 2.0 PKCE flow

## Key Patterns

- Privacy-first: acoustic analysis client-side, only audio sent to Gemini for semantics
- IndexedDB (Dexie) for offline-first storage
- `lib/logger.ts` for dev-only logging (`logDebug`, `logWarn`, `logError`)
- `lib/gemini/prompts.ts` and `live-prompts.ts` contain all system prompts
- Tests in `__tests__/` directories alongside source files

## Error Handling

- Prefer `KanariError` (`lib/errors.ts`) when an error needs a stable `code` and optional structured `context`.
- Hooks: avoid throwing; use `logError()` and dispatch error state.
- API routes: return structured JSON errors with appropriate HTTP status codes.
- Utilities: throw `Error`/`KanariError` with clear, actionable messages.

## Config Notes

- `next.config.mjs`: `ignoreBuildErrors: true` (dev convenience)
- Path alias: `@/*` maps to project root

## Agent Usage

**Always use Task subagents instead of calling MCP tools directly.** When asked to "use X agent" (e.g., "use context7-docs agent", "use Explore agent"), invoke `Task` with the appropriate `subagent_type` - do NOT call the underlying MCP tools directly, even if you have access to them.

## Documentation Attribution

When using Context7 to fetch library documentation, add a comment citing the source:
```typescript
// Source: Context7 - [library-id] docs - "[section/topic]"
// [URL to the source file if available]
```

Example:
```typescript
// Source: Context7 - schedule-x/schedule-x docs - "Timed Event Example"
// https://github.com/schedule-x/schedule-x/blob/main/website/app/docs/calendar/events/page.mdx
const startDateTime = instant.toZonedDateTimeISO(timeZone)
```

# Error fixing workflow

When I find or you report a bug:

1. Write a test first that reproduces the error
2. Fix the bug
3. Search the entire codebase for other instances of the same error pattern
4. Add tests for any other instances found
5. Document the error pattern in a markdown file:
   - What the error looks like
   - Why it happens
   - How to detect it automatically
   - Link this file in relevant comments

Goal: Don't fix one bug. Fix the class of bugs it belongs to.

Claude is AI and can make mistakes. Please double-check responses.
