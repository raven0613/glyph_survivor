import { calculateCameraView } from '../runtime/cameraTransform.ts'
import { selectOrdinaryEnemyDefinition } from '../content/enemies/ordinaryEnemyProgression.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import { spawnEnemy, type WorldState } from '../runtime/worldState.ts'
import {
  chooseSpawnSide,
  createSpawnCandidate,
  isSpawnCandidateValid,
} from './spawnGeometry.ts'

const WORLD_BOUNDS = Object.freeze({
  left: 0,
  top: 0,
  right: GAME_CONFIG.worldWidth,
  bottom: GAME_CONFIG.worldHeight,
})

function getSpawnIntervalMs(runTimeMs: number): number {
  return Math.max(
    GAME_CONFIG.spawnIntervalMinimumMs,
    GAME_CONFIG.spawnIntervalStartMs - runTimeMs / 60,
  )
}

export function runDirectorSystem(world: WorldState, deltaMs: number): void {
  world.spawnCooldownMs -= deltaMs

  if (world.spawnCooldownMs > 0) {
    return
  }

  world.spawnCooldownMs += getSpawnIntervalMs(world.runTimeMs)
  const camera = calculateCameraView(
    world.player.x,
    world.player.y,
    world.viewportWidth,
    world.viewportHeight,
  )
  const enemyDefinition = selectOrdinaryEnemyDefinition(
    world.content.ordinaryEnemyProgression,
    world.ordinaryEnemySpawnCount,
    world.rng.next,
  )
  const enemyRadius = enemyDefinition.broadPhaseRadius
  for (let attempt = 0; attempt < GAME_CONFIG.spawnAttemptCount; attempt += 1) {
    const side = chooseSpawnSide(
      world.player.moveX,
      world.player.moveY,
      world.rng.next,
    )
    const candidate = createSpawnCandidate(camera, side, world.rng.next)
    const nearbyEnemies = world.enemySpatialHash.queryCircle(
      candidate.x,
      candidate.y,
      enemyRadius * 2,
      world.spawnCandidates,
    )

    if (
      !isSpawnCandidateValid(
        candidate,
        enemyRadius,
        camera,
        WORLD_BOUNDS,
        nearbyEnemies,
        world.obstacles,
      )
    ) {
      continue
    }

    const materializeDurationMs = 300 + world.rng.next() * 200
    const enemy = spawnEnemy(
      world,
      candidate.x,
      candidate.y,
      materializeDurationMs,
      enemyDefinition,
    )
    world.ordinaryEnemySpawnCount += 1
    world.enemySpatialHash.insert(enemy)
    if (!world.firstWaveStarted) {
      world.firstWaveStarted = true
      world.pendingBossSpawnSide = side
    }
    return
  }
}
