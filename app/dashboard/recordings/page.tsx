/**
 * Recordings Page Redirect
 *
 * This page has been moved to /dashboard/history
 * This file now redirects to the unified check-in history page.
 *
 * This redirect is kept for backwards compatibility with any
 * direct links or bookmarks pointing to the old URL.
 */

import { redirect } from "next/navigation"

/**
 * Default export - redirects to the new history page
 */
export default function RecordingsPage() {
  redirect("/dashboard/history")
}
