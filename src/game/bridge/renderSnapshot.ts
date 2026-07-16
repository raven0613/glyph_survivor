import type { WorldState } from '../runtime/worldState.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import { getPrintableAsciiGlyphFrame } from '../glyph/glyphFrame.ts'
import {
  getGlyphMaterialDefinition,
  type GlyphMaterialDefinition,
} from '../glyph/glyphMaterial.ts'
import { calculateGlyphHitPresentation } from './glyphHitPresentation.ts'
import {
  getPlayerAttackAppearance,
  resolveGlyphImpactPresentation,
} from '../content/visuals/combatVisualTheme.ts'
import { resolveExperienceDropPresentation } from '../content/visuals/experienceDropPresentation.ts'
import {
  createRenderPlayerState,
  writeRenderPlayerState,
  type RenderPlayerState,
} from './playerRenderSnapshot.ts'
import { getDeathReviewPresentationTimeMs } from '../runtime/playerDeathReview.ts'
import {
  COLLAPSE_SCATTER_DISTANCE,
  GOLDEN_ANGLE,
  interpolate,
  isWorldPositionVisible,
} from './glyphRenderGeometry.ts'
import { writeRenderGlyph } from './renderGlyphBuffer.ts'
import { writeTopologyTransferRenderSnapshot } from './topologyTransferRenderSnapshot.ts'

const MAX_BURST_PARTICLES_PER_GLYPH = 8
const MAX_ACTIVE_IMPACT_PARTICLES = 192
const HIT_BURST_SPREAD_RADIANS = 1.4

export interface RenderGlyph {
  id: number
  glyphFrame: number
  x: number
  y: number
  rotation: number
  scale: number
  alpha: number
  tint: number
}

export interface RenderFlameEmitter {
  id: number
  x: number
  y: number
  directionX: number
  directionY: number
  range: number
  fullAngleRadians: number
  progress: number
  particleCount: number
  innerTint: number
  innerAlpha: number
  outerTint: number
  outerAlpha: number
  seed: number
}

export interface RenderSnapshot extends RenderPlayerState {
  readonly enemies: RenderGlyph[]
  readonly effects: RenderGlyph[]
  readonly topologyTransferPulses: RenderGlyph[]
  readonly projectiles: RenderGlyph[]
  readonly orbits: RenderGlyph[]
  readonly drops: RenderGlyph[]
  readonly flameEmitters: RenderFlameEmitter[]
}

export function createRenderSnapshot(): RenderSnapshot {
  return {
    ...createRenderPlayerState(),
    enemies: [],
    effects: [],
    topologyTransferPulses: [],
    projectiles: [],
    orbits: [],
    drops: [],
    flameEmitters: [],
  }
}

function writeSpreadEffect(
  snapshot: RenderSnapshot,
  startIndex: number,
  glyphId: number,
  x: number,
  y: number,
  intensity: number,
  tint: number,
  alpha: number,
): number {
  if (intensity <= 0 || startIndex >= MAX_ACTIVE_IMPACT_PARTICLES) {
    return startIndex
  }
  const angle = glyphId * GOLDEN_ANGLE
  const distance = 5 + (1 - intensity) * 8
  writeRenderGlyph(
    snapshot.effects,
    startIndex,
    -glyphId,
    getPrintableAsciiGlyphFrame('+'),
    x + Math.cos(angle) * distance,
    y + Math.sin(angle) * distance,
    0.4 + intensity * 0.18,
    intensity * alpha,
    tint,
  )
  return startIndex + 1
}

