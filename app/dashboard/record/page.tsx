/**
 * Record Page Redirect
 *
 * This page redirects to the unified history page with the check-in flow open.
 * Kept for backwards compatibility with any direct links to /dashboard/record.
 */

import { redirect } from "next/navigation"

/**
 * Default export - redirects to the history page with newCheckIn param
 * which opens the check-in flow automatically
 */
export default function RecordPage() {
  redirect("/dashboard/history?newCheckIn=true")
}
