"use client"

import type { MutableRefObject } from "react"
import { Environment } from "@react-three/drei"
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
}

export function Scene({ scrollProgressRef, mode }: SceneProps) {
  const { accentColor } = useSceneMode()
  const reducedMotion = useReducedMotion()

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.1} />
      <pointLight position={[5, 5, 5]} intensity={1} color={accentColor} />
      <pointLight position={[-5, -3, -5]} intensity={0.4} color="#ffffff" />
      <spotLight position={[0, 10, 0]} intensity={0.8} angle={0.6} penumbra={1} color={accentColor} />

      <Environment preset="night" />

      <ScrollCamera scrollProgressRef={scrollProgressRef} mode={mode} />

      {/* Deep space backplate (kept subtle to not compete with KanariCore). */}
      <DistantStars accentColor={accentColor} variant="landing" animate={!reducedMotion} />
      <GalaxySprites accentColor={accentColor} variant="landing" animate={!reducedMotion} />
      <StarClusters accentColor={accentColor} variant="landing" animate={!reducedMotion} />
      <NebulaVolume accentColor={accentColor} variant="landing" animate={!reducedMotion} />
      <NebulaBackdrop accentColor={accentColor} variant="landing" animate={!reducedMotion} />
      <ShootingStars accentColor={accentColor} variant="landing" animate={!reducedMotion} />
      <FloatingGeometryField accentColor={accentColor} variant="landing" animate={!reducedMotion} />

      {/* THE focal point - always visible, transforms with scroll */}
      <KanariCore scrollProgressRef={scrollProgressRef} mode={mode} />

      {/* Section-specific accents that fade in */}
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
  )
}
