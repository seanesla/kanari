"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"

function isPerfDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.has("perf")) return true
  } catch {
    // ignore
  }

  try {
    return window.localStorage.getItem("kanari:perfDebug") === "true"
  } catch {
    return false
  }
}

export function R3FJankLogger() {
  const [enabled, setEnabled] = useState(false)
  const lastLogAtRef = useRef(0)

  useEffect(() => {
    setEnabled(isPerfDebugEnabled())
  }, [])

  useFrame((state, delta) => {
    if (!enabled) return

    const dtMs = delta * 1000
    if (dtMs < 140) return

    const dtRounded = Math.round(dtMs)

    const now = performance.now()
    if (now - lastLogAtRef.current < 800) return
    lastLogAtRef.current = now

    const info = state.gl.info
    console.warn(`[Perf] R3F frame gap ${dtRounded}ms`, {
      dtMs: dtRounded,
      calls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
      programs: (info as unknown as { programs?: unknown[] }).programs?.length ?? null,
    })
  })

  return null
}
