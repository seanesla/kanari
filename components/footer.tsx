import Link from "next/link"
import { KanariTextLogo } from "@/components/kanari-text-logo"

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2 text-accent">
            <KanariTextLogo className="text-2xl" />
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-8">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
              How It Works
            </Link>
            <Link href="https://github.com/seanesla/kanari" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
              GitHub
            </Link>
            <Link href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
              Get API Key
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
