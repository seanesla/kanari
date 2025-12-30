export const runtime = "nodejs"

// 16x16 ICO (PNG-compressed) generated locally to avoid shipping a binary file.
const ICO_BASE64 =
  "AAABAAEAEBAAAAEAIABSAAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAQAAAAEAgGAAAAH/P/YQAAABlJREFUeNpj8Hd7+p8SzDBqwKgBowYMFwMAv8x5H3kQFsIAAAAASUVORK5CYII="

export async function GET() {
  const ico = Buffer.from(ICO_BASE64, "base64")

  return new Response(ico, {
    headers: {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}

