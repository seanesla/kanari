"use client"

import {
  db,
  fromCheckInSession,
  fromTrendData,
  fromSuggestion,
  fromDailyAchievement,
  fromMilestoneBadge,
  fromJournalEntry,
} from "@/lib/storage/db"
import {
  generateDemoCheckInSessions,
  generateDemoTrendData,
  generateDemoSuggestions,
  generateDemoAchievements,
  generateDemoMilestoneBadges,
  generateDemoUserProgress,
  generateDemoJournalEntries,
} from "@/lib/demo/demo-data"

export async function seedDemoWorkspaceData(): Promise<void> {
  const sessions = generateDemoCheckInSessions()
  const trends = generateDemoTrendData()
  const suggestions = generateDemoSuggestions()
  const achievements = generateDemoAchievements()
  const badges = generateDemoMilestoneBadges()
  const progress = generateDemoUserProgress()
  const journals = generateDemoJournalEntries()

  await db.transaction(
    "rw",
    [
      db.checkInSessions,
      db.trendData,
      db.suggestions,
      db.achievements,
      db.milestoneBadges,
      db.userProgress,
      db.journalEntries,
    ],
    async () => {
      await Promise.all([
        db.checkInSessions.clear(),
        db.trendData.clear(),
        db.suggestions.clear(),
        db.achievements.clear(),
        db.milestoneBadges.clear(),
        db.userProgress.clear(),
        db.journalEntries.clear(),
      ])

      await db.checkInSessions.bulkPut(sessions.map(fromCheckInSession))
      await db.trendData.bulkPut(trends.map(fromTrendData))
      await db.suggestions.bulkPut(suggestions.map(fromSuggestion))
      await db.achievements.bulkPut(achievements.map(fromDailyAchievement))
      await db.milestoneBadges.bulkPut(badges.map(fromMilestoneBadge))
      await db.userProgress.put(progress)
      await db.journalEntries.bulkPut(journals.map(fromJournalEntry))
    }
  )
}
