/**
 * Zod Schemas for Gemini Live API Messages
 *
 * Runtime validation schemas for incoming messages from the Gemini Live API.
 * Provides type safety and validation for SSE messages.
 */

import { z } from "zod"
import type {
  BreathingExerciseToolArgs,
  JournalPromptToolArgs,
  QuickActionsToolArgs,
  ScheduleActivityToolArgs,
  StressGaugeToolArgs,
} from "@/lib/types"

/**
 * Inline data schema (for audio chunks)
 */
const InlineDataSchema = z.object({
  mimeType: z.string(),
  data: z.string(), // Base64 encoded
})

/**
 * Text part schema
 */
const TextPartSchema = z.object({
  text: z.string(),
})

/**
 * Part schema (can be inline data or text)
 */
const PartSchema = z.union([
  z.object({
    inlineData: InlineDataSchema,
    text: z.undefined().optional(),
  }),
  z.object({
    text: z.string(),
    inlineData: z.undefined().optional(),
  }),
])

/**
 * Model turn schema (contains parts)
 */
const ModelTurnSchema = z.object({
  parts: z.array(PartSchema).optional(),
})

/**
 * Output transcription schema
 */
const OutputTranscriptionSchema = z.object({
  text: z.string().optional(),
  finished: z.boolean().optional(),
})

/**
 * Input transcription schema
 */
const InputTranscriptionSchema = z.object({
  text: z.string().optional(),
  finished: z.boolean().optional(), // Per SDK Transcription type
})

/**
 * Server content schema (model responses)
 */
const ServerContentSchema = z.object({
  modelTurn: ModelTurnSchema.optional(),
  turnComplete: z.boolean().optional(),
  interrupted: z.boolean().optional(),
  outputTranscription: OutputTranscriptionSchema.optional(),
  inputTranscription: InputTranscriptionSchema.optional(), // Also check inside serverContent
})

/**
 * Tool call schema
 * Source: Context7 - /googleapis/js-genai docs - "LiveServerToolCall"
 */
const ToolCallSchema = z.object({
  functionCalls: z
    .array(
      z.object({
        id: z.string().optional(), // Required for sending tool response back
        name: z.string(),
        args: z.record(z.unknown()).optional(), // Args may be undefined
      })
    )
    .optional(),
})

/**
 * Tool response schema
 */
const ToolResponseSchema = z.object({
  functionResponses: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        response: z.record(z.unknown()),
      })
    )
    .optional(),
})

/**
 * Voice activity detection signal schema
 * Source: Context7 - /googleapis/js-genai docs - "VoiceActivityDetectionSignal"
 */
const VoiceActivityDetectionSignalSchema = z.object({
  vadSignalType: z.string().optional(),
})

/**
 * Complete server message schema
 *
 * This schema validates the full structure of messages received from Gemini Live API
 */
export const ServerMessageSchema = z.object({
  // Setup complete signal
  setupComplete: z.boolean().optional(),

  // Server content (audio, text, turn signals)
  serverContent: ServerContentSchema.optional(),

  // Input transcription (user speech recognition)
  inputTranscription: InputTranscriptionSchema.optional(),

  // Tool interactions
  toolCall: ToolCallSchema.optional(),
  toolResponse: ToolResponseSchema.optional(),

  // Error information
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
    })
    .optional(),

  // Voice activity detection (user speech start/end)
  voiceActivityDetectionSignal: VoiceActivityDetectionSignalSchema.optional(),
})

/**
 * Type inferred from the schema
 */
export type ServerMessage = z.infer<typeof ServerMessageSchema>

/**
 * Validate and parse a server message
 *
 * @param data - Unknown data to validate
 * @returns Validated server message or null if invalid
 */
export function validateServerMessage(data: unknown): ServerMessage | null {
  const result = ServerMessageSchema.safeParse(data)

  if (!result.success) {
    console.error("[Gemini Schema] Invalid server message:", result.error.issues)
    return null
  }

  return result.data
}

/**
 * Session info response schema (from /api/gemini/session)
 */
export const SessionInfoSchema = z.object({
  sessionId: z.string(),
  streamUrl: z.string().url(),
  audioUrl: z.string().url(),
  secret: z.string(),
})

export type SessionInfo = z.infer<typeof SessionInfoSchema>

/**
 * Audio input request schema
 */
export const AudioInputRequestSchema = z.object({
  sessionId: z.string(),
  secret: z.string(),
  audio: z.string().optional(),
  text: z.string().optional(),
  audioEnd: z.boolean().optional(),
})

export type AudioInputRequest = z.infer<typeof AudioInputRequestSchema>

// ============================================
// Gemini Live Tool Args Schemas (Widget tools)
// ============================================

// Shared helpers
const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
const TimeStringSchema = z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM (24h)")

export const ScheduleActivityArgsSchema: z.ZodType<ScheduleActivityToolArgs> = z.object({
  title: z.string().min(1).max(120),
  category: z.enum(["break", "exercise", "mindfulness", "social", "rest"]),
  date: DateStringSchema,
  time: TimeStringSchema,
  duration: z.number().int().min(1).max(12 * 60), // minutes, cap at 12h
})

export const BreathingExerciseArgsSchema: z.ZodType<BreathingExerciseToolArgs> = z.object({
  type: z.enum(["box", "478", "relaxing"]),
  duration: z.number().int().min(10).max(30 * 60), // seconds, cap at 30m
})

export const StressGaugeArgsSchema: z.ZodType<StressGaugeToolArgs> = z.object({
  stressLevel: z.number().min(0).max(100),
  fatigueLevel: z.number().min(0).max(100),
  message: z.string().max(500).optional(),
})

export const QuickActionsArgsSchema: z.ZodType<QuickActionsToolArgs> = z.object({
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        action: z.string().min(1).max(200),
      })
    )
    .min(1)
    .max(8),
})

export const JournalPromptArgsSchema: z.ZodType<JournalPromptToolArgs> = z.object({
  prompt: z.string().min(1).max(500),
  placeholder: z.string().max(200).optional(),
  category: z.string().min(1).max(50).optional(),
})
