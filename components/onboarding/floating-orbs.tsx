"use client"

/**
 * Floating Orbs Background
 *
 * Animated ambient background with floating orbs that use the accent color.
 * Creates a calming, aesthetic atmosphere for the onboarding experience.
 */

import { motion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"

interface Orb {
  id: number
  size: number
  initialX: number
  initialY: number
  duration: number
  delay: number
}

// Generate random orbs with varying sizes and positions
const generateOrbs = (count: number): Orb[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 200 + 100, // 100-300px
    initialX: Math.random() * 100, // 0-100%
    initialY: Math.random() * 100, // 0-100%
    duration: Math.random() * 20 + 20, // 20-40s
    delay: Math.random() * -20, // Stagger start times
  }))
}

const orbs = generateOrbs(6)

export function FloatingOrbs() {
  const { accentColor } = useSceneMode()

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.initialX}%`,
            top: `${orb.initialY}%`,
            background: `radial-gradient(circle, ${accentColor}15 0%, ${accentColor}05 50%, transparent 70%)`,
            filter: "blur(40px)",
          }}
          animate={{
            x: [0, 50, -30, 20, 0],
            y: [0, -40, 30, -20, 0],
            scale: [1, 1.1, 0.9, 1.05, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}

      {/* Central glow that follows accent color */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 600,
          height: 600,
          background: `radial-gradient(circle, ${accentColor}10 0%, transparent 60%)`,
          filter: "blur(60px)",
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.7, 0.5],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  )
}
