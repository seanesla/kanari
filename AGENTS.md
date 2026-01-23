# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

## Deployment

**Production:** https://kanari.space
**Auto-deploys:** Push to `main` triggers Vercel deployment
**No env vars required:** Users provide Gemini API key via Settings UI

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

Note: Gemini API keys are entered by the user in the Settings UI (no server env fallback).

## Architecture

**Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4

### Data Flow
1. **AI Voice Check-in**: `use-check-in` captures mic audio → Meyda features (client-side) → Gemini Live API (real-time conversation) → IndexedDB session storage
2. **Synthesis**: Post-check-in API generates insights, journal entries, and recovery suggestions
3. **Forecasting**: `lib/ml/forecasting.ts` predicts 3-7 day burnout risk from acoustic biomarker trends
4. **Scheduling**: User schedules recovery suggestions via Google Calendar

### Key Directories
- `app/api/gemini/live/` - Gemini Live streaming routes (WebSocket proxy)
- `app/api/gemini/synthesize/` - Post-check-in synthesis API (insights, journal entries)
- `components/check-in/` - Check-in dialog, voice picker, synthesis screen, conversation UI
- `components/dashboard/` - Dashboard UI (metrics, charts, kanban, history, insights panel, journal entries panel)
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

## Context7 (Library Docs)

Fetch up-to-date library documentation via MCP:

1. `mcp__context7__resolve-library-id` - Find library ID (e.g., `/vercel/next.js`)
2. `mcp__context7__query-docs` - Query docs with that ID

**Attribution:**
```typescript
// Source: Context7 - [library-id] docs - "[topic]"
```

Example:
```typescript
// Source: Context7 - schedule-x/schedule-x docs - "Timed Event Example"
// https://github.com/schedule-x/schedule-x/blob/main/website/app/docs/calendar/events/page.mdx
const startDateTime = instant.toZonedDateTimeISO(timeZone)
```

## OpenCode Subagents

**Explore Subagent**: Read-only codebase analysis. Use whenever you are searching files, mapping structure, and finding patterns without modifying code.

**General Subagent**: Multi-step task execution. Use for complex investigations, parallel work, and changes.


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
