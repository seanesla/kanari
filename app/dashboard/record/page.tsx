import { redirect } from "next/navigation"

export default function RecordPage() {
  redirect("/dashboard/recordings?newRecording=true")
}
