/**
 * Gemini client security tests
 *
 * Focused tests that prevent regressions where server-side API routes
 * accidentally accept a shared server API key (env fallback), enabling
 * unauthenticated callers to burn quota.
 */

import { describe, it, expect } from "vitest"
import { getAPIKeyFromRequest } from "../client"

describe("getAPIKeyFromRequest", () => {
  it("does not fall back to process.env.GEMINI_API_KEY", () => {
    process.env.GEMINI_API_KEY = "AIzaEnvKeyShouldNotBeUsed"

    const request = new Request("http://localhost/api/gemini", {
      headers: {},
    })

    expect(getAPIKeyFromRequest(request)).toBeUndefined()
  })
})

