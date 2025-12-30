/**
 * Zod Schemas for Gemini Live API Messages
 *
 * Runtime validation schemas for incoming messages from the Gemini Live API.
 * Provides type safety and validation for SSE messages.
 */

import { z } from "zod"

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
  isFinal: z.boolean().optional(),
})

/**
 * Server content schema (model responses)
 */
const ServerContentSchema = z.object({
  modelTurn: ModelTurnSchema.optional(),
  turnComplete: z.boolean().optional(),
  interrupted: z.boolean().optional(),
  outputTranscription: OutputTranscriptionSchema.optional(),
})

/**
 * Tool call schema
 */
const ToolCallSchema = z.object({
  functionCalls: z
    .array(
      z.object({
        name: z.string(),
        args: z.record(z.unknown()),
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
