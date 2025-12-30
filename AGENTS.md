# AGENTS.md

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
1. **Voice Note mode**: `AudioRecorder` → VAD → Meyda features → IndexedDB → Gemini Flash analysis
2. **AI Chat mode**: Real-time voice via `use-gemini-live.ts` → WebSocket → Gemini Live API
3. `lib/ml/forecasting.ts` predicts 3-7 day burnout risk from acoustic trends
4. Gemini generates recovery suggestions → user schedules via Google Calendar

### Key Directories
- `app/api/gemini/live/` - Gemini Live streaming routes (WebSocket proxy)
- `components/check-in/` - Check-in dialog, voice indicator, conversation UI
- `components/dashboard/` - Dashboard UI (recording, charts, kanban, history)
- `hooks/` - `use-check-in`, `use-gemini-live`, `use-audio-playback`, `use-recording`, `use-storage`
- `lib/audio/` - Web Audio, VAD, Meyda features, PCM conversion
- `lib/gemini/` - API client, prompts, `live-client.ts` (WebSocket), mismatch detection
- `lib/ml/` - Forecasting, inference, `thresholds.ts` (constants)

### State Management
- `SceneProvider` - Scene mode, accent color, loading
- `NavbarProvider` - Navigation state
- Domain hooks: `use-check-in` (orchestrates Voice Note/AI Chat modes), `use-gemini-live` (WebSocket session)

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
