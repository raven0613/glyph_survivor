import { calculateCameraView } from '../runtime/cameraTransform.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { GLYPH_CELL_STATE } from '../glyph/glyphStore.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'

export interface RenderGlyph {
  id: number
  glyphFrame: number
  x: number
  y: number
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
): void {
  const glyph = buffer[index] ?? { id, glyphFrame, x, y, scale, alpha, tint }
  glyph.id = id
  glyph.glyphFrame = glyphFrame
  glyph.x = x
  glyph.y = y
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
    projectiles: [],
    drops: [],
  }
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
  for (const enemy of world.enemies) {
    if (enemy.phase === 'DEAD') {
      continue
    }

    const rootX = interpolate(enemy.previousX, enemy.x, interpolationAlpha)
    const rootY = interpolate(enemy.previousY, enemy.y, interpolationAlpha)
    const progress =
      enemy.phase === 'MATERIALIZING'
        ? 1 - enemy.materializeRemainingMs / enemy.materializeDurationMs
        : 1

    for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
      if (glyph.state !== GLYPH_CELL_STATE.ALIVE) {
        continue
      }

      const x = getGlyphWorldX(rootX, glyph)
      const y = getGlyphWorldY(rootY, glyph)
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
        progress * glyph.scale,
        progress * glyph.alpha,
        glyph.tint,
      )
      enemyCount += 1
    }
  }
  snapshot.enemies.length = enemyCount

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
