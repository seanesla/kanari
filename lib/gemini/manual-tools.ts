/**
 * Manual Tool Configuration
 *
 * Defines user-facing tool configurations for manual tool triggering in AI Chat.
 * Maps internal Gemini tool names to user-friendly slash commands and forms.
 */

import type { LucideIcon } from "@/lib/icons"
import { Wind, Calendar, Gauge, BookOpen } from "@/lib/icons"

// ============================================
// Types
// ============================================

export type ManualToolFieldType = "select" | "number" | "text" | "date" | "time"

export interface ManualToolOption {
  value: string
  label: string
}

export interface ManualToolField {
  name: string
  label: string
  type: ManualToolFieldType
  required: boolean
  options?: ManualToolOption[]
  placeholder?: string
  min?: number
  max?: number
  defaultValue?: string | number
}

export interface ManualToolArgSchema {
  fields: ManualToolField[]
}

export interface ManualToolConfig {
  /** Internal tool name (matches Gemini tool declarations) */
  internalName: string
  /** User-facing display name */
  displayName: string
  /** Short description for menu */
  description: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Slash command trigger (without "/") */
  slashCommand: string
  /** Whether this tool requires arguments */
  requiresArgs: boolean
  /** Argument schema for forms (if requiresArgs is true) */
  argSchema?: ManualToolArgSchema
}

// ============================================
// Tool Configurations
// ============================================

export const MANUAL_TOOLS: ManualToolConfig[] = [
  {
    internalName: "show_breathing_exercise",
    displayName: "Breathing Exercise",
    description: "Start a guided breathing exercise",
    icon: Wind,
    slashCommand: "breathing",
    requiresArgs: true,
    argSchema: {
      fields: [
        {
          name: "type",
          label: "Breathing Pattern",
          type: "select",
          required: true,
          options: [
            { value: "box", label: "Box Breathing (4-4-4-4)" },
            { value: "478", label: "4-7-8 Breathing" },
            { value: "relaxing", label: "Relaxing (4-6)" },
          ],
          defaultValue: "box",
        },
        {
          name: "duration",
          label: "Duration (seconds)",
          type: "number",
          required: true,
          min: 30,
          max: 300,
          defaultValue: 120,
        },
      ],
    },
  },
  {
    internalName: "schedule_activity",
    displayName: "Schedule Activity",
    description: "Add a self-care activity to your calendar",
    icon: Calendar,
    slashCommand: "schedule",
    requiresArgs: true,
    argSchema: {
      fields: [
        {
          name: "title",
          label: "Activity",
          type: "text",
          required: true,
          placeholder: "e.g., 10-minute walk",
        },
        {
          name: "category",
          label: "Category",
          type: "select",
          required: true,
          options: [
            { value: "break", label: "Break" },
            { value: "exercise", label: "Exercise" },
            { value: "mindfulness", label: "Mindfulness" },
            { value: "social", label: "Social" },
            { value: "rest", label: "Rest" },
          ],
          defaultValue: "break",
        },
        {
          name: "date",
          label: "Date",
          type: "date",
          required: true,
        },
        {
          name: "time",
          label: "Time",
          type: "time",
          required: true,
        },
        {
          name: "duration",
          label: "Duration (minutes)",
          type: "number",
          required: true,
          min: 5,
          max: 120,
          defaultValue: 15,
        },
      ],
    },
  },
  {
    internalName: "show_stress_gauge",
    displayName: "Stress Gauge",
    description: "View your current stress and fatigue levels",
    icon: Gauge,
    slashCommand: "stress",
    requiresArgs: false, // Uses AI's assessment of current levels
  },
  {
    internalName: "show_journal_prompt",
    displayName: "Journal Prompt",
    description: "Get a journaling prompt to reflect on",
    icon: BookOpen,
    slashCommand: "journal",
    requiresArgs: true,
    argSchema: {
      fields: [
        {
          name: "category",
          label: "Type (optional)",
          type: "select",
          required: false,
          options: [
            { value: "reflection", label: "Reflection" },
            { value: "gratitude", label: "Gratitude" },
            { value: "stress", label: "Stress Processing" },
          ],
        },
      ],
    },
  },
]

// ============================================
// Helper Functions
// ============================================

/**
 * Find a tool by its slash command
 */
export function findToolBySlashCommand(command: string): ManualToolConfig | undefined {
  const normalized = command.toLowerCase().replace(/^\//, "")
  return MANUAL_TOOLS.find((tool) => tool.slashCommand === normalized)
}

/**
 * Find tools matching a partial slash command (for autocomplete)
 */
export function filterToolsBySlashCommand(partialCommand: string): ManualToolConfig[] {
  const normalized = partialCommand.toLowerCase().replace(/^\//, "")
  if (!normalized) return MANUAL_TOOLS
  return MANUAL_TOOLS.filter((tool) => tool.slashCommand.startsWith(normalized))
}

/**
 * Get default values for a tool's arguments
 */
export function getToolDefaultArgs(
  tool: ManualToolConfig
): Record<string, string | number | undefined> {
  if (!tool.argSchema) return {}

  const defaults: Record<string, string | number | undefined> = {}
  for (const field of tool.argSchema.fields) {
    if (field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue
    }
  }
  return defaults
}
