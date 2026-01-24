"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}

export function ScrollReveal({ children, className, delay = 0, y = 28 }: ScrollRevealProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn("will-change-transform", className)}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y, filter: "blur(10px)" }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-120px 0px -80px 0px" }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.95, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {children}
    </motion.div>
  )
}
