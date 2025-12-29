import { cn } from "@/lib/utils"

interface DecorativeGridProps {
  opacity?: "standard" | "light"
  className?: string
}

export function DecorativeGrid({
  opacity = "standard",
  className,
}: DecorativeGridProps) {
  const gridOpacity = opacity === "light" ? "#ffffff05" : "#ffffff0a"

  return (
    <div
      className={cn(
        "pointer-events-none absolute -top-14 -bottom-14 left-0 right-0 mask-fade-vertical",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to right, ${gridOpacity} 1px, transparent 1px), linear-gradient(to bottom, ${gridOpacity} 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
      }}
    />
  )
}
