# kanari

**Predict burnout before it happens.** A browser-based early warning system that analyzes your voice, forecasts risk 3-7 days ahead, and schedules recovery time on your calendar.

[![Gemini 3 Hackathon](https://img.shields.io/badge/Google%20DeepMind-Gemini%203%20Hackathon-4285F4?style=flat-square&logo=google&logoColor=white)](https://gemini3.devpost.com)
[![Platform](https://img.shields.io/badge/Platform-Browser-orange?style=flat-square)]()

![kanari landing page with 3D geometric visualization](readmestuff/landingpagehero.gif)

---

## What is kanari?

kanari helps remote workers and professionals detect early signs of burnout through short daily voice recordings. Speak for 30-60 seconds about your day. The app analyzes vocal biomarkers in your browser, predicts burnout risk for the coming week, and suggests personalized recovery actions.

<!-- PLACEHOLDER: Demo GIF - voice recording flow showing microphone activation, waveform visualization, analysis spinner, results display with stress/fatigue scores -->

---

## Features

- **Voice Analysis**: Detects stress and fatigue from speech patterns, pitch variations, and pause timing
- **Predictive Forecasting**: Warns you 3-7 days before burnout risk peaks
- **Personalized Suggestions**: Gemini 3 generates context-aware recovery recommendations
- **Calendar Integration**: Automatically schedules recovery blocks on Google Calendar
- **Privacy-First**: Acoustic analysis runs entirely in your browser
- **Zero Friction**: No app install, no account required

<!-- PLACEHOLDER: Dashboard screenshot - overview page with trend charts, wellness score gauge, burnout forecast graph -->

---

## How It Works

1. **Record**: Speak naturally for 30-60 seconds about your day
2. **Analyze**: Local acoustic processing extracts vocal biomarkers while Gemini 3 detects emotional cues
3. **Predict**: Trends are compared against your baseline to forecast risk
4. **Act**: Get personalized suggestions and optionally schedule recovery time

<!-- PLACEHOLDER: Workflow diagram - 4 step horizontal visual with icons: microphone → waveform → chart → calendar -->

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| Audio | Web Audio API, Meyda, @ricky0123/vad-web |
| AI | Gemini 3 Flash API |
| Storage | IndexedDB (Dexie), Web Crypto API |
| Integration | Google Calendar API, Google OAuth 2.0 |

---

## Quick Start

```bash
git clone [REPOSITORY_URL]
cd kanari
pnpm install
cp .env.example .env.local  # Optional: Google Calendar OAuth
pnpm dev
```

Open `http://localhost:3000` in Chrome, Safari, or Firefox.
Add your Gemini API key in Settings (stored locally in IndexedDB).

---

## Privacy

All acoustic analysis happens locally in your browser. Audio is only sent to Gemini for semantic analysis (emotion detection, transcription). No personal identifiers are collected and no account is required.

---

## Hackathon

Built for the **Google DeepMind Gemini 3 Hackathon** (Dec 2025 - Feb 2026).

Uses Gemini 3 Flash for multimodal audio analysis, emotion detection, personalized suggestion generation, and calendar event creation.

---

## Links

| Resource | URL |
|----------|-----|
| Live Demo | `[LIVE_DEMO_URL]` |
| Demo Video | `[VIDEO_URL]` |
| Devpost | `[DEVPOST_URL]` |

---

## Team

| Name | LinkedIn |
|------|----------|
| Sean Esla | [linkedin.com/in/seanesla](https://linkedin.com/in/seanesla) |
| Aleksandr Ershov | [linkedin.com/in/aleksershov](https://linkedin.com/in/aleksershov) |

---

## Disclaimer

kanari is a wellness tool, not a medical device. It does not diagnose, treat, or prevent any disease. Consult a healthcare professional for mental health concerns.
