# kanari

**A browser-based early warning system for burnout that analyzes your voice, predicts risk 3-7 days ahead, and schedules recovery time on your calendar.**

[![Gemini 3 Hackathon](https://img.shields.io/badge/Google%20DeepMind-Gemini%203%20Hackathon-4285F4?style=flat-square&logo=google&logoColor=white)](https://gemini3.devpost.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Browser-orange?style=flat-square)]()

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Gemini 3 Integration](#gemini-3-integration)
4. [Key Differentiators](#key-differentiators)
5. [How It Works](#how-it-works)
6. [Technology Stack](#technology-stack)
7. [Privacy Architecture](#privacy-architecture)
8. [Getting Started](#getting-started)
9. [Project Structure](#project-structure)
10. [Links](#links)
11. [Team](#team)
12. [License](#license)

---

## Problem Statement

Burnout is widespread. Gallup reports 76% of employees experience burnout at least sometimes, with 28% reporting they feel burned out "very often" or "always." But most people only recognize burnout after the damage is done. Traditional self-reporting tools are unreliable because people experiencing burnout often lack the self-awareness to accurately assess their state.

Existing solutions fall into two categories:

| Category | Examples | Limitations |
|----------|----------|-------------|
| Clinical voice biomarker platforms | Sonde Health, Kintsugi, Ellipsis Health | Primarily enterprise/B2B focused, require cloud processing |
| Consumer wellness apps | Earkick, voice journaling apps | React to current mood only, no predictive forecasting, require app installation |

**Gap:** We have not found an existing solution that combines browser-based access, client-side privacy, predictive forecasting, and calendar integration.

---

## Solution Overview

kanari is a privacy-first web application that helps remote workers, students, and professionals detect early signs of burnout through short daily voice recordings.

Users record 30-60 seconds describing their day. The app analyzes vocal biomarkers entirely within the browser, predicts burnout risk for the next 3-7 days, and optionally schedules recovery time on the user's calendar.

**Core capabilities:**

- Voice analysis for stress and fatigue biomarkers (speech rate, volume fluctuations, pause patterns, spectral energy, MFCCs)
- Longitudinal trend tracking across multiple sessions
- 3-7 day predictive risk forecasting
- Gemini 3-powered personalized intervention suggestions
- Calendar integration for proactive scheduling of recovery blocks

---

## Gemini 3 Integration

Gemini 3 is central to kanari's intervention engine. While vocal biomarker extraction and trend analysis happen locally in the browser, Gemini 3 transforms raw wellness scores into actionable, personalized recommendations.

### How Gemini 3 is Used

**1. Personalized Suggestion Generation**

When vocal biomarkers indicate elevated stress or a concerning trend, the app sends a structured summary (numerical scores only, never audio or transcripts) to Gemini 3. The model generates context-aware recovery suggestions based on:

- Current stress/fatigue score
- Trend direction and duration
- Time of day and day of week
- Upcoming calendar density (if calendar is connected)
- User-specified preferences (work style, break preferences)

**2. Pattern Interpretation**

Gemini 3 analyzes longitudinal data to identify meaningful patterns that simple threshold-based rules would miss. This includes detecting gradual declines that precede burnout episodes and distinguishing between temporary stress spikes and sustained concerning trends.

**3. Calendar Action Generation**

When the user opts to schedule recovery time, Gemini 3 generates appropriate calendar event details (title, duration, description) based on the specific intervention recommended.

### Example API Call

```javascript
const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': GEMINI_API_KEY
  },
  body: JSON.stringify({
    contents: [{
      parts: [{
        text: `Based on the following wellness data for a remote worker:
- Current stress score: ${stressScore}/100
- Fatigue score: ${fatigueScore}/100
- Trend: ${trendDirection} over past ${trendDays} days
- Time: ${currentTime}
- Day: ${dayOfWeek}
- Upcoming meetings in next 4 hours: ${meetingCount}

Generate 3 specific, actionable recovery suggestions that:
1. Can be completed in 15 minutes or less
2. Are appropriate for a home office environment
3. Address the specific pattern observed

Format as JSON array with fields: suggestion, duration_minutes, rationale`
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500
    }
  })
});
```

### Privacy Boundary

Gemini 3 receives only:
- Aggregate numerical scores (stress, fatigue, trend values)
- Contextual metadata (time, day, calendar density)
- User preferences (if configured)

Gemini 3 never receives:
- Raw audio recordings
- Transcribed speech content
- Personal identifiers

---

## Key Differentiators

Based on competitive analysis of the voice biomarker and mental wellness market:

| Differentiator | kanari | Competitors |
|----------------|----------------|-------------|
| **Platform** | Browser (any device, no install) | Native apps or enterprise APIs |
| **Processing** | Entirely client-side | Cloud-based |
| **Prediction** | 3-7 day forecasting | Current state only |
| **Calendar Integration** | Auto-schedules recovery blocks | Display only or none |
| **Access Model** | Free, no account required | Subscription or enterprise license |

**Why these matter:**

- **Browser-based:** Zero friction adoption. Works on Chromebooks, locked-down work laptops, borrowed devices.
- **Predictive:** The difference between "you seem stressed" and "you're heading toward high burnout risk by Thursday" is the difference between a mood tracker and a prevention tool.
- **Calendar integration:** Closes the "so what" loop. Does not just tell you to take a break; schedules it.
- **Client-side:** For users who care about privacy, "never leaves your device" is categorically different from "encrypted in transit."

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   1. RECORD          2. ANALYZE           3. PREDICT         4. ACT        │
│                                                                             │
│   ┌─────────┐       ┌─────────────┐      ┌──────────┐      ┌─────────┐     │
│   │  30-60  │       │   Extract   │      │  Compare │      │ Gemini 3│     │
│   │ seconds │──────▶│   Features  │─────▶│  Against │─────▶│ Suggests│     │
│   │  voice  │       │  (browser)  │      │  History │      │ Actions │     │
│   └─────────┘       └─────────────┘      └──────────┘      └─────────┘     │
│                            │                   │                 │         │
│                            ▼                   ▼                 ▼         │
│                     ┌─────────────┐      ┌──────────┐      ┌─────────┐     │
│                     │ Web Audio   │      │ IndexedDB│      │ Google  │     │
│                     │ + Meyda     │      │ (local)  │      │ Calendar│     │
│                     │ + TF.js     │      │          │      │   API   │     │
│                     └─────────────┘      └──────────┘      └─────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Step 1: Record**
User speaks naturally for 30-60 seconds about their day, current state, or anything on their mind. The prompt is intentionally open-ended to capture natural speech patterns.

**Step 2: Analyze**
The browser extracts vocal biomarkers locally using Web Audio API and Meyda. Features include:
- Speech rate (syllables per second, computed from energy envelope)
- Volume (RMS energy and variation)
- Pause patterns (frequency and duration)
- Spectral features (MFCCs, spectral centroid, spectral flux, spectral rolloff)

Voice activity detection (Silero VAD) ensures only speech segments are analyzed. Pitch/F0 extraction is handled separately via autocorrelation.

**Step 3: Predict**
Current features are compared against the user's historical baseline stored in IndexedDB. A TensorFlow.js model analyzes the trend to forecast burnout risk for the next 3-7 days.

**Step 4: Act**
Gemini 3 generates personalized intervention suggestions. If the user connects their calendar, the app can automatically schedule recovery blocks.

---

## Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework with App Router |
| React 19.x | Component-based UI |
| Tailwind CSS 4.x | Utility-first styling |
| Framer Motion | Animations and transitions |
| Recharts | Trend visualization |

### Audio Processing

| Technology | Purpose |
|------------|---------|
| Web Audio API | Microphone access and real-time capture |
| Meyda | Audio feature extraction (MFCCs, spectral centroid, RMS, spectral flux) |
| @ricky0123/vad-web | Voice activity detection using Silero VAD via ONNX |

### Machine Learning

| Technology | Purpose |
|------------|---------|
| TensorFlow.js | On-device inference for stress/fatigue classification |
| @huggingface/transformers.js | Speech emotion recognition model (DistilHuBERT-based) |
| ONNX Runtime Web | WebAssembly-based model execution for VAD |

### Storage and Integration

| Technology | Purpose |
|------------|---------|
| IndexedDB | Local storage for historical data |
| Web Crypto API | AES-GCM encryption for stored metrics |
| Google Calendar API v3 | Recovery block scheduling |

### AI

| Technology | Purpose |
|------------|---------|
| Gemini 3 API | Personalized suggestion generation and pattern interpretation |

---

## Privacy Architecture

kanari processes voice entirely in the browser. Raw audio never leaves the device.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │   Audio ──▶ Features ──▶ Scores ──▶ Encrypted Storage    │  │
│  │                  │                                        │  │
│  │   Raw audio deleted immediately after feature extraction  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Numerical scores only
                              ▼
                    ┌─────────────────┐
                    │   Gemini 3 API  │
                    │   (generates    │
                    │   suggestions)  │
                    └─────────────────┘
```

**What stays on device:**
- All raw audio (deleted after feature extraction)
- All vocal biomarker features
- All historical trend data (encrypted in IndexedDB)

**What is sent to Gemini 3:**
- Aggregate stress/fatigue scores (numbers only)
- Trend direction and duration
- Time and day context
- User preferences (if configured)

**What is never collected:**
- Audio recordings
- Transcribed speech
- Email addresses or personal identifiers
- Location data

---

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- Modern browser: Chrome 111+, Safari 16.4+, Firefox 128+ (required by Tailwind CSS v4)
- Microphone access
- Gemini API key (obtain from [Google AI Studio](https://aistudio.google.com/))

### Installation

```bash
# Clone the repository
git clone [REPOSITORY_URL]
cd kanari

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env

# Add your Gemini API key to .env
# GEMINI_API_KEY=your_api_key_here

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
pnpm build
pnpm start
```

---

## Project Structure

```
kanari/
├── public/
│   └── models/              # ONNX models for VAD and emotion recognition
├── app/
│   ├── page.tsx             # Landing page
│   ├── layout.tsx           # Root layout with providers
│   ├── globals.css          # Global styles and CSS variables
│   └── dashboard/
│       ├── page.tsx         # Dashboard overview with trends
│       ├── record/          # Voice recording interface
│       ├── history/         # Recording history
│       ├── suggestions/     # Gemini-powered recommendations
│       └── settings/        # App settings and integrations
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── scene/               # 3D background (React Three Fiber)
│   └── dashboard/           # Dashboard-specific components
├── lib/
│   ├── types.ts             # TypeScript type definitions
│   ├── utils.ts             # Utility functions
│   ├── constants.ts         # App constants
│   ├── scene-context.tsx    # 3D scene state management
│   └── navbar-context.tsx   # Navigation state
└── README.md
```

---

## Links

| Resource | URL |
|----------|-----|
| Live Demo | [TO BE ADDED] |
| Demo Video | [TO BE ADDED] |
| Code Repository | [TO BE ADDED] |
| Devpost Submission | [TO BE ADDED] |

---

## Team

| Name | Role | Contact |
|------|------|---------|
| [TO BE ADDED] | [TO BE ADDED] | [TO BE ADDED] |

---

## Hackathon Submission Details

**Hackathon:** Google DeepMind Gemini 3 Hackathon

**Submission Period:** December 17, 2025 - February 9, 2026

**Gemini 3 Features Used:**
- Text generation for personalized wellness interventions
- Pattern analysis for burnout trend interpretation
- Structured output generation for calendar event creation

**Judging Criteria Addressed:**

| Criterion | Weight | How Addressed |
|-----------|--------|---------------|
| Technical Execution | 40% | Client-side ML pipeline, Gemini 3 integration, calendar API |
| Innovation/Wow Factor | 30% | Browser-based burnout predictor with predictive forecasting and calendar integration |
| Potential Impact | 20% | Addresses widespread employee burnout (76% affected per Gallup) |
| Presentation/Demo | 10% | Clear problem definition, architectural diagram, live demo |

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Disclaimer

kanari is a wellness tool, not a medical device. It is not intended to diagnose, treat, cure, or prevent any disease or medical condition. If you are experiencing severe stress, anxiety, depression, or other mental health concerns, please consult a qualified healthcare professional.
