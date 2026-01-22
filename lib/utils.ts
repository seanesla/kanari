import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export Gemini utilities for backwards compatibility
// Import from @/lib/gemini/api-utils for new code
export { getGeminiApiKey, createGeminiHeaders } from "@/lib/gemini/api-utils"
