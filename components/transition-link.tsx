"use client"

import Link, { type LinkProps } from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useState, type AnchorHTMLAttributes, type MouseEvent } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useRouteTransition } from "@/lib/route-transition-context"
import { isDemoWorkspace } from "@/lib/workspace"

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "href"> & {
    href: string
  }

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>) {
  return e.button === 0 && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

function toAppPathname(href: string): string | null {
  if (href.startsWith("#")) return null
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href)) return null

  const q = href.indexOf("?")
  const h = href.indexOf("#")
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h)
  const raw = (cut === -1 ? href : href.slice(0, cut)).trim()
  if (!raw.startsWith("/")) return null
  return raw.length > 0 ? raw : "/"
}

function shouldWarnBeforeLandingInDemo(pathname: string, href: string): boolean {
  if (!isDemoWorkspace()) return false
  if (pathname === "/") return false
  return toAppPathname(href) === "/"
}

export function TransitionLink({ href, onClick, target, rel, prefetch, ...props }: Props) {
  const router = useRouter()
  const pathname = usePathname() ?? "/"
  const { begin } = useRouteTransition()
  const [showDemoExitWarning, setShowDemoExitWarning] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const shouldPrefetch = href.startsWith("/")
  const resolvedPrefetch = shouldPrefetch ? (prefetch ?? true) : undefined

  const closeWarning = useCallback(() => {
    setShowDemoExitWarning(false)
    setPendingHref(null)
  }, [])

  const continueToLanding = useCallback(() => {
    if (!pendingHref) return
    begin(pendingHref)
    router.push(pendingHref)
    closeWarning()
  }, [begin, closeWarning, pendingHref, router])

  return (
    <>
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

          // See: docs/error-patterns/demo-landing-navigation-without-warning.md
          if (shouldWarnBeforeLandingInDemo(pathname, href)) {
            e.preventDefault()
            setPendingHref(href)
            setShowDemoExitWarning(true)
            return
          }

          begin(href)
        }}
        {...props}
      />

      <AlertDialog open={showDemoExitWarning} onOpenChange={(open) => !open && closeWarning()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Demo Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              Going back to the landing page exits demo mode and resets the demo workspace. Your real workspace data
              stays untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeWarning}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={continueToLanding}>Continue to Landing</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
