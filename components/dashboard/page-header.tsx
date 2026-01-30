"use client"

import { cn } from "@/lib/utils"
import { motion, useReducedMotion } from "framer-motion"
import { Deck } from "@/components/dashboard/deck"

interface PageHeaderProps {
  title: string
  titleAccent?: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  titleAccent,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  const reduceMotion = useReducedMotion()
  const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

  const titleInitial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: "120%", filter: "blur(10px)" }

  const titleAnimate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: "blur(0px)" }

  const titleTransition = reduceMotion ? { duration: 0 } : { duration: 0.9, ease: EASE }

  const subtitleInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(8px)" }
  const subtitleAnimate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: "blur(0px)" }

  const subtitleTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.75, ease: EASE, delay: 0.08 }

  return (
    <Deck
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl md:text-2xl font-serif tracking-tight">
          <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
            <motion.span
              className="block"
              initial={titleInitial}
              animate={titleAnimate}
              transition={titleTransition}
            >
              {titleAccent ? (
                <>
                  {title} <span className="text-accent">{titleAccent}</span>
                </>
              ) : (
                title
              )}
            </motion.span>
          </span>
        </h1>
        {subtitle && (
          <motion.p
            className="text-sm text-muted-foreground max-w-xl"
            initial={subtitleInitial}
            animate={subtitleAnimate}
            transition={subtitleTransition}
          >
            {subtitle}
          </motion.p>
        )}
      </div>

      {actions && (
        <motion.div
          className="flex items-center gap-2"
          initial={subtitleInitial}
          animate={subtitleAnimate}
          transition={subtitleTransition}
        >
          {actions}
        </motion.div>
      )}
    </Deck>
  )
}
