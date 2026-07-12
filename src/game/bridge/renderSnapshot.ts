import { calculateCameraView } from '../runtime/cameraTransform.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { WorldState } from '../runtime/worldState.ts'

export interface RenderGlyph {
  id: number
  x: number
  y: number
  scale: number
  alpha: number
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
  x: number,
  y: number,
  scale: number,
  alpha: number,
): void {
  const glyph = buffer[index] ?? { id, x, y, scale, alpha }
  glyph.id = id
  glyph.x = x
  glyph.y = y
  glyph.scale = scale
  glyph.alpha = alpha
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
    const x = interpolate(enemy.previousX, enemy.x, interpolationAlpha)
    const y = interpolate(enemy.previousY, enemy.y, interpolationAlpha)

    if (!isVisible(x, y, camera)) {
      continue
    }

    const progress =
      enemy.phase === 'MATERIALIZING'
        ? 1 - enemy.materializeRemainingMs / enemy.materializeDurationMs
        : 1
    writeGlyph(snapshot.enemies, enemyCount, enemy.id, x, y, progress, progress)
    enemyCount += 1
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
      writeGlyph(snapshot.projectiles, projectileCount, projectile.id, x, y, 0.55, 1)
      projectileCount += 1
    }
  }
  snapshot.projectiles.length = projectileCount

  let dropCount = 0
  for (const drop of world.drops) {
    if (drop.isAlive && isVisible(drop.x, drop.y, camera)) {
      writeGlyph(snapshot.drops, dropCount, drop.id, drop.x, drop.y, 0.7, 1)
      dropCount += 1
    }
  }
  snapshot.drops.length = dropCount
}
