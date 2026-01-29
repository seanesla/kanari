// Error pattern doc: docs/error-patterns/crypto-randomuuid-missing.md

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function bytesToHex(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, "0")
  return out
}

/**
 * Cross-platform UUID v4 generator.
 *
 * Prefers `crypto.randomUUID()` when available, otherwise falls back to
 * `crypto.getRandomValues()` and a standards-compliant UUID v4 implementation.
 *
 * Final fallback is a non-cryptographic unique-ish string (should be extremely rare).
 */
export function safeRandomUUID(): string {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto

  const maybeRandomUUID = cryptoObj && (cryptoObj as unknown as { randomUUID?: () => string }).randomUUID
  if (typeof maybeRandomUUID === "function") return maybeRandomUUID.call(cryptoObj)

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16)
    cryptoObj.getRandomValues(bytes)

    // RFC 4122 §4.4: set version to 4 and variant to 10xx.
    bytes[6] = (bytes[6]! & 0x0f) | 0x40
    bytes[8] = (bytes[8]! & 0x3f) | 0x80

    const hex = bytesToHex(bytes)
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`

    // Paranoia: ensure formatting expectations even if environment mutates getRandomValues.
    if (UUID_V4_REGEX.test(uuid)) return uuid
  }

  return `uuid_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
}

