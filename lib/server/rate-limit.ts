type RateLimitEntry = {
  count: number
  resetAtMs: number
}

type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAtMs: number
}

const globalForRateLimit = globalThis as unknown as {
  __kanariRateLimitStore?: Map<string, RateLimitEntry>
}

const store = globalForRateLimit.__kanariRateLimitStore ?? new Map<string, RateLimitEntry>()

if (!globalForRateLimit.__kanariRateLimitStore) {
  globalForRateLimit.__kanariRateLimitStore = store
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }

  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  return "unknown"
}

export function checkRateLimit(options: {
  key: string
  limit: number
  windowMs: number
  nowMs?: number
}): RateLimitResult {
  const nowMs = options.nowMs ?? Date.now()
  const existing = store.get(options.key)

  if (!existing || nowMs >= existing.resetAtMs) {
    const resetAtMs = nowMs + options.windowMs
    store.set(options.key, { count: 1, resetAtMs })
    return {
      allowed: true,
      limit: options.limit,
      remaining: Math.max(0, options.limit - 1),
      resetAtMs,
    }
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAtMs: existing.resetAtMs,
    }
  }

  existing.count += 1
  store.set(options.key, existing)

  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAtMs: existing.resetAtMs,
  }
}
