"use client"

import type { UserSettings } from "@/lib/types"
import { db } from "@/lib/storage/db"
import { createDefaultSettingsRecord } from "@/lib/settings/default-settings"

// Error pattern: docs/error-patterns/settings-put-overwrites-fields.md

function isConstraintError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof Error) {
    return error.name === "ConstraintError"
  }
  return false
}

/**
 * Patch the single settings record (id = "default") without overwriting other fields.
 *
 * Why this exists:
 * - `put(createDefaultSettingsRecord(...))` overwrites the entire record.
 * - In a race (two writers), a late `put` can wipe userName/onboarding flags.
 */
export async function patchSettings(
  updates: Partial<UserSettings>,
  options?: {
    /** Extra fields to apply only if the record must be created. */
    create?: Partial<UserSettings>
  }
): Promise<void> {
  const updated = await db.settings.update("default", updates)
  if (updated > 0) return

  const createRecord = createDefaultSettingsRecord({
    ...options?.create,
    ...updates,
  })

  try {
    await db.settings.add(createRecord)
    return
  } catch (error) {
    // Another writer created the record after our update() miss.
    if (isConstraintError(error)) {
      await db.settings.update("default", updates)
      return
    }
    throw error
  }
}
