export function hardReload(): void {
  if (typeof window === "undefined") return
  try {
    window.location.reload()
  } catch {
    // Fallback for environments where reload is blocked.
    window.location.replace(window.location.href)
  }
}
