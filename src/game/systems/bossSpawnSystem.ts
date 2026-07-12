import { calculateCameraView } from '../runtime/cameraTransform.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import { spawnEnemy, type WorldState } from '../runtime/worldState.ts'
import { createSpawnCandidate, isSpawnCandidateValid } from './spawnGeometry.ts'

const WORLD_BOUNDS = Object.freeze({
  left: 0,
  top: 0,
  right: GAME_CONFIG.worldWidth,
  bottom: GAME_CONFIG.worldHeight,
})

/** Spawns the first-wave boss from its explicit pending gameplay event. */
export function runBossSpawnSystem(world: WorldState): void {
  const side = world.pendingBossSpawnSide
  if (side === null || world.slimeBossSpawned) {
    return
  }

  const definition = world.content.slimeBossDefinition
  const radius = definition.broadPhaseRadius
  const camera = calculateCameraView(
    world.player.x,
    world.player.y,
    world.viewportWidth,
    world.viewportHeight,
  )

  for (let attempt = 0; attempt < GAME_CONFIG.spawnAttemptCount; attempt += 1) {
    const candidate = createSpawnCandidate(camera, side, world.rng.next)
    const nearbyEnemies = world.enemySpatialHash.queryCircle(
      candidate.x,
      candidate.y,
      radius + world.content.maximumEnemyBroadPhaseRadius,
      world.spawnCandidates,
    )

    if (
      !isSpawnCandidateValid(
        candidate,
        radius,
        camera,
        WORLD_BOUNDS,
        nearbyEnemies,
        world.obstacles,
      )
    ) {
      continue
    }

    const materializeDurationMs = 300 + world.rng.next() * 200
    const boss = spawnEnemy(
      world,
      candidate.x,
      candidate.y,
      materializeDurationMs,
      definition,
    )
    world.enemySpatialHash.insert(boss)
    world.slimeBossSpawned = true
    world.pendingBossSpawnSide = null
    return
  }
}
