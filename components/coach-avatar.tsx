"use client"

/**
 * Coach Avatar Component
 *
 * Displays the AI-generated coach avatar as a circular image.
 * Falls back to a default avatar image when no custom avatar is available.
 */

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

// Pre-generated default coach avatar (DiceBear notionistsNeutral, neutral colors)
// This ensures we always show a real avatar, not an icon placeholder.
const DEFAULT_COACH_AVATAR = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20560%20560%22%20fill%3D%22none%22%20shape-rendering%3D%22auto%22%20width%3D%22512%22%20height%3D%22512%22%3E%3Cmetadata%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3Axsi%3D%22http%3A%2F%2Fwww.w3.org%2F2001%2FXMLSchema-instance%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20xmlns%3Adcterms%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%22%3E%3Crdf%3ARDF%3E%3Crdf%3ADescription%3E%3Cdc%3Atitle%3ENotionists%3C%2Fdc%3Atitle%3E%3Cdc%3Acreator%3EZoish%3C%2Fdc%3Acreator%3E%3Cdc%3Asource%20xsi%3Atype%3D%22dcterms%3AURI%22%3Ehttps%3A%2F%2Fheyzoish.gumroad.com%2Fl%2Fnotionists%3C%2Fdc%3Asource%3E%3Cdcterms%3Alicense%20xsi%3Atype%3D%22dcterms%3AURI%22%3Ehttps%3A%2F%2Fcreativecommons.org%2Fpublicdomain%2Fzero%2F1.0%2F%3C%2Fdcterms%3Alicense%3E%3Cdc%3Arights%3ERemix%20of%20%E2%80%9ENotionists%E2%80%9D%20(https%3A%2F%2Fheyzoish.gumroad.com%2Fl%2Fnotionists)%20by%20%E2%80%9EZoish%E2%80%9D%2C%20licensed%20under%20%E2%80%9ECC0%201.0%E2%80%9D%20(https%3A%2F%2Fcreativecommons.org%2Fpublicdomain%2Fzero%2F1.0%2F)%3C%2Fdc%3Arights%3E%3C%2Frdf%3ADescription%3E%3C%2Frdf%3ARDF%3E%3C%2Fmetadata%3E%3Cmask%20id%3D%22viewboxMask%22%3E%3Crect%20width%3D%22560%22%20height%3D%22560%22%20rx%3D%220%22%20ry%3D%220%22%20x%3D%220%22%20y%3D%220%22%20fill%3D%22%23fff%22%20%2F%3E%3C%2Fmask%3E%3Cg%20mask%3D%22url(%23viewboxMask)%22%3E%3Crect%20fill%3D%22url(%23backgroundLinear)%22%20width%3D%22560%22%20height%3D%22560%22%20x%3D%220%22%20y%3D%220%22%20%2F%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22backgroundLinear%22%20gradientTransform%3D%22rotate(172%200.5%200.5)%22%3E%3Cstop%20stop-color%3D%22%231a1d23%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%232d3748%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cg%20transform%3D%22translate(136%20328)%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M88%2070.6a153.5%20153.5%200%200%200%20115.3-.2c4.1-1.8%208.8-4%2012.4%201.5%204.2%206.4.6%2012.2-3.4%2017.4A71.8%2071.8%200%200%201%20203%20100c-3.8%203.4-9%207.4-13.6%203.4-8.8-7.6-14.7-5.6-22.7%201.7-11.3%2010.2-21%204.5-27.6-7-21.8%2014.3-21.8%2014.3-32.7%201.8h-.9c-.6-.1-1.3-.1-1.6.2-14.7%2012.7-17.9%2011.3-24-8.6l-1-5c-1.4-6.7-2.7-13.5-12.1-14.9.4-4.5%203.2-7.5%206.3-10.2%203.1.4%205%202.4%207%204.5%202%202.2%204.1%204.4%207.7%204.8Zm11%2014.3a22.3%2022.3%200%200%200-13.5-6.3c-1.3%206%201.1%2010.1%203.4%2014.3l2.3%204.2c6-1.6%207.8-5.5%207.8-12.2Zm27.6%208.8c1.8%206-2.6%208.1-8%207.9-4.3-2.8-4.5-6-4.8-9.2%200-1%200-2-.3-3%206.2-1.9%2011.4-1.2%2013%204.3Zm36.8%204.4c1.7-7.5-2-6.8-5.6-6-1.4.2-2.8.4-3.8.2-2.4-.6-5.3.5-5.2%203.8.2%205.2%204.3%205.8%208.1%205.7%201.9%200%203.7-1.4%206.5-3.7Zm29-2.4c-3.8-4.7-5-8.8%201.5-12.1%204.6-1.3%208.7-2.3%208.5%202-.3%205.2-3.6%209.2-10%2010Z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(246%20125)%22%3E%3Cpath%20d%3D%22M41.2%20197.6c-5.4-4.8-10.2-9.4-5.5-15.8%205-6.7%209.8.1%2014.7%201.4%203.2.9%205.6%204.4%209.3%203.3%206.5-1.8%2014-2.5%2015-11.4.8-8.5-6-10.5-11.7-13.1-4.4-2-13%201-11.3-8%201.5-8.3%209.1-7.7%2015.6-7.1a25%2025%200%200%201%2024%2025c.5%2016.2-8.4%2028.5-23.3%2030-8.7%201-18%202-26.8-4.3Z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(-45%20137)%22%3E%3Cpath%20d%3D%22M407.4%20122.5c13%20.3%2025.4%201.1%2037.6%202.5%203%20.4%205%203.3%205%206.7%200%203.3-1.7%205.6-4.7%207-11.2%204.8-22%208.2-33.7.2-6.5-4.5-9-8.7-4.2-16.4ZM247.6%20117c7%200%207.8%203.8%207%208.5-2%2010.2-20%2022.4-30.4%2020.5-5.9-1-10.5-4-10.7-10.5-.2-6.7%204.8-8.2%2010.3-8.4%209-.3%2015.8-5.2%2023.8-10ZM215.1%2076.6c5-12%209-29.4%2024.1-22.5%2020.7%209.4%2013.9%2030.7%209.7%2047.4-1.6%206.3-14.5%2015.9-18.3%2014.3-16.3-6.8-19.2-21.7-15.5-39.2ZM442%20113.4c-8.6%207.5-17%207.6-22.2-1.5-9-16-8.6-32.8%203.3-47.2%202.5-3%2013.8-3.6%2016.3-1%2014%2015%2014.6%2031.8%202.6%2049.7Z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(-45%20137)%22%3E%3Cg%20fill%3D%22%23000%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22m326%2014.3%20154.5%201c4.7.2%209.4.6%2014%201.3%207.1.9%2010.4%204.2%2012%2012a181%20181%200%200%201-6.3%2090.4c-5.4%2017.7-20%2028.1-37.5%2033.6-23%207.1-46.5%2012.4-69.8%203.9-20.8-7.6-37.2-20-42.9-44-.7-3-1.6-5.9-2.5-8.8-2.5-8.3-5-16.5-3.2-25.7.7-4-3.1-5.9-6-7.4h-.1c-15-7.6-29.7-.2-32.4%2016.5-3%2018.3-9%2035.8-19.4%2050.8-16.5%2023.9-41.6%2029.4-69%2026.1a97.2%2097.2%200%200%201-56.2-26.6%2058%2058%200%200%201-20-48.8c.8-11.2-5.5-16.3-13.8-17.7-14.3-2.4-27.6-7.8-40.8-13.2-4.7-2-9.4-3.9-14.2-5.6-7.2-2.7-14.5-5-21.8-7.3a384.7%20384.7%200%200%201-25-8.5c-3.8-1.4-7-2.6-6.4-8.5%205.7-2.6%2011-1%2016.4.8C39%2029.8%2042.8%2031%2046.8%2031c-2.7-9-8.3-12.4-17.3-12.8A35.3%2035.3%200%200%201%202%205C6.7.4%2011%20.7%2015%201.8c21.4%205.8%2043.2%209.1%2065%2012.4%2018%202.7%2036%205.4%2053.8%209.6%2010.3%202.3%2021.4%202.4%2031-6.5%206.3-5.6%2015.5-5.5%2024-5.3h3.1c25.3.3%2050.5.9%2076.2%201.4l32.3.7%2025.6.2ZM150.5%2080c3.3%2041.7%2026.7%2063%2062.7%2071%2023.6%205.2%2052.3.1%2066.8-26.8a203.8%20203.8%200%200%200%2017-47.6c4-15.2%2014.3-20%2035.7-18.3%2014.3%201.2%2020.9%207.9%2022.8%2022.5%201.4%2011%203%2022%205%2032.8%202.5%2013.7%2019.5%2030.3%2033.3%2033a117%20117%200%200%200%2064-4.6c12-4.3%2022.9-10.4%2028.7-23%2010-22%2013-45.3%2012.7-69.2-.2-22-1.6-23.4-24.3-23.5h-42.2c-19.6%200-39.1%200-58.6-.2l-75-.8c-29-.4-58-.8-87.1-1-3.5%200-7.1-.3-10.7-.7-10.8-1-21.7-2-30.3%205.1-9%207.4-17.8%207.4-27.4%207.4h-3.4c-2.5%200-5-.5-7.5-1-4.2-.9-8.5-1.8-13.1-.1%201.3%2014.8%204.7%2027.7%2021.9%2031.2%206.3%201.2%209.7%204.8%209%2013.8ZM74.5%2026.6c8.9-1.2%2017-2.2%2020%2010.5a195%20195%200%200%200%204%2011.4c-13-2.7-23.2-7.7-28.1-21.4l4.1-.5Z%22%2F%3E%3Cpath%20d%3D%22M287%2044.8c-.8-6%203-7.4%207-7.4%2019%200%2038%200%2057.1.5%204.4%200%208.5%202%2011.1%205.5-6.9%208.1-53.6%209.4-75.3%201.4Z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(119%20114)%22%3E%3Cpath%20d%3D%22M131.2%2043.2c-5.6%2016.8-6.6%2015.4-23%2011.6-26.2-6-52.7-19.2-80.3-4.3-2%201.1-5%201-7.6.8-3.6-.2-8.2%201.3-10.1-3.3-2.1-5%201.5-8.3%205.3-10.3C35.2%2027.7%2053%2013.4%2077.9%2016c12.8%201.3%2026-2.8%2039.3-2.4%2018.8.7%2022.4%205.7%2016%2023.9l-2%205.8ZM298.7%2021.8c9.6%206.6%2012.5%2016.8%2018.3%2025a7%207%200%200%201-.6%209.4c-2.4%202.7-5.4%202.8-8.1%201.2-19.1-11-38.9-6.4-58-1.2-10.2%202.7-14.6-.8-17.2-9.2-1.7-5.7-2.9-11.5-3.6-17.4-1.3-9.8%206.9-11.9%2013-12.2%2018.5-.9%2037.4-4.5%2056.2%204.4Z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E"

