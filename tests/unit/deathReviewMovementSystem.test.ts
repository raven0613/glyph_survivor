import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { GAME_CONFIG } from '../../src/game/runtime/gameConfig.ts'
import {
  advancePlayerDeathReview,
  beginPlayerDeathReview,
} from '../../src/game/runtime/playerDeathReview.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { runDeathReviewMovementSystem } from '../../src/game/systems/deathReviewMovementSystem.ts'

function createActiveEnemyWorld(seed: string, playerX: number): WorldState {
  const world = createWorldState(
    seed,
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
  world.player.x = playerX
  world.player.y = playerX
  const enemy = spawnEnemy(world, 1_000, 1_000, 0)
  enemy.phase = 'ACTIVE'
  enemy.velocityX = 12
  enemy.velocityY = -4
  beginPlayerDeathReview(world.deathReview, 1)
  return world
}

function runReviewMovement(world: WorldState, stepCount: number): void {
  for (let index = 0; index < stepCount; index += 1) {
    advancePlayerDeathReview(world.deathReview, 100, GAME_CONFIG)
    runDeathReviewMovementSystem(world, 100, GAME_CONFIG)
  }
}

test('death-review wander is deterministic and independent of corpse position', () => {
  const first = createActiveEnemyWorld('wander-seed', 100)
  const second = createActiveEnemyWorld('wander-seed', 3_800)

  runReviewMovement(first, 40)
  runReviewMovement(second, 40)

  assert.deepEqual(
    {
      x: first.enemies[0].x,
      y: first.enemies[0].y,
      velocityX: first.enemies[0].velocityX,
      velocityY: first.enemies[0].velocityY,
    },
    {
      x: second.enemies[0].x,
      y: second.enemies[0].y,
      velocityX: second.enemies[0].velocityX,
      velocityY: second.enemies[0].velocityY,
    },
  )
})

test('different creatures wander independently and remain inside world bounds', () => {
  const world = createActiveEnemyWorld('wander-bounds', 2_000)
  const second = spawnEnemy(world, 3_990, 3_990, 0)
  second.phase = 'ACTIVE'
  second.velocityX = 100
  second.velocityY = 100

  runReviewMovement(world, 80)

  assert.notDeepEqual(
    [world.enemies[0].velocityX, world.enemies[0].velocityY],
    [second.velocityX, second.velocityY],
  )
  for (const enemy of world.enemies) {
    assert.ok(enemy.x >= enemy.radius)
    assert.ok(enemy.x <= GAME_CONFIG.worldWidth - enemy.radius)
    assert.ok(enemy.y >= enemy.radius)
    assert.ok(enemy.y <= GAME_CONFIG.worldHeight - enemy.radius)
  }
})
