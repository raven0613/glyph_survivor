import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import {
  createWorldState,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { runDirectorSystem } from '../../src/game/systems/directorSystem.ts'

function createDirectorTestWorld(seed: string): WorldState {
  return createWorldState(
    seed,
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
}

function attemptSpawn(world: WorldState, gameplayTimeMs: number): void {
  world.runTimeMs = gameplayTimeMs
  world.spawnCooldownMs = 0
  runDirectorSystem(world, 0)
}

test('keeps a failed Director debut pending and commits all first appearances in order', () => {
  const world = createDirectorTestWorld('director-debut-order')
  const progression = world.content.ordinaryEnemyProgression
  const latestGate = progression.entries.at(-1)?.earliestAppearanceTimeMs ?? 0
  world.obstacles.push({ left: 0, top: 0, right: 4_000, bottom: 4_000 })

  attemptSpawn(world, latestGate)

  assert.equal(world.enemies.length, 0)
  assert.equal(world.ordinaryEnemyProgressionState.completedDebutCount, 0)
  assert.equal(world.ordinaryEnemyProgressionState.pendingDebutIndex, 0)

  world.obstacles.length = 0
  for (const [index, entry] of progression.entries.entries()) {
    attemptSpawn(world, latestGate)
    assert.equal(world.enemies[index]?.definitionId, entry.definition.id)
    assert.equal(
      world.ordinaryEnemyProgressionState.completedDebutCount,
      index + 1,
    )
    assert.equal(world.ordinaryEnemyProgressionState.pendingDebutIndex, null)
  }
})

function collectMixedDirectorSequence(seed: string): readonly string[] {
  const world = createDirectorTestWorld(seed)
  const progression = world.content.ordinaryEnemyProgression
  world.ordinaryEnemyProgressionState.completedDebutCount =
    progression.entries.length
  const sequence: string[] = []

  for (let index = 0; index < 64; index += 1) {
    world.enemySpatialHash.clear()
    const previousEnemyCount = world.enemies.length
    attemptSpawn(
      world,
      progression.entries.at(-1)?.earliestAppearanceTimeMs ?? 0,
    )
    const spawned = world.enemies[previousEnemyCount]
    assert.ok(spawned)
    sequence.push(spawned.definitionId)
  }

  return sequence
}

test('uses a reproducible seeded mixed pool after every species has debuted', () => {
  const firstSequence = collectMixedDirectorSequence('director-mixed-seed')
  const secondSequence = collectMixedDirectorSequence('director-mixed-seed')

  assert.deepEqual(secondSequence, firstSequence)
  assert.deepEqual(
    new Set(firstSequence),
    new Set([
      'enemy.zombie',
      'enemy.bone',
      'enemy.bat',
      'enemy.rock',
      'enemy.snake',
    ]),
  )
})
