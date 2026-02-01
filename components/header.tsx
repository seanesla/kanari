"use client"

import { TransitionLink } from "@/components/transition-link"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Menu, X } from "@/lib/icons"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <TransitionLink href="/" className="flex items-center gap-2">
          <span className="text-xl font-semibold tracking-tight">kanari</span>
        </TransitionLink>

        <nav className="hidden items-center gap-8 md:flex">
          <TransitionLink href="/#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Features
          </TransitionLink>
          <TransitionLink href="/#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            How it Works
          </TransitionLink>
          <TransitionLink href="/#trust" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Trust
          </TransitionLink>
          <TransitionLink href="/overview" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Overview
          </TransitionLink>
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <TransitionLink href="/login">Log in</TransitionLink>
          </Button>
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <TransitionLink href="/overview">Get Started</TransitionLink>
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-background px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            <TransitionLink href="/#features" className="text-sm text-muted-foreground">
              Features
            </TransitionLink>
            <TransitionLink href="/#how-it-works" className="text-sm text-muted-foreground">
              How it Works
            </TransitionLink>
            <TransitionLink href="/#trust" className="text-sm text-muted-foreground">
              Trust
            </TransitionLink>
            <TransitionLink href="/overview" className="text-sm text-muted-foreground">
              Overview
            </TransitionLink>
            <div className="flex gap-2 pt-4">
              <Button variant="ghost" size="sm" className="flex-1" asChild>
                <TransitionLink href="/login">Log in</TransitionLink>
              </Button>
              <Button size="sm" className="flex-1 bg-accent text-accent-foreground" asChild>
                <TransitionLink href="/overview">Get Started</TransitionLink>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
