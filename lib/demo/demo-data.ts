/**
 * Demo Mode Seed Data
 *
 * Pre-populated data for demo mode to showcase Kanari's features.
 * This data is seeded into IndexedDB when demo mode starts.
 */

import type {
  CheckInSession,
  CheckInMessage,
  TrendData,
  Suggestion,
  JournalEntry,
} from "@/lib/types"
import type {
  DailyAchievement,
  MilestoneBadge,
  UserProgress,
} from "@/lib/achievements/types"

// Helper to generate IDs
const generateId = () => `demo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

// Helper to get date N days ago
const daysAgo = (days: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

// Helper to format date as ISO string
const toISODate = (date: Date): string => date.toISOString().split("T")[0]

/**
 * Generate demo check-in sessions with realistic AI conversations
 */
export function generateDemoCheckInSessions(): CheckInSession[] {
  const now = new Date()

  const sessions: CheckInSession[] = [
    // Session 1: 5 days ago - high stress work session
    {
      id: generateId(),
      startedAt: daysAgo(5).toISOString(),
      endedAt: new Date(daysAgo(5).getTime() + 8 * 60 * 1000).toISOString(),
      messages: [
        {
          id: generateId(),
          role: "assistant",
          content: "Hey there! How are you feeling today?",
          timestamp: daysAgo(5).toISOString(),
        },
        {
          id: generateId(),
          role: "user",
          content: "Honestly, I'm feeling pretty overwhelmed. Work has been crazy with all these deadlines.",
          timestamp: new Date(daysAgo(5).getTime() + 30 * 1000).toISOString(),
          metrics: {
            stressScore: 72,
            fatigueScore: 58,
            stressLevel: "elevated",
            fatigueLevel: "tired",
            confidence: 0.85,
            analyzedAt: new Date(daysAgo(5).getTime() + 30 * 1000).toISOString(),
          },
        },
        {
          id: generateId(),
          role: "assistant",
          content: "I hear you - deadline pressure can really pile up. Your voice does sound a bit strained. What's the biggest thing weighing on you right now?",
          timestamp: new Date(daysAgo(5).getTime() + 60 * 1000).toISOString(),
        },
        {
          id: generateId(),
          role: "user",
          content: "There's this presentation I have to give tomorrow and I still don't feel prepared enough.",
          timestamp: new Date(daysAgo(5).getTime() + 120 * 1000).toISOString(),
        },
        {
          id: generateId(),
          role: "assistant",
          content: "That sounds stressful. One thing that might help: instead of trying to perfect everything, focus on your three key points. What matters most to your audience? Also, a 10-minute walk before tomorrow could help settle those nerves.",
          timestamp: new Date(daysAgo(5).getTime() + 180 * 1000).toISOString(),
        },
      ] as CheckInMessage[],
      duration: 480,
      acousticMetrics: {
        stressScore: 72,
        fatigueScore: 58,
        stressLevel: "elevated",
        fatigueLevel: "tired",
        confidence: 0.85,
        features: {
          mfcc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          spectralCentroid: 2100,
          spectralFlux: 0.45,
          spectralRolloff: 4200,
          rms: 0.12,
          zcr: 0.08,
          speechRate: 4.2,
          pauseRatio: 0.18,
          pauseCount: 5,
          avgPauseDuration: 320,
          pitchMean: 165,
          pitchStdDev: 28,
          pitchRange: 85,
        },
      },
    },
    // Session 2: 3 days ago - moderate check-in
    {
      id: generateId(),
      startedAt: daysAgo(3).toISOString(),
      endedAt: new Date(daysAgo(3).getTime() + 6 * 60 * 1000).toISOString(),
      messages: [
        {
          id: generateId(),
          role: "assistant",
          content: "Welcome back! How are things going?",
          timestamp: daysAgo(3).toISOString(),
        },
        {
          id: generateId(),
          role: "user",
          content: "Better than last time actually. The presentation went well and I got some good feedback.",
          timestamp: new Date(daysAgo(3).getTime() + 25 * 1000).toISOString(),
          metrics: {
            stressScore: 42,
            fatigueScore: 45,
            stressLevel: "moderate",
            fatigueLevel: "normal",
            confidence: 0.88,
            analyzedAt: new Date(daysAgo(3).getTime() + 25 * 1000).toISOString(),
          },
        },
        {
          id: generateId(),
          role: "assistant",
          content: "That's wonderful! Your voice sounds much lighter today. What do you think made the difference?",
          timestamp: new Date(daysAgo(3).getTime() + 50 * 1000).toISOString(),
        },
        {
          id: generateId(),
          role: "user",
          content: "I actually took your advice and went for a walk in the morning. It helped clear my head.",
          timestamp: new Date(daysAgo(3).getTime() + 90 * 1000).toISOString(),
        },
        {
          id: generateId(),
          role: "assistant",
          content: "I love that you tried it! Movement before high-stakes situations can really shift our mental state. Would you want to make morning walks a regular thing?",
          timestamp: new Date(daysAgo(3).getTime() + 130 * 1000).toISOString(),
        },
      ] as CheckInMessage[],
      duration: 360,
      acousticMetrics: {
        stressScore: 42,
        fatigueScore: 45,
        stressLevel: "moderate",
        fatigueLevel: "normal",
        confidence: 0.88,
        features: {
          mfcc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          spectralCentroid: 1850,
          spectralFlux: 0.32,
          spectralRolloff: 3800,
          rms: 0.10,
          zcr: 0.06,
          speechRate: 3.8,
          pauseRatio: 0.22,
          pauseCount: 4,
          avgPauseDuration: 450,
          pitchMean: 155,
          pitchStdDev: 22,
          pitchRange: 70,
        },
      },
    },
    // Session 3: 1 day ago - good day
    {
      id: generateId(),
      startedAt: daysAgo(1).toISOString(),
      endedAt: new Date(daysAgo(1).getTime() + 5 * 60 * 1000).toISOString(),
      messages: [
        {
          id: generateId(),
          role: "assistant",
          content: "Good to see you! How's your day been?",
          timestamp: daysAgo(1).toISOString(),
        },
        {
          id: generateId(),
          role: "user",
          content: "Really good actually! I've been keeping up with the morning walks and I feel like I have more energy throughout the day.",
          timestamp: new Date(daysAgo(1).getTime() + 20 * 1000).toISOString(),
          metrics: {
            stressScore: 28,
            fatigueScore: 32,
            stressLevel: "low",
            fatigueLevel: "rested",
            confidence: 0.91,
            analyzedAt: new Date(daysAgo(1).getTime() + 20 * 1000).toISOString(),
          },
        },
        {
          id: generateId(),
          role: "assistant",
          content: "That's fantastic progress! Your voice sounds noticeably more relaxed and energetic. Building consistent habits like this is exactly how we prevent burnout. Keep it up!",
          timestamp: new Date(daysAgo(1).getTime() + 55 * 1000).toISOString(),
        },
      ] as CheckInMessage[],
      duration: 300,
      acousticMetrics: {
        stressScore: 28,
        fatigueScore: 32,
        stressLevel: "low",
        fatigueLevel: "rested",
        confidence: 0.91,
        features: {
          mfcc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          spectralCentroid: 1650,
          spectralFlux: 0.28,
          spectralRolloff: 3400,
          rms: 0.09,
          zcr: 0.05,
          speechRate: 3.5,
          pauseRatio: 0.25,
          pauseCount: 3,
          avgPauseDuration: 520,
          pitchMean: 148,
          pitchStdDev: 18,
          pitchRange: 55,
        },
      },
    },
    // Session 4: Today - moderate
    {
      id: generateId(),
      startedAt: now.toISOString(),
      endedAt: new Date(now.getTime() + 4 * 60 * 1000).toISOString(),
      messages: [
        {
          id: generateId(),
          role: "assistant",
          content: "Hey! Ready for your check-in?",
          timestamp: now.toISOString(),
        },
        {
          id: generateId(),
          role: "user",
          content: "Yeah, feeling pretty balanced today. Got some work to do but nothing too overwhelming.",
          timestamp: new Date(now.getTime() + 15 * 1000).toISOString(),
          metrics: {
            stressScore: 35,
            fatigueScore: 38,
            stressLevel: "low",
            fatigueLevel: "normal",
            confidence: 0.89,
            analyzedAt: new Date(now.getTime() + 15 * 1000).toISOString(),
          },
        },
        {
          id: generateId(),
          role: "assistant",
          content: "Great to hear! Your stress levels are looking much healthier than when we first started. Any particular wins you want to celebrate?",
          timestamp: new Date(now.getTime() + 40 * 1000).toISOString(),
        },
      ] as CheckInMessage[],
      duration: 240,
      acousticMetrics: {
        stressScore: 35,
        fatigueScore: 38,
        stressLevel: "low",
        fatigueLevel: "normal",
        confidence: 0.89,
        features: {
          mfcc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          spectralCentroid: 1750,
          spectralFlux: 0.30,
          spectralRolloff: 3600,
          rms: 0.095,
          zcr: 0.055,
          speechRate: 3.6,
          pauseRatio: 0.24,
          pauseCount: 3,
          avgPauseDuration: 480,
          pitchMean: 150,
          pitchStdDev: 20,
          pitchRange: 60,
        },
      },
    },
  ]

  return sessions
}

/**
 * Generate 7 days of trend data showing improvement
 */
export function generateDemoTrendData(): TrendData[] {
  const trends: TrendData[] = []

  // Generate data showing gradual improvement
  const stressProgression = [75, 68, 55, 48, 42, 35, 32]
  const fatigueProgression = [62, 58, 52, 48, 45, 40, 36]

  for (let i = 6; i >= 0; i--) {
    trends.push({
      date: toISODate(daysAgo(i)),
      stressScore: stressProgression[6 - i],
      fatigueScore: fatigueProgression[6 - i],
      recordingCount: 1,
    })
  }

  return trends
}

/**
 * Generate demo suggestions in various states
 */
export function generateDemoSuggestions(): Suggestion[] {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  return [
    // Pending suggestions
    {
      id: generateId(),
      content: "Take a 10-minute walk outside to reset your focus and get some fresh air.",
      rationale: "Movement breaks help reduce accumulated stress and improve cognitive function.",
      duration: 10,
      category: "exercise",
      status: "pending",
      createdAt: daysAgo(1).toISOString(),
    },
    {
      id: generateId(),
      content: "Practice box breathing for 5 minutes: inhale 4s, hold 4s, exhale 4s, hold 4s.",
      rationale: "Structured breathing activates the parasympathetic nervous system to reduce stress.",
      duration: 5,
      category: "mindfulness",
      status: "pending",
      createdAt: daysAgo(1).toISOString(),
    },
    {
      id: generateId(),
      content: "Call or message a friend you haven't connected with recently.",
      rationale: "Social connection is a powerful buffer against burnout and isolation.",
      duration: 15,
      category: "social",
      status: "pending",
      createdAt: now.toISOString(),
    },
    // Scheduled suggestions
    {
      id: generateId(),
      content: "Morning stretch routine to start the day with energy.",
      rationale: "Gentle movement in the morning increases blood flow and mental alertness.",
      duration: 10,
      category: "exercise",
      status: "scheduled",
      createdAt: daysAgo(2).toISOString(),
      scheduledFor: tomorrow.toISOString(),
    },
    {
      id: generateId(),
      content: "Take a proper lunch break away from your desk.",
      rationale: "Separating work and rest spaces helps your brain fully disengage and recover.",
      duration: 30,
      category: "break",
      status: "scheduled",
      createdAt: daysAgo(2).toISOString(),
      scheduledFor: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    },
    // Completed suggestions
    {
      id: generateId(),
      content: "Morning walk before the presentation to calm nerves.",
      rationale: "Physical activity before stressful events helps regulate the nervous system.",
      duration: 15,
      category: "exercise",
      status: "completed",
      createdAt: daysAgo(5).toISOString(),
      completedAt: daysAgo(4).toISOString(),
      effectiveness: {
        rating: "very_helpful",
        ratedAt: daysAgo(4).toISOString(),
        comment: "Really helped me feel more confident!",
      },
    },
    {
      id: generateId(),
      content: "5-minute meditation before starting work.",
      rationale: "Brief mindfulness practice sets a calm tone for the day.",
      duration: 5,
      category: "mindfulness",
      status: "completed",
      createdAt: daysAgo(4).toISOString(),
      completedAt: daysAgo(3).toISOString(),
      effectiveness: {
        rating: "somewhat_helpful",
        ratedAt: daysAgo(3).toISOString(),
      },
    },
    {
      id: generateId(),
      content: "Get 8 hours of sleep tonight - your body needs recovery.",
      rationale: "Adequate sleep is essential for stress regulation and cognitive function.",
      duration: 480,
      category: "rest",
      status: "completed",
      createdAt: daysAgo(3).toISOString(),
      completedAt: daysAgo(2).toISOString(),
      effectiveness: {
        rating: "very_helpful",
        ratedAt: daysAgo(2).toISOString(),
      },
    },
  ]
}

/**
 * Generate demo daily achievements
 */
export function generateDemoAchievements(): DailyAchievement[] {
  const todayISO = toISODate(new Date())

  return [
    // Today's challenge (not completed)
    {
      id: generateId(),
      dateISO: todayISO,
      sourceDateISO: todayISO,
      type: "challenge",
      category: "consistency",
      title: "Daily Check-in Champion",
      description: "Complete your daily voice check-in to track your wellness trends.",
      points: 50,
      createdAt: new Date().toISOString(),
      completed: false,
      carriedOver: false,
      seen: true,
      seenAt: new Date().toISOString(),
      tracking: {
        key: "do_check_in",
        target: 1,
      },
    },
    // Today's badge (already earned)
    {
      id: generateId(),
      dateISO: todayISO,
      sourceDateISO: todayISO,
      type: "badge",
      category: "improvement",
      title: "Stress Slayer",
      description: "Your stress score dropped 15% from your weekly average!",
      insight: "Keep up those morning walks - they're clearly working.",
      points: 75,
      createdAt: new Date().toISOString(),
      completed: true,
      completedAt: new Date().toISOString(),
      carriedOver: false,
      seen: false,
    },
    // Yesterday's completed challenge
    {
      id: generateId(),
      dateISO: toISODate(daysAgo(1)),
      sourceDateISO: toISODate(daysAgo(1)),
      type: "challenge",
      category: "engagement",
      title: "Recovery Architect",
      description: "Schedule at least one recovery activity for tomorrow.",
      points: 40,
      createdAt: daysAgo(1).toISOString(),
      completed: true,
      completedAt: daysAgo(1).toISOString(),
      carriedOver: false,
      seen: true,
      seenAt: daysAgo(1).toISOString(),
      tracking: {
        key: "schedule_suggestion",
        target: 1,
      },
    },
  ]
}

/**
 * Generate demo milestone badges
 */
export function generateDemoMilestoneBadges(): MilestoneBadge[] {
  return [
    {
      id: generateId(),
      type: "7day",
      title: "One Week Wonder",
      description: "Completed achievements for 7 consecutive days!",
      earnedAt: daysAgo(2).toISOString(),
      streakDays: 7,
      seen: true,
      seenAt: daysAgo(2).toISOString(),
    },
  ]
}

/**
 * Generate demo user progress
 */
export function generateDemoUserProgress(): UserProgress {
  return {
    id: "default",
    totalPoints: 425,
    level: 3,
    levelTitle: "Wellness Explorer",
    currentDailyCompletionStreak: 9,
    longestDailyCompletionStreak: 9,
    lastCompletedDateISO: toISODate(daysAgo(1)),
    lastGeneratedDateISO: toISODate(new Date()),
  }
}

/**
 * Generate demo journal entries
 */
export function generateDemoJournalEntries(): JournalEntry[] {
  return [
    {
      id: generateId(),
      createdAt: daysAgo(4).toISOString(),
      category: "reflection",
      prompt: "What's one thing you're grateful for today?",
      content: "I'm grateful that I have a supportive team at work. Even when things get stressful, they have my back.",
    },
    {
      id: generateId(),
      createdAt: daysAgo(2).toISOString(),
      category: "insight",
      prompt: "What did you learn about yourself this week?",
      content: "I realized that taking breaks actually makes me MORE productive, not less. I used to think pushing through was the answer.",
    },
    {
      id: generateId(),
      createdAt: daysAgo(1).toISOString(),
      category: "celebration",
      prompt: "What's a small win you want to celebrate?",
      content: "I've done morning walks 3 days in a row now! It's becoming a habit.",
    },
  ]
}

/**
 * Demo user name for onboarding
 */
export const DEMO_USER_NAME = "Demo User"

/**
 * Demo API key placeholder (signals demo mode)
 */
export const DEMO_API_KEY = "DEMO_MODE"
