# CLAUDE.md

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

Copy `.env.example` to `.env` with:
- `GEMINI_API_KEY` - Required for semantic audio analysis
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` - For Calendar integration

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
