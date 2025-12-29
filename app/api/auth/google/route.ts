// OAuth initiation endpoint
// Generates authorization URL and redirects user to Google's consent screen

import { NextRequest, NextResponse } from "next/server"
import { generateAuthUrl } from "@/lib/calendar/oauth"

export const runtime = "edge" // Optional: use edge runtime for faster response

export async function GET(request: NextRequest) {
  try {
    // Get OAuth config from environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    // Validate environment variables
    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        {
          error: "OAuth configuration missing",
          details: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be set",
        },
        { status: 500 }
      )
    }

    // Generate authorization URL with PKCE
    const authUrl = await generateAuthUrl({
      clientId,
      clientSecret,
      redirectUri,
    })

    // Return the URL for client-side redirect
    // Alternatively, could redirect server-side:
    // return NextResponse.redirect(authUrl)
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error("OAuth initiation error:", error)

    return NextResponse.json(
      {
        error: "Failed to initiate OAuth flow",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
