"use client"

export function KanariTextLogo({
  className = "h-8 w-auto",
}: {
  className?: string
}) {
  return (
    <span className={`font-serif tracking-tight ${className}`}>
      kanari
    </span>
  )
}
