import type { CreatureDefinition } from '../content/creatures/creatureDefinition.ts'
import { calculateCameraView } from '../runtime/cameraTransform.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type {
  BossSpawnRequestState,
  EnemyState,
  SpawnSide,
} from '../runtime/worldEntities.ts'
import { spawnEnemy, type WorldState } from '../runtime/worldState.ts'
import { createSpawnCandidate, isSpawnCandidateValid } from './spawnGeometry.ts'

const WORLD_BOUNDS = Object.freeze({
  left: 0,
  top: 0,
  right: GAME_CONFIG.worldWidth,
  bottom: GAME_CONFIG.worldHeight,
})

interface BossSpawnDefinition {
  readonly creature: CreatureDefinition
  readonly footprintRadius: number
  readonly separationPadding: number
  getMaterializeDurationMs(world: WorldState): number
}

function getCommittedBosses(world: WorldState): readonly EnemyState[] {
  const bosses: EnemyState[] = []
  for (const request of [
    world.firstWaveBossSpawns.slime,
    world.firstWaveBossSpawns.rhombus,
  ]) {
    if (request.committedEnemyId === null) {
      continue
    }
    const enemy = world.enemyById.get(request.committedEnemyId)
    if (enemy && enemy.phase !== 'DEAD') {
      bosses.push(enemy)
    }
  }
  return bosses
}

function getBossFootprintRadius(world: WorldState, enemy: EnemyState): number {
  return enemy.definitionId === world.content.rhombusBossDefinition.creature.id
    ? world.content.rhombusBossDefinition.maximumGameplayFootprintRadius
    : enemy.radius
}

function isSeparatedFromCommittedBosses(
  world: WorldState,
  x: number,
  y: number,
  footprintRadius: number,
  separationPadding: number,
): boolean {
  for (const boss of getCommittedBosses(world)) {
    const requiredDistance =
      footprintRadius +
      getBossFootprintRadius(world, boss) +
      separationPadding
    if ((boss.x - x) ** 2 + (boss.y - y) ** 2 < requiredDistance ** 2) {
      return false
    }
  }
  return true
}

function tryCommitBossSpawn(
  world: WorldState,
  request: BossSpawnRequestState,
  definition: Readonly<BossSpawnDefinition>,
): void {
  const side = request.pendingSide
  if (side === null || request.committedEnemyId !== null) {
    return
  }
  const camera = calculateCameraView(
    world.player.x,
    world.player.y,
    world.viewportWidth,
    world.viewportHeight,
  )

  for (let attempt = 0; attempt < GAME_CONFIG.spawnAttemptCount; attempt += 1) {
    const candidate = createSpawnCandidate(
      camera,
      side,
      world.rng.next,
      definition.footprintRadius,
    )
    const nearbyEnemies = world.enemySpatialHash.queryCircle(
      candidate.x,
      candidate.y,
      definition.footprintRadius +
        world.content.maximumEnemyBroadPhaseRadius +
        definition.separationPadding,
      world.spawnCandidates,
    )

    if (
      !isSpawnCandidateValid(
        candidate,
        definition.footprintRadius,
        camera,
        WORLD_BOUNDS,
        nearbyEnemies,
        world.obstacles,
      ) ||
      !isSeparatedFromCommittedBosses(
        world,
        candidate.x,
        candidate.y,
        definition.footprintRadius,
        definition.separationPadding,
      )
    ) {
      continue
    }

    const boss = spawnEnemy(
      world,
      candidate.x,
      candidate.y,
      definition.getMaterializeDurationMs(world),
      definition.creature,
    )
    world.enemySpatialHash.insert(boss)
    request.committedEnemyId = boss.id
    request.pendingSide = null
    return
  }
}

/** Commits each first-wave Boss request independently and retries failures later. */
export function runBossSpawnSystem(world: WorldState): void {
  if (
    world.firstWaveBossSpawns.slime.pendingSide === null &&
    world.firstWaveBossSpawns.rhombus.pendingSide === null
  ) {
    return
  }
  const rhombus = world.content.rhombusBossDefinition
  const separationPadding =
    rhombus.spawnProfile.bossSpawnSeparationPaddingWorldUnits
  tryCommitBossSpawn(world, world.firstWaveBossSpawns.slime, {
    creature: world.content.slimeBossDefinition,
    footprintRadius: world.content.slimeBossDefinition.broadPhaseRadius,
    separationPadding,
    getMaterializeDurationMs: (currentWorld) =>
      300 + currentWorld.rng.next() * 200,
  })
  if (world.content.creatureDefinitions[rhombus.creature.id] !== rhombus.creature) {
    return
  }
  tryCommitBossSpawn(world, world.firstWaveBossSpawns.rhombus, {
    creature: rhombus.creature,
    footprintRadius: rhombus.maximumGameplayFootprintRadius,
    separationPadding,
    getMaterializeDurationMs: () => rhombus.spawnProfile.materializeDurationMs,
  })
}

export function scheduleFirstWaveBossSpawns(
  world: WorldState,
  slimeSide: SpawnSide,
  rhombusSide: SpawnSide,
): void {
  if (world.firstWaveStarted) {
    return
  }
  world.firstWaveStarted = true
  world.firstWaveBossSpawns.slime.pendingSide = slimeSide
  world.firstWaveBossSpawns.rhombus.pendingSide = rhombusSide
}
