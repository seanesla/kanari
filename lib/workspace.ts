export type KanariWorkspace = "real" | "demo"

export const WORKSPACE_STORAGE_KEY = "kanari:workspace"

export function getWorkspace(): KanariWorkspace {
  if (typeof window === "undefined") return "real"
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    return raw === "demo" ? "demo" : "real"
  } catch {
    return "real"
  }
}

export function isDemoWorkspace(): boolean {
  return getWorkspace() === "demo"
}

export function setWorkspace(workspace: KanariWorkspace): void {
  if (typeof window === "undefined") return
  try {
    if (workspace === "demo") {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, "demo")
    } else {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    }
  } catch {
    // Ignore localStorage failures (private mode, quota, etc.)
  }
}
