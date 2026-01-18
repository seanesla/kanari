import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the api-utils module before importing avatar-client
vi.mock("@/lib/gemini/api-utils", () => ({
  getGeminiApiKey: vi.fn(() => Promise.resolve(undefined)),
}))

import { generateCoachAvatar, isValidBase64Image } from "../avatar-client"

describe("avatar-client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("generateCoachAvatar", () => {
    it("generates a valid SVG data URI without API key", async () => {
      const result = await generateCoachAvatar("Puck")

      expect(result.error).toBeNull()
      expect(result.imageBase64).not.toBeNull()
      expect(result.imageBase64).toMatch(/^data:image\/svg\+xml/)
      expect(result.mimeType).toBe("image/svg+xml")
    })

    it("never produces corrupted SVG with double-hash", async () => {
      // Generate multiple avatars to check for corruption
      const voices = ["Puck", "Zephyr", "Gacrux", "Sulafat", "Kore"] as const
      
      for (const voice of voices) {
        const result = await generateCoachAvatar(voice)
        
        expect(result.error).toBeNull()
        expect(result.imageBase64).not.toBeNull()
        // The %23%23 pattern indicates a double-hash which breaks SVG rendering
        expect(result.imageBase64).not.toContain("%23%23")
      }
    })

    it("returns different avatars for different voices", async () => {
      const result1 = await generateCoachAvatar("Puck")
      const result2 = await generateCoachAvatar("Gacrux")

      expect(result1.imageBase64).not.toBeNull()
      expect(result2.imageBase64).not.toBeNull()
      // Different voices should produce different avatars (different seeds/styles)
      expect(result1.imageBase64).not.toEqual(result2.imageBase64)
    })

    it("does not require accent color parameter", async () => {
      // This test verifies the API signature change - accent color is no longer accepted
      const result = await generateCoachAvatar("Puck")
      
      expect(result.error).toBeNull()
      expect(result.imageBase64).not.toBeNull()
    })
  })

  describe("isValidBase64Image", () => {
    it("validates SVG data URIs", () => {
      // Must be > 50 chars to pass validation
      const validSvg = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E"
      const validPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4"
      expect(isValidBase64Image(validSvg)).toBe(true)
      expect(isValidBase64Image(validPng)).toBe(true)
    })

    it("rejects invalid values", () => {
      expect(isValidBase64Image("")).toBe(false)
      expect(isValidBase64Image("not-an-image")).toBe(false)
      expect(isValidBase64Image("data:")).toBe(false)
    })

    it("rejects null and undefined", () => {
      expect(isValidBase64Image(null as unknown as string)).toBe(false)
      expect(isValidBase64Image(undefined as unknown as string)).toBe(false)
    })
  })
})