function writeImpactEffects(
  snapshot: RenderSnapshot,
  startIndex: number,
  glyphId: number,
  x: number,
  y: number,
  velocityX: number,
  velocityY: number,
  material: GlyphMaterialDefinition,
  impactTint: number,
  intensity: number,
): number {
  if (intensity <= 0 || startIndex >= MAX_ACTIVE_IMPACT_PARTICLES) {
    return startIndex
  }

  const speed = Math.hypot(velocityX, velocityY)
  const baseAngle =
    speed > 0.001
      ? Math.atan2(velocityY, velocityX)
      : glyphId * GOLDEN_ANGLE
  const elapsedProgress = 1 - intensity ** 2
  const particleCount = Math.min(
    material.hitBurstParticleCount,
    MAX_BURST_PARTICLES_PER_GLYPH,
    MAX_ACTIVE_IMPACT_PARTICLES - startIndex,
  )

  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const spreadRatio =
      particleCount === 1 ? 0 : particleIndex / (particleCount - 1) - 0.5
    const angle = baseAngle + spreadRatio * HIT_BURST_SPREAD_RADIANS
    const distanceScale = 0.8 + (particleIndex % 3) * 0.1
    const distance =
      material.hitBurstDistance *
      (0.12 + elapsedProgress * 0.88) *
      distanceScale
    const character =
      material.hitBurstCharacters[
        particleIndex % material.hitBurstCharacters.length
      ]

    writeRenderGlyph(
      snapshot.effects,
      startIndex,
      glyphId * MAX_BURST_PARTICLES_PER_GLYPH + particleIndex,
      getPrintableAsciiGlyphFrame(character),
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      material.hitBurstScale * (0.75 + intensity * 0.25),
      intensity,
      impactTint,
    )
    startIndex += 1
  }

  return startIndex
}

