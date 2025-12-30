/**
 * Record Page Redirect
 *
 * This page redirects to the unified history page with the recording drawer open.
 * Kept for backwards compatibility with any direct links to /dashboard/record.
 */

import { redirect } from "next/navigation"

/**
 * Default export - redirects to the history page with newRecording param
 * which opens the recording drawer automatically
 */
export default function RecordPage() {
  redirect("/dashboard/history?newRecording=true")
}
