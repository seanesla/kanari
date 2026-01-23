export type DemoVideoSource = {
  src: string
  type: "video/mp4" | "video/webm"
}

type DemoVideoMedia = {
  mp4?: string
  webm?: string
}

/**
 * Returns demo video <source> entries in a safe order.
 *
 * Chrome can briefly show the built-in "drop file" placeholder when the first
 * <source> points to a missing asset (404) even if a later fallback exists.
 *
 * We therefore prefer mp4 first for the demo tour, since it's the most likely
 * to exist and has the broadest browser support.
 *
 * See: docs/error-patterns/demo-video-source-order.md
 */
export function getDemoVideoSources(media: DemoVideoMedia): DemoVideoSource[] {
  const sources: DemoVideoSource[] = []
  if (media.mp4) sources.push({ src: media.mp4, type: "video/mp4" })
  if (media.webm) sources.push({ src: media.webm, type: "video/webm" })
  return sources
}

