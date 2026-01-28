"use client"

import type { MutableRefObject } from "react"
import { Environment, Stars } from "@react-three/drei"
import { useReducedMotion } from "framer-motion"
import type { SceneMode } from "@/lib/types"
import { useSceneMode } from "@/lib/scene-context"
import {
  DistantStars,
  FloatingGeometryField,
  GalaxySprites,
  NebulaBackdrop,
  NebulaVolume,
  ShootingStars,
  StarClusters,
} from "@/components/background/space-effects"
import { SECTION_POSITIONS, SECTION_THRESHOLDS } from "./constants"
import { KanariCore } from "./kanari-core"
import { SectionAccent } from "./section-accent"
import { AmbientParticles } from "./ambient-particles"
import { ScrollCamera } from "./scroll-camera"

interface SceneProps {
  scrollProgressRef: MutableRefObject<number>
  mode: SceneMode
  isMobile?: boolean
}

export function Scene({ scrollProgressRef, mode, isMobile = false }: SceneProps) {
  const { accentColor } = useSceneMode()
  const reducedMotion = useReducedMotion()
  const isLowQuality = isMobile
  const shouldAnimate = !reducedMotion && !isLowQuality

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={isLowQuality ? 0.12 : 0.1} />
      <pointLight position={[5, 5, 5]} intensity={isLowQuality ? 0.7 : 1} color={accentColor} />
      <pointLight position={[-5, -3, -5]} intensity={isLowQuality ? 0.25 : 0.4} color="#ffffff" />
      <spotLight position={[0, 10, 0]} intensity={isLowQuality ? 0.55 : 0.8} angle={0.6} penumbra={1} color={accentColor} />

      {isLowQuality ? null : <Environment preset="night" />}

      <ScrollCamera scrollProgressRef={scrollProgressRef} mode={mode} />

      {/* Deep space backplate (kept subtle to not compete with KanariCore). */}
      {isLowQuality ? (
        <Stars radius={90} depth={35} count={520} factor={3} saturation={0.1} fade />
      ) : (
        <>
          <DistantStars accentColor={accentColor} variant="landing" animate={shouldAnimate} />
          <GalaxySprites accentColor={accentColor} variant="landing" animate={shouldAnimate} />
          <StarClusters accentColor={accentColor} variant="landing" animate={shouldAnimate} />
          <NebulaVolume accentColor={accentColor} variant="landing" animate={shouldAnimate} />
          <NebulaBackdrop accentColor={accentColor} variant="landing" animate={shouldAnimate} />
          <ShootingStars accentColor={accentColor} variant="landing" animate={shouldAnimate} />
          <FloatingGeometryField accentColor={accentColor} variant="landing" animate={shouldAnimate} />
        </>
      )}

      {/* THE focal point - always visible, transforms with scroll */}
      <KanariCore scrollProgressRef={scrollProgressRef} mode={mode} isMobile={isMobile} />

      {/* Section-specific accents that fade in */}
      {isLowQuality ? null : (
        <>
          <SectionAccent
            position={SECTION_POSITIONS.stats}
            scrollProgressRef={scrollProgressRef}
            showAfter={SECTION_THRESHOLDS.stats}
            type="stats"
            mode={mode}
          />
          <SectionAccent
            position={SECTION_POSITIONS.problem}
            scrollProgressRef={scrollProgressRef}
            showAfter={SECTION_THRESHOLDS.problem}
            type="problem"
            mode={mode}
          />
          <SectionAccent
            position={SECTION_POSITIONS.how}
            scrollProgressRef={scrollProgressRef}
            showAfter={SECTION_THRESHOLDS.how}
            type="how"
            mode={mode}
          />
          <SectionAccent
            position={SECTION_POSITIONS.cta}
            scrollProgressRef={scrollProgressRef}
            showAfter={SECTION_THRESHOLDS.cta}
            type="cta"
            mode={mode}
          />

          {/* Subtle ambient particles */}
          <AmbientParticles scrollProgressRef={scrollProgressRef} mode={mode} />
        </>
      )}
    </>
  )
}