interface CoachAvatarProps {
  /**
   * Avatar image data.
   * - Legacy: base64-encoded PNG (no data: prefix)
   * - Current: full image data URI (e.g. data:image/svg+xml;utf8,...)
   */
  base64?: string | null
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl"
  /** Additional CSS classes */
  className?: string
  /** Alt text for accessibility */
  alt?: string
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
}

const sizePixels = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
} as const

export function CoachAvatar({
  base64,
  size = "md",
  className,
  alt = "AI Coach",
}: CoachAvatarProps) {
  const [hasError, setHasError] = useState(false)

  const looksCorruptedSvg =
    typeof base64 === "string" &&
    base64.startsWith("data:image/svg+xml") &&
    base64.includes("%23%23")

  // Use default avatar if no base64, if image failed to load, or if the SVG looks corrupted
  const useDefault = !base64 || hasError || looksCorruptedSvg

  const src = useDefault
    ? DEFAULT_COACH_AVATAR
    : base64.startsWith("data:image/")
      ? base64
      : `data:image/png;base64,${base64}`

  return (
    <Image
      src={src}
      alt={alt}
      width={sizePixels[size]}
      height={sizePixels[size]}
      className={cn(
        "rounded-full object-cover flex-shrink-0",
        sizeClasses[size],
        className
      )}
      unoptimized
      onError={() => setHasError(true)}
    />
  )
}

/**
 * Loading state variant of the coach avatar.
 * Shows a pulsing placeholder while avatar is being generated.
 */
export function CoachAvatarLoading({
  size = "md",
  className,
}: Pick<CoachAvatarProps, "size" | "className">) {
  return (
    <div
      className={cn(
        "rounded-full bg-muted/50 animate-pulse flex-shrink-0",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading avatar..."
    />
  )
}
