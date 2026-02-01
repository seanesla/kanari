"use client"

import Link, { type LinkProps } from "next/link"
import type { AnchorHTMLAttributes, MouseEvent } from "react"
import { useRouteTransition } from "@/lib/route-transition-context"

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "href"> & {
    href: string
  }

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>) {
  return e.button === 0 && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

export function TransitionLink({ href, onClick, target, rel, prefetch, ...props }: Props) {
  const { begin } = useRouteTransition()

  const shouldPrefetch = href.startsWith("/")
  const resolvedPrefetch = shouldPrefetch ? (prefetch ?? true) : undefined

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      prefetch={resolvedPrefetch}
      onClick={(e) => {
        onClick?.(e)

        // Don't animate for new tabs/windows or modified clicks.
        if (!isPlainLeftClick(e)) return
        if (target && target !== "_self") return

        begin(href)
      }}
      {...props}
    />
  )
}
