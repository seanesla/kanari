/**
 * OAuth security tests
 *
 * Guards against regressions where PKCE/state are stored client-side (sessionStorage)
 * even though token exchange happens server-side, which breaks CSRF protection and PKCE.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { generateAuthUrl, exchangeCodeForTokens } from "../oauth"

describe("Google OAuth PKCE/state", () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("generateAuthUrl returns { url, state, codeVerifier }", async () => {
    const result = (await generateAuthUrl({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/api/auth/google/callback",
    })) as unknown as { url: string; state: string; codeVerifier: string }

    expect(result).toBeTruthy()
    expect(typeof result).toBe("object")
    expect(typeof result.url).toBe("string")
    expect(typeof result.state).toBe("string")
    expect(typeof result.codeVerifier).toBe("string")

    const url = new URL(result.url)
    expect(url.searchParams.get("state")).toBe(result.state)
    expect(url.searchParams.get("code_challenge")).toBeTruthy()
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  })

  it("exchangeCodeForTokens uses provided codeVerifier (server-side compatible)", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "scope",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    })

    globalThis.fetch = fetchMock as unknown as typeof fetch

    // 3rd argument is the PKCE codeVerifier (works even when window/sessionStorage is unavailable).
    await exchangeCodeForTokens(
      "auth-code",
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "http://localhost:3000/api/auth/google/callback",
      },
      "verifier-abc"
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init).toBeTruthy()
    expect(typeof init.body).toBe("string")
    expect(init.body).toContain("code_verifier=verifier-abc")
  })
})