export function writeRenderSnapshot(
  world: WorldState,
  snapshot: RenderSnapshot,
  interpolationAlpha: number,
): void {
  const camera = writeRenderPlayerState(world, snapshot, interpolationAlpha)
  const presentationTimeMs = getDeathReviewPresentationTimeMs(
    world.runTimeMs,
    world.deathReview,
  )

  let enemyCount = 0
  let effectCount = 0
  for (const enemy of world.enemies) {
    if (enemy.phase === 'DEAD') {
      continue
    }

    const rootX = interpolate(enemy.previousX, enemy.x, interpolationAlpha)
    const rootY = interpolate(enemy.previousY, enemy.y, interpolationAlpha)
    const materializeProgress =
      enemy.phase === 'MATERIALIZING'
        ? 1 - enemy.materializeRemainingMs / enemy.materializeDurationMs
        : 1
    const collapseProgress =
      enemy.phase === 'COLLAPSING'
        ? 1 - enemy.collapseRemainingMs / enemy.collapseDurationMs
        : 0

    for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
      const material = getGlyphMaterialDefinition(glyph.material)
      const impactPresentation = resolveGlyphImpactPresentation(
        world.content.combatVisualTheme,
        glyph.appearanceProfileId,
      )
      const hitPresentation = calculateGlyphHitPresentation({
        baseAlpha: glyph.alpha,
        baseScale: glyph.scale,
        baseTint: glyph.baseTint,
        hitTint: impactPresentation.tint,
        hitFlashRemainingMs: glyph.hitFlashRemainingMs,
        hitFlashDurationMs: material.hitFlashDurationMs,
        hitPulseScale: material.hitPulseScale,
        hitAlphaFloor: impactPresentation.alpha,
      })
      const spreadAccent =
        glyph.spreadFeedbackVisualRoleId === null
          ? null
          : getPlayerAttackAppearance(
              world.content.combatVisualTheme,
              glyph.spreadFeedbackVisualRoleId,
            ).accent
      const spreadIntensity =
        glyph.hitFlashRemainingMs > 0 || spreadAccent === null
          ? 0
          : Math.min(
              1,
              glyph.spreadFlashRemainingMs /
                world.content.combatVisualTheme.effects
                  .spreadFeedbackDurationMs,
            )
      const collapseAngle = glyph.id * GOLDEN_ANGLE
      const collapseDistance = collapseProgress * COLLAPSE_SCATTER_DISTANCE
      const x =
        getGlyphWorldX(rootX, glyph) + Math.cos(collapseAngle) * collapseDistance
      const y =
        getGlyphWorldY(rootY, glyph) + Math.sin(collapseAngle) * collapseDistance
      if (!isWorldPositionVisible(x, y, camera)) {
        continue
      }

      writeRenderGlyph(
        snapshot.enemies,
        enemyCount,
        glyph.id,
        glyph.glyphFrame,
        x,
        y,
        materializeProgress *
          hitPresentation.scale *
          (1 +
            spreadIntensity *
              world.content.combatVisualTheme.effects
                .spreadFeedbackScaleBonus) *
          (1 - collapseProgress * 0.7),
        materializeProgress *
          Math.max(
            hitPresentation.alpha,
            spreadIntensity *
              world.content.combatVisualTheme.effects.spreadFeedbackAlpha,
          ) *
          (1 - collapseProgress),
        spreadIntensity > 0 && spreadAccent !== null
          ? spreadAccent.tint
          : hitPresentation.tint,
        glyph.rotation,
      )
      enemyCount += 1

      effectCount = writeImpactEffects(
        snapshot,
        effectCount,
        glyph.id,
        x,
        y,
        glyph.velocityX,
        glyph.velocityY,
        material,
        impactPresentation.tint,
        hitPresentation.intensity,
      )
      effectCount = writeSpreadEffect(
        snapshot,
        effectCount,
        glyph.id,
        x,
        y,
        spreadIntensity,
        spreadAccent?.tint ?? hitPresentation.tint,
        world.content.combatVisualTheme.effects.spreadFeedbackAlpha,
      )
    }
  }
  snapshot.enemies.length = enemyCount
  snapshot.effects.length = effectCount
  writeTopologyTransferRenderSnapshot(
    world,
    snapshot.topologyTransferPulses,
    camera,
    interpolationAlpha,
  )

  let projectileCount = 0
  for (const projectile of world.projectiles) {
    const x = interpolate(
      projectile.previousX,
      projectile.x,
      interpolationAlpha,
    )
    const y = interpolate(
      projectile.previousY,
      projectile.y,
      interpolationAlpha,
    )

    if (projectile.isAlive && isWorldPositionVisible(x, y, camera)) {
      writeRenderGlyph(
        snapshot.projectiles,
        projectileCount,
        projectile.id,
        projectile.glyphFrame,
        x,
        y,
        projectile.visualScale,
        projectile.visualAlpha,
        projectile.visualTint,
      )
      projectileCount += 1
    }
  }
  snapshot.projectiles.length = projectileCount

  let orbitCount = 0
  for (const orbit of world.orbitAttacks) {
    const x = interpolate(orbit.previousX, orbit.x, interpolationAlpha)
    const y = interpolate(orbit.previousY, orbit.y, interpolationAlpha)
    if (!isWorldPositionVisible(x, y, camera)) {
      continue
    }
    writeRenderGlyph(
      snapshot.orbits,
      orbitCount,
      orbit.id,
      orbit.glyphFrame,
      x,
      y,
      orbit.visualScale,
      orbit.visualAlpha,
      orbit.visualTint,
    )
    orbitCount += 1
  }
  snapshot.orbits.length = orbitCount

  let dropCount = 0
  for (const drop of world.drops) {
    if (drop.isAlive && isWorldPositionVisible(drop.x, drop.y, camera)) {
      const presentation = resolveExperienceDropPresentation(
        world.content.combatVisualTheme,
        presentationTimeMs - drop.spawnedAtRunTimeMs,
        drop.id,
      )
      writeRenderGlyph(
        snapshot.drops,
        dropCount,
        drop.id,
        0,
        drop.x,
        drop.y,
        presentation.scale,
        presentation.alpha,
        presentation.tint,
      )
      dropCount += 1
    }
  }
  snapshot.drops.length = dropCount

  let flameEmitterCount = 0
  for (const emitter of world.flameEmitters) {
    if (!isWorldPositionVisible(emitter.x, emitter.y, camera)) {
      continue
    }
    const output = snapshot.flameEmitters[flameEmitterCount] ?? ({} as RenderFlameEmitter)
    output.id = emitter.id
    output.x = emitter.x
    output.y = emitter.y
    output.directionX = emitter.directionX
    output.directionY = emitter.directionY
    output.range = emitter.range
    output.fullAngleRadians = emitter.fullAngleRadians
    output.progress = 1 - emitter.remainingMs / emitter.durationMs
    output.particleCount = emitter.particleCount
    output.innerTint = emitter.innerTint
    output.innerAlpha = emitter.innerAlpha
    output.outerTint = emitter.outerTint
    output.outerAlpha = emitter.outerAlpha
    output.seed = emitter.seed
    snapshot.flameEmitters[flameEmitterCount] = output
    flameEmitterCount += 1
  }
  snapshot.flameEmitters.length = flameEmitterCount

}
