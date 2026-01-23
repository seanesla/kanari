import { redirect } from "next/navigation"

type SearchParams = Record<string, string | string[] | undefined>

export default function HistoryRedirectPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v)
      continue
    }
    params.set(key, value)
  }

  const query = params.toString()
  redirect(`/dashboard/check-ins${query ? `?${query}` : ""}`)
}
