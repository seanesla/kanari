"use client"

import { useEffect, useState, useRef } from "react"
import { useCursorGlow } from "@/hooks/use-cursor-glow"
import { CursorBorderGlow } from "@/components/ui/cursor-border-glow"

interface LiquidGlassNavbarProps {
  children: React.ReactNode
  className?: string
  [key: `data-${string}`]: unknown
}

// Generate displacement map data URL for lens refraction effect
function generateDisplacementMap(width = 256, height = 64): string {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4

      // Normalize coordinates to -1 to 1
      const nx = (x / width) * 2 - 1
      const ny = (y / height) * 2 - 1

      // Calculate distance from center for radial effect
      const dist = Math.sqrt(nx * nx + ny * ny)

      // Lens-like displacement: subtle push toward edges
      const factor = Math.pow(dist, 1.8) * 0.25

      // R channel = X displacement, G channel = Y displacement
      // 128 = no displacement
      const dx = nx * factor
      const dy = ny * factor

      data[i] = Math.round(128 + dx * 127) // R
      data[i + 1] = Math.round(128 + dy * 127) // G
      data[i + 2] = 128 // B (unused)
      data[i + 3] = 255 // A
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL("image/png")
}

export function LiquidGlassNavbar({ children, className = "", ...props }: LiquidGlassNavbarProps) {
  const [supportsFilter, setSupportsFilter] = useState(false)
  const [displacementMap, setDisplacementMap] = useState<string>("")
  const filterRef = useRef<string>(`liquid-glass-${Math.random().toString(36).slice(2, 9)}`)
  const glow = useCursorGlow({ clampToBorder: true })
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    // Feature detect: Chromium supports SVG filters in backdrop-filter
    const isChromium =
      (/Chrome/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent)) ||
      /Edg/.test(navigator.userAgent)
    setSupportsFilter(isChromium)

    // Generate displacement map on mount
    if (isChromium) {
      setDisplacementMap(generateDisplacementMap())
    }
  }, [])

  const filterId = filterRef.current

  return (
    <>
      {/* SVG Filter Definition for true refraction (Chromium only) */}
      {supportsFilter && displacementMap && (
        <svg
          style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <defs>
            <filter
              id={filterId}
              colorInterpolationFilters="sRGB"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              {/* Base blur for glass effect */}
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blur" />

              {/* Displacement map for refraction */}
              <feImage
                href={displacementMap}
                x="0"
                y="0"
                width="100%"
                height="100%"
                result="dispMap"
                preserveAspectRatio="none"
              />

              {/* Apply displacement for lens-like refraction */}
              <feDisplacementMap
                in="blur"
                in2="dispMap"
                scale="15"
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
              />

              {/* Boost saturation slightly */}
              <feColorMatrix in="displaced" type="saturate" values="1.1" />
            </filter>
          </defs>
        </svg>
      )}

      <nav
        {...props}
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl ${className}`}
        onMouseMove={(event) => {
          glow.onMouseMove(event)
          setIsHovering(true)
        }}
        onMouseLeave={() => {
          glow.onMouseLeave()
          setIsHovering(false)
        }}
        style={{
          ...glow.style,
          backdropFilter:
            supportsFilter && displacementMap
              ? `url(#${filterId}) blur(16px) saturate(200%)`
              : "blur(24px) saturate(200%)",
          WebkitBackdropFilter: "blur(24px) saturate(200%)",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          boxShadow: `
            inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
            inset 0 -1px 0 0 rgba(0, 0, 0, 0.02),
            0 8px 32px rgba(0, 0, 0, 0.25),
            0 2px 8px rgba(0, 0, 0, 0.1)
          `,
        }}
      >
        <CursorBorderGlow
          className="rounded-2xl transition-opacity duration-200"
          size={260}
          borderWidth={1}
          style={{ opacity: isHovering ? 1 : 0 }}
        />
        {/* Inner content with subtle gradient overlay */}
        <div
          className="relative px-6 py-3 flex items-center gap-8"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
          }}
        >
          {children}
        </div>
      </nav>
    </>
  )
}
