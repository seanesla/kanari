# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hackathon Context

**Google DeepMind Gemini 3 Hackathon** (Dec 17, 2025 - Feb 9, 2026)
Submission: kanari - browser-based burnout prediction using voice biomarkers and Gemini 3 Flash

## Commands

```bash
pnpm dev      # Dev server at localhost:3000
pnpm build    # Production build
pnpm lint     # ESLint
pnpm start    # Run production build
```

## Environment

Copy `.env.example` to `.env` with:
- `GEMINI_API_KEY` - Required for semantic audio analysis
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` - For Calendar integration

## Architecture

**Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4

### Data Flow
1. `AudioRecorder` captures voice → `AudioProcessor` applies VAD → `FeatureExtractor` (Meyda) extracts acoustic features
2. Features saved to IndexedDB (Dexie)
3. Audio sent to Gemini 3 Flash for semantic analysis (emotion, transcription)
4. `lib/ml/forecasting.ts` predicts 3-7 day burnout risk
5. Gemini generates personalized recovery suggestions
6. User schedules suggestions → Google Calendar API

### Key Directories
- `app/` - Next.js App Router pages (landing, dashboard/*)
- `components/scene/` - Three.js 3D visualization (landing page)
- `components/dashboard/` - Dashboard UI (recording, charts, kanban)
- `hooks/` - Recording, storage, calendar, suggestions state
- `lib/audio/` - Web Audio recording, VAD, Meyda feature extraction
- `lib/gemini/` - API client and prompts for Gemini 3 Flash
- `lib/calendar/` - Google OAuth PKCE flow and Calendar API
- `lib/storage/db.ts` - Dexie schema (recordings, suggestions, trendData)
- `lib/ml/` - Client-side forecasting and inference

### State Management
- `SceneProvider` - Scene mode (landing/dashboard), accent color, loading
- `NavbarProvider` - Navigation state, section tracking
- Custom hooks for domain logic (use-recording, use-storage, use-suggestions, use-calendar)

### APIs
- **Gemini 3 Flash**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`
- **Google Calendar**: OAuth 2.0 PKCE flow, events scope

## Key Patterns

- All acoustic analysis runs client-side (privacy-first)
- Audio only sent to Gemini for semantic analysis
- IndexedDB for offline-first storage
- `use-suggestions.ts` implements diff-aware updates (keep/update/drop/new)
- `lib/gemini/prompts.ts` contains all Gemini system prompts
- 3D scene uses react-three/fiber with scroll-responsive camera

## Config Notes

- `next.config.mjs`: `ignoreBuildErrors: true` (dev convenience)
- Path alias: `@/*` maps to project root
- Use `model: "opus"` (claude-opus-4-5) for Explore subagents

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
