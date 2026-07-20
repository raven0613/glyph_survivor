import { getGlyphAtlasFrame } from '../glyph/glyphFontBank.ts'
import { HOSTILE_PROJECTILE_PHASE } from '../runtime/hostileProjectileState.ts'
import type { CameraView } from '../runtime/cameraTransform.ts'
import type { WorldState } from '../runtime/worldState.ts'
import {
  GOLDEN_ANGLE,
  interpolate,
  isWorldPositionVisible,
} from './glyphRenderGeometry.ts'
import { writeRenderGlyph } from './renderGlyphBuffer.ts'
import type { RenderGlyph } from './renderSnapshot.ts'
import {
  solveArchimedeanSpiralTheta,
  writeArchimedeanSpiralPose,
  type ArchimedeanSpiralPose,
} from '../systems/rhombusSpiralGeometry.ts'

function getDissipationProgress(
  remainingMs: number,
  durationMs: number,
): number {
  return durationMs > 0 ? 1 - remainingMs / durationMs : 1
}

function resolveFadeMultiplier(progress: number, fadeStartRatio: number): number {
  if (progress <= fadeStartRatio) {
    return 1
  }
  return Math.max(0, 1 - (progress - fadeStartRatio) / (1 - fadeStartRatio))
}

export function writeHostileProjectileRenderSnapshot(
  world: WorldState,
  projectileGlyphs: RenderGlyph[],
  effects: RenderGlyph[],
  camera: CameraView,
  interpolationAlpha: number,
): void {
  const appearance =
    world.content.combatVisualTheme.effects.rhombus.hostileSpike
  const identityStride = appearance.particleCount + 2
  let projectileGlyphCount = projectileGlyphs.length
  let effectCount = effects.length
  const interpolatedPose: ArchimedeanSpiralPose = {
    x: 0,
    y: 0,
    tangentX: 0,
    tangentY: 0,
    tangentRotation: 0,
  }

  for (const projectile of world.hostileProjectiles) {
    if (projectile.phase === HOSTILE_PROJECTILE_PHASE.SPENT) {
      continue
    }
    const isDissipating =
      projectile.phase === HOSTILE_PROJECTILE_PHASE.DISSIPATING
    const isStaged =
      projectile.phase === HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING
    if (isDissipating) {
      interpolatedPose.x = projectile.x
      interpolatedPose.y = projectile.y
      interpolatedPose.tangentX = projectile.tangentX
      interpolatedPose.tangentY = projectile.tangentY
      interpolatedPose.tangentRotation = projectile.tangentRotation
    } else if (isStaged) {
      interpolatedPose.x = interpolate(
        projectile.previousX,
        projectile.x,
        interpolationAlpha,
      )
      interpolatedPose.y = interpolate(
        projectile.previousY,
        projectile.y,
        interpolationAlpha,
      )
      interpolatedPose.tangentX = projectile.tangentX
      interpolatedPose.tangentY = projectile.tangentY
      interpolatedPose.tangentRotation = projectile.tangentRotation
    } else {
      const travelledDistance = interpolate(
        projectile.previousTravelledDistance,
        projectile.travelledDistance,
        interpolationAlpha,
      )
      const thetaRadians = solveArchimedeanSpiralTheta(
        travelledDistance,
        projectile.spiralTightness,
        projectile.initialRadius,
      )
      writeArchimedeanSpiralPose(
        interpolatedPose,
        projectile.originX,
        projectile.originY,
        thetaRadians,
        projectile.spiralTightness,
        projectile.initialRadius,
        projectile.initialPhaseRadians,
        projectile.directionSign,
      )
    }
    const x = interpolatedPose.x
    const y = interpolatedPose.y
    if (!isWorldPositionVisible(x, y, camera)) {
      continue
    }
    const progress = isDissipating
      ? getDissipationProgress(
          projectile.dissipationRemainingMs,
          projectile.dissipationDurationMs,
        )
      : 0
    const color = isDissipating ? appearance.dissipation : appearance.active
    const alpha =
      color.alpha *
      (isDissipating
        ? resolveFadeMultiplier(progress, appearance.fadeOutStartRatio)
        : 1)
    const halfSpacing = projectile.pairSpacing / 2
    const baseIdentity = -(projectile.id * identityStride)

    writeRenderGlyph(
      projectileGlyphs,
      projectileGlyphCount,
      baseIdentity - 1,
      projectile.leftGlyphFrame,
      x - interpolatedPose.tangentX * halfSpacing,
      y - interpolatedPose.tangentY * halfSpacing,
      projectile.visualScale,
      alpha,
      color.tint,
      interpolatedPose.tangentRotation,
    )
    projectileGlyphCount += 1
    writeRenderGlyph(
      projectileGlyphs,
      projectileGlyphCount,
      baseIdentity - 2,
      projectile.rightGlyphFrame,
      x + interpolatedPose.tangentX * halfSpacing,
      y + interpolatedPose.tangentY * halfSpacing,
      projectile.visualScale,
      alpha,
      color.tint,
      interpolatedPose.tangentRotation,
    )
    projectileGlyphCount += 1

    if (!isDissipating) {
      continue
    }
    for (
      let particleIndex = 0;
      particleIndex < appearance.particleCount;
      particleIndex += 1
    ) {
      const angle = projectile.id * GOLDEN_ANGLE + particleIndex * GOLDEN_ANGLE
      const distance = appearance.particleDistance * progress
      const character =
        appearance.particleCharacters[
          particleIndex % appearance.particleCharacters.length
        ]
      writeRenderGlyph(
        effects,
        effectCount,
        baseIdentity - 3 - particleIndex,
        getGlyphAtlasFrame(projectile.fontBankId, character),
        x + Math.cos(angle) * distance,
        y + Math.sin(angle) * distance,
        appearance.particleScale,
        alpha,
        appearance.dissipation.tint,
      )
      effectCount += 1
    }
  }

  projectileGlyphs.length = projectileGlyphCount
  effects.length = effectCount
}
