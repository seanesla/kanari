"use client"

import { useEffect } from "react"
import { isDemoWorkspace, setWorkspace } from "@/lib/workspace"
import { hardReload } from "@/lib/navigation/hard-reload"

export function ExitDemoOnLanding() {
  useEffect(() => {
    if (!isDemoWorkspace()) return
    setWorkspace("real")
    hardReload()
  }, [])

  return null
}
