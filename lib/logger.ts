/**
 * Development-only logging utilities
 *
 * These functions only log in development mode to keep production clean
 * while providing useful debugging information during development.
 */

const isDev = process.env.NODE_ENV === "development"

/**
 * Log debug information (only in development)
 */
export function logDebug(prefix: string, message: string, ...args: unknown[]): void {
  if (isDev) {
    console.debug(`[${prefix}] ${message}`, ...args)
  }
}

/**
 * Log warnings (only in development)
 */
export function logWarn(prefix: string, message: string, ...args: unknown[]): void {
  if (isDev) {
    console.warn(`[${prefix}] ${message}`, ...args)
  }
}

/**
 * Log errors (always logs, but with prefix formatting)
 */
export function logError(prefix: string, message: string, ...args: unknown[]): void {
  console.error(`[${prefix}] ${message}`, ...args)
}

/**
 * Check if an error is an expected InvalidStateError (e.g., audio source already stopped)
 */
export function isExpectedInvalidStateError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "InvalidStateError"
}

/**
 * Log unexpected errors (filters out expected ones like InvalidStateError)
 */
export function logUnexpectedError(
  prefix: string,
  message: string,
  error: unknown
): void {
  if (isDev && !isExpectedInvalidStateError(error)) {
    console.warn(`[${prefix}] ${message}`, error)
  }
}
