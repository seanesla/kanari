#!/usr/bin/env npx tsx
/**
 * Voice Sample Generator
 *
 * Generates voice preview samples for all 30 Gemini TTS voices.
 * Uses the Gemini 2.5 Flash Preview TTS model.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key npx tsx scripts/generate-voice-samples.ts
 *
 * Output:
 *   Creates WAV files in public/voices/{voice-name}.wav
 */

import { writeFileSync, existsSync } from "fs"
import { join } from "path"

// Voice list (matches lib/gemini/voices.ts)
const VOICES = [
  "Achernar",
  "Achird",
  "Algenib",
  "Algieba",
  "Alnilam",
  "Aoede",
  "Autonoe",
  "Callirrhoe",
  "Charon",
  "Despina",
  "Enceladus",
  "Erinome",
  "Fenrir",
  "Gacrux",
  "Iapetus",
  "Kore",
  "Laomedeia",
  "Leda",
  "Orus",
  "Puck",
  "Pulcherrima",
  "Rasalgethi",
  "Sadachbia",
  "Sadaltager",
  "Schedar",
  "Sulafat",
  "Umbriel",
  "Vindemiatrix",
  "Zephyr",
  "Zubenelgenubi",
]

const TTS_MODEL = "gemini-2.5-flash-preview-tts"
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`

// Audio specs from Gemini TTS
const SAMPLE_RATE = 24000
const NUM_CHANNELS = 1
const BITS_PER_SAMPLE = 16

/**
 * Convert PCM data to WAV format
 */
function pcmToWav(pcmData: Buffer): Buffer {
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8)
  const blockAlign = NUM_CHANNELS * (BITS_PER_SAMPLE / 8)
  const dataSize = pcmData.length
  const fileSize = 36 + dataSize

  const header = Buffer.alloc(44)

  // RIFF header
  header.write("RIFF", 0)
  header.writeUInt32LE(fileSize, 4)
  header.write("WAVE", 8)

  // fmt subchunk
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20) // AudioFormat (1 = PCM)
  header.writeUInt16LE(NUM_CHANNELS, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(BITS_PER_SAMPLE, 34)

  // data subchunk
  header.write("data", 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmData])
}

/**
 * Generate TTS audio for a voice
 */
async function generateVoiceSample(
  voiceName: string,
  apiKey: string
): Promise<Buffer> {
  const text = `Hi, I'm ${voiceName}. How are you feeling today?`

  const requestBody = {
    contents: [
      {
        parts: [{ text }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
    model: TTS_MODEL,
  }

  const response = await fetch(`${API_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()

  // Extract base64 audio data
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  if (!audioData) {
    throw new Error("No audio data in response")
  }

  // Decode base64 to PCM buffer
  const pcmBuffer = Buffer.from(audioData, "base64")

  // Convert to WAV
  return pcmToWav(pcmBuffer)
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function writeLine(message: string): void {
  process.stdout.write(`${message}\n`)
}

/**
 * Generate with retry logic for rate limiting
 */
async function generateWithRetry(
  voiceName: string,
  apiKey: string,
  maxRetries = 3
): Promise<Buffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateVoiceSample(voiceName, apiKey)
    } catch (error) {
      const isRateLimit =
        error instanceof Error && error.message.includes("429")
      if (isRateLimit && attempt < maxRetries) {
        // Wait longer on rate limit (60 seconds + random jitter)
        const waitTime = 60000 + Math.random() * 5000
        writeLine(` ⏳ Rate limited, waiting ${Math.round(waitTime / 1000)}s...`)
        await sleep(waitTime)
      } else {
        throw error
      }
    }
  }
  throw new Error("Max retries exceeded")
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY environment variable is required")
    console.error("Usage: GEMINI_API_KEY=your_key npx tsx scripts/generate-voice-samples.ts")
    process.exit(1)
  }

  const outputDir = join(process.cwd(), "public", "voices")

  writeLine(`Generating ${VOICES.length} voice samples...`)
  writeLine(`Output directory: ${outputDir}`)
  writeLine(`Rate limit: 10 requests/minute (waiting 7s between requests)\n`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const voice of VOICES) {
    const filename = `${voice.toLowerCase()}.wav`
    const filepath = join(outputDir, filename)

    // Skip if already exists
    if (existsSync(filepath)) {
      writeLine(`⏭️  Skipping ${voice} (already exists)`)
      skipCount++
      continue
    }

    try {
      process.stdout.write(`🎤 Generating ${voice}...`)
      const wavData = await generateWithRetry(voice, apiKey)
      writeFileSync(filepath, wavData)
      writeLine(` ✅ ${filename} (${(wavData.length / 1024).toFixed(1)} KB)`)
      successCount++

      // Rate limiting: wait 7 seconds between requests (10 req/min limit)
      await sleep(7000)
    } catch (error) {
      writeLine(` ❌ Failed`)
      console.error(`   Error: ${error instanceof Error ? error.message : error}`)
      errorCount++
    }
  }

  writeLine("\n--- Summary ---")
  writeLine(`✅ Generated: ${successCount}`)
  writeLine(`⏭️  Skipped: ${skipCount}`)
  writeLine(`❌ Failed: ${errorCount}`)

  if (errorCount > 0) {
    process.exit(1)
  }
}

main()
