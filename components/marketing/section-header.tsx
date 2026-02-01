import { cn } from "@/lib/utils"

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  align?: "left" | "center"
  className?: string
}) {
  return (
    <div className={cn(align === "center" ? "text-center mx-auto" : "", className)}>
      {eyebrow ? (
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{eyebrow}</p>
      ) : null}
      <h2 className={cn("text-4xl md:text-5xl font-serif leading-[1.1]", align === "center" ? "mx-auto" : "")}>
        {title}
      </h2>
      {description ? (
        <p className={cn("mt-6 text-muted-foreground text-lg leading-relaxed", align === "center" ? "mx-auto max-w-2xl" : "max-w-xl")}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
