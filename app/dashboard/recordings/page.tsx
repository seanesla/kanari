/**
 * Recordings Page Redirect
 *
 * This page has been moved to /dashboard/check-ins
 * This file now redirects to the unified check-in history page.
 *
 * This redirect is kept for backwards compatibility with any
 * direct links or bookmarks pointing to the old URL.
 */

import { redirect } from "next/navigation"

/**
 * Default export - redirects to the new check-ins page
 */
export default function RecordingsPage() {
  redirect("/dashboard/check-ins")
}
