/**
 * Favicon utilities
 *
 * Implementation note:
 * - We keep a real static SVG at /public/icon.svg for normal usage.
 * - For the "accent color" feature we fetch that SVG once, swap its fill
 *   color, and set a data: URL favicon.
 */

import { DEFAULT_ACCENT } from "@/lib/color-utils"

const DYNAMIC_FAVICON_SELECTOR = 'link[data-dynamic-favicon="true"]'

let cachedIconSvg: string | null = null
let cachedIconSvgPromise: Promise<string> | null = null
let lastRequestId = 0

function sanitizeHexColor(input?: string): string | null {
  if (!input) return null
  const trimmed = input.trim()

  // Accept only #rgb or #rrggbb.
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()

  return null
}

async function getIconSvg(): Promise<string> {
  if (cachedIconSvg) return cachedIconSvg
  if (cachedIconSvgPromise) return cachedIconSvgPromise

  cachedIconSvgPromise = fetch("/icon.svg")
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch /icon.svg (status ${res.status})`)
      }
      return res.text()
    })
    .then((text) => {
      cachedIconSvg = text
      return text
    })
    .finally(() => {
      cachedIconSvgPromise = null
    })

  return cachedIconSvgPromise
}

function buildColoredFaviconSvg(svgText: string, color: string): string {
  // Strip XML/InkScape headers that aren't needed for a data URL.
  let svg = svgText
    .replace(/^<\?xml[^>]*>\s*/i, "")
    .replace(/<!--([\s\S]*?)-->/g, "")

  // Ensure favicon has deterministic pixel size.
  svg = svg
    .replace(/\bwidth="[^"]*"/i, 'width="64"')
    .replace(/\bheight="[^"]*"/i, 'height="64"')

  // Replace the logo fill color.
  // icon.svg uses inline styles like style="fill:#f9f9f9".
  svg = svg
    .replaceAll("fill:#f9f9f9", `fill:${color}`)
    .replaceAll("fill:#F9F9F9", `fill:${color}`)
    .replaceAll('fill="#f9f9f9"', `fill="${color}"`)
    .replaceAll('fill="#F9F9F9"', `fill="${color}"`)

  return svg
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function setFaviconHref(href: string) {
  const head = document.head
  if (!head) return

  // IMPORTANT: Don't remove Next/React-managed <head> tags (e.g. metadata icons).
  // Removing them can cause React to crash on navigation with:
  // `TypeError: null is not an object (evaluating '(t=t.stateNode).parentNode.removeChild')`
  // See: docs/error-patterns/next-head-tag-dom-removal-crash.md

  const dynamicLinkSelector = DYNAMIC_FAVICON_SELECTOR
  let link = head.querySelector<HTMLLinkElement>(dynamicLinkSelector)
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    link.type = "image/svg+xml"
    link.setAttribute("sizes", "any")
    link.setAttribute("data-dynamic-favicon", "true")
  }

  link.href = href

  // Insert the dynamic favicon before any existing static icons, so browsers that
  // select the first <link rel="icon"> pick ours without needing to delete theirs.
  const firstStaticIcon = head.querySelector<HTMLLinkElement>(
    'link[rel="icon"]:not([data-dynamic-favicon="true"])'
  )

  if (firstStaticIcon) {
    head.insertBefore(link, firstStaticIcon)
  } else {
    head.appendChild(link)
  }
}

/**
 * Update the favicon in the document head.
 *
 * This is called from `components/color-sync.tsx` whenever the accent color
 * changes.
 */
export function updateFavicon(color?: string) {
  if (typeof document === "undefined") return

  const safeColor = sanitizeHexColor(color) ?? DEFAULT_ACCENT
  const requestId = ++lastRequestId

  void (async () => {
    try {
      const baseSvg = await getIconSvg()
      if (requestId !== lastRequestId) return

      const coloredSvg = buildColoredFaviconSvg(baseSvg, safeColor)
      setFaviconHref(svgToDataUrl(coloredSvg))
    } catch {
      // If anything goes wrong (offline / fetch blocked), fall back to static.
      if (requestId !== lastRequestId) return
      setFaviconHref("/icon.svg")
    }
  })()
}
