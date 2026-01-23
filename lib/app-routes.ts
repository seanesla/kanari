export const APP_ROUTES = ["/overview", "/check-ins", "/analytics", "/achievements", "/settings"] as const

export function isAppRoute(pathname: string) {
  return APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}
