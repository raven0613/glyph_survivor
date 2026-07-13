import { calculateCameraView } from '../runtime/cameraTransform.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import { getPrintableAsciiGlyphFrame } from '../glyph/glyphFrame.ts'
import {
  getGlyphMaterialDefinition,
  type GlyphMaterialDefinition,
} from '../glyph/glyphMaterial.ts'
import { calculateGlyphHitPresentation } from './glyphHitPresentation.ts'

const COLLAPSE_SCATTER_DISTANCE = 42
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
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

export interface RenderSnapshot {
  cameraX: number
  cameraY: number
  viewportWidth: number
  viewportHeight: number
  playerX: number
  playerY: number
  readonly enemies: RenderGlyph[]
  readonly effects: RenderGlyph[]
  readonly projectiles: RenderGlyph[]
  readonly drops: RenderGlyph[]
}

function interpolate(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha
}

function writeGlyph(
  buffer: RenderGlyph[],
  index: number,
  id: number,
  glyphFrame: number,
  x: number,
  y: number,
  scale: number,
  alpha: number,
  tint: number,
  rotation = 0,
): void {
  const glyph = buffer[index] ?? {
    id,
    glyphFrame,
    x,
    y,
    rotation,
    scale,
    alpha,
    tint,
  }
  glyph.id = id
  glyph.glyphFrame = glyphFrame
  glyph.x = x
  glyph.y = y
  glyph.rotation = rotation
  glyph.scale = scale
  glyph.alpha = alpha
  glyph.tint = tint
  buffer[index] = glyph
}

function isVisible(
  x: number,
  y: number,
  camera: ReturnType<typeof calculateCameraView>,
): boolean {
  return (
    x >= camera.left - GAME_CONFIG.renderMargin &&
    x <= camera.right + GAME_CONFIG.renderMargin &&
    y >= camera.top - GAME_CONFIG.renderMargin &&
    y <= camera.bottom + GAME_CONFIG.renderMargin
  )
}

export function createRenderSnapshot(): RenderSnapshot {
  return {
    cameraX: GAME_CONFIG.worldWidth / 2,
    cameraY: GAME_CONFIG.worldHeight / 2,
    viewportWidth: 1,
    viewportHeight: 1,
    playerX: GAME_CONFIG.worldWidth / 2,
    playerY: GAME_CONFIG.worldHeight / 2,
    enemies: [],
    effects: [],
    projectiles: [],
    drops: [],
  }
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

    writeGlyph(
      snapshot.effects,
      startIndex,
      glyphId * MAX_BURST_PARTICLES_PER_GLYPH + particleIndex,
      getPrintableAsciiGlyphFrame(character),
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      material.hitBurstScale * (0.75 + intensity * 0.25),
      intensity,
      material.hitBurstTint,
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
  const playerX = interpolate(
    world.player.previousX,
    world.player.x,
    interpolationAlpha,
  )
  const playerY = interpolate(
    world.player.previousY,
    world.player.y,
    interpolationAlpha,
  )
  const camera = calculateCameraView(
    playerX,
    playerY,
    world.viewportWidth,
    world.viewportHeight,
  )
  snapshot.cameraX = playerX
  snapshot.cameraY = playerY
  snapshot.viewportWidth = world.viewportWidth
  snapshot.viewportHeight = world.viewportHeight
  snapshot.playerX = playerX
  snapshot.playerY = playerY

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
      const hitPresentation = calculateGlyphHitPresentation({
        baseAlpha: glyph.alpha,
        baseScale: glyph.scale,
        baseTint: glyph.baseTint,
        hitTint: material.hitTint,
        hitFlashRemainingMs: glyph.hitFlashRemainingMs,
        hitFlashDurationMs: material.hitFlashDurationMs,
        hitPulseScale: material.hitPulseScale,
        hitAlphaFloor: material.hitAlphaFloor,
      })
      const collapseAngle = glyph.id * GOLDEN_ANGLE
      const collapseDistance = collapseProgress * COLLAPSE_SCATTER_DISTANCE
      const x =
        getGlyphWorldX(rootX, glyph) + Math.cos(collapseAngle) * collapseDistance
      const y =
        getGlyphWorldY(rootY, glyph) + Math.sin(collapseAngle) * collapseDistance
      if (!isVisible(x, y, camera)) {
        continue
      }

      writeGlyph(
        snapshot.enemies,
        enemyCount,
        glyph.id,
        glyph.glyphFrame,
        x,
        y,
        materializeProgress *
          hitPresentation.scale *
          (1 - collapseProgress * 0.7),
        materializeProgress *
          hitPresentation.alpha *
          (1 - collapseProgress),
        hitPresentation.tint,
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
        hitPresentation.intensity,
      )
    }
  }
  snapshot.enemies.length = enemyCount
  snapshot.effects.length = effectCount

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

    if (projectile.isAlive && isVisible(x, y, camera)) {
      writeGlyph(
        snapshot.projectiles,
        projectileCount,
        projectile.id,
        0,
        x,
        y,
        0.55,
        1,
        0x66ddff,
      )
      projectileCount += 1
    }
  }
  snapshot.projectiles.length = projectileCount

  let dropCount = 0
  for (const drop of world.drops) {
    if (drop.isAlive && isVisible(drop.x, drop.y, camera)) {
      writeGlyph(
        snapshot.drops,
        dropCount,
        drop.id,
        0,
        drop.x,
        drop.y,
        0.7,
        1,
        0xffcc33,
      )
      dropCount += 1
    }
  }
  snapshot.drops.length = dropCount
}
