"use client"

import type { MutableRefObject } from "react"
import { Environment } from "@react-three/drei"
import { useReducedMotion } from "framer-motion"
import type { SceneMode } from "@/lib/types"
import { useSceneMode } from "@/lib/scene-context"
import { getGraphicsProfile } from "@/lib/graphics/quality"
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
  const { accentColor, graphicsQuality } = useSceneMode()
  const reducedMotion = useReducedMotion()
  const profile = getGraphicsProfile(graphicsQuality, { prefersReducedMotion: Boolean(reducedMotion) })
  const shouldAnimate = profile.animate

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
      <>
        <DistantStars accentColor={accentColor} variant="landing" animate={shouldAnimate} />
        <GalaxySprites accentColor={accentColor} variant="landing" animate={shouldAnimate} />
        <StarClusters accentColor={accentColor} variant="landing" animate={shouldAnimate} />
        <NebulaVolume
          accentColor={accentColor}
          variant="landing"
          animate={shouldAnimate}
          layers={profile.nebulaVolumeLayers}
        />
        <NebulaBackdrop
          accentColor={accentColor}
          variant="landing"
          animate={shouldAnimate}
          density={profile.nebulaBackdropDensity}
        />
        {profile.shootingStars ? (
          <ShootingStars accentColor={accentColor} variant="landing" animate={shouldAnimate} />
        ) : null}
        {profile.floatingGeometry ? (
          <FloatingGeometryField accentColor={accentColor} variant="landing" animate={shouldAnimate} />
        ) : null}
      </>

      {/* THE focal point - always visible, transforms with scroll */}
      <KanariCore scrollProgressRef={scrollProgressRef} mode={mode} />

      {/* Section-specific accents that fade in */}
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
        <AmbientParticles scrollProgressRef={scrollProgressRef} mode={mode} animate={shouldAnimate} />
      </>
    </>
  )
}
