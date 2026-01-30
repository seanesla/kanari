"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function MaskReveal({
  children,
  className,
  delay = 0,
  duration = 0.9,
  y = "110%",
  trigger = "animate",
  viewportMargin = "-120px 0px -80px 0px",
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  /** How far the text travels from its masked start position. */
  y?: number | string
  trigger?: "animate" | "inView"
  viewportMargin?: string
}) {
  const reduceMotion = useReducedMotion()

  const initial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y, filter: "blur(10px)" }

  const target = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: "blur(0px)" }

  const transition = reduceMotion
    ? { duration: 0, delay }
    : { duration, ease: EASE, delay }

  const shared = {
    className: cn("block will-change-transform", className),
    initial,
    transition,
  }

  return (
    <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
      {trigger === "inView" ? (
        <motion.span
          {...shared}
          whileInView={target}
          viewport={{ once: true, margin: viewportMargin }}
        >
          {children}
        </motion.span>
      ) : (
        <motion.span {...shared} animate={target}>
          {children}
        </motion.span>
      )}
    </span>
  )
}
