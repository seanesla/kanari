/**
 * Favicon utilities
 * Uses static kanarilogo.svg from public/icon.svg
 */

/**
 * Update the favicon in the document head
 * Uses the static kanari logo SVG
 * 
 * @param _color - Unused, kept for API compatibility with ColorSync
 */
export function updateFavicon(_color?: string) {
  if (typeof document === "undefined") return

  // Remove any existing dynamic favicon
  const oldLink = document.querySelector<HTMLLinkElement>(
    'link[data-dynamic-favicon="true"]'
  )
  if (oldLink) {
    oldLink.remove()
  }

  // Create link to static SVG favicon
  const link = document.createElement("link")
  link.rel = "icon"
  link.type = "image/svg+xml"
  link.setAttribute("data-dynamic-favicon", "true")
  link.href = "/icon.svg"
  document.head.appendChild(link)
}
