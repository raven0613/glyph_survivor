import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { GAME_CONFIG } from '../../src/game/runtime/gameConfig.ts'
import {
  beginWorldDeathReview,
  runDeathReviewStep,
} from '../../src/game/runtime/runDeathReviewStep.ts'
import { finalizeRunResult } from '../../src/game/runtime/runResult.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'

test('advances only review presentation without mutating the frozen run result', () => {
  const world = createWorldState(
    'death-review-step',
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
  world.runTimeMs = 1_500
  const enemy = spawnEnemy(world, 1_100, 1_100, 0)
  enemy.phase = 'ACTIVE'
  world.player.survivalPresentation.eventRevision = 5
  const result = finalizeRunResult(world)
  const killCount = world.runStatistics.killCount

  assert.equal(beginWorldDeathReview(world), true)
  for (let index = 0; index < 10; index += 1) {
    runDeathReviewStep(world, 100)
  }

  assert.equal(world.runTimeMs, 1_500)
  assert.equal(world.runResult, result)
  assert.equal(world.runStatistics.killCount, killCount)
  assert.equal(world.deathReview.elapsedMs, 1_000)
  assert.notEqual(enemy.x, 1_100)
})

test('finishes an existing collapse without adding post-death kills or rewards', () => {
  const world = createWorldState(
    'death-review-collapse',
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const enemy = spawnEnemy(world, 1_100, 1_100, 0)
  enemy.phase = 'COLLAPSING'
  enemy.collapseRemainingMs = 50
  world.player.survivalPresentation.eventRevision = 1
  beginWorldDeathReview(world)

  runDeathReviewStep(world, 50)

  assert.equal(world.runStatistics.killCount, 0)
  assert.equal(world.drops.length, 0)
  assert.equal(world.enemies.length, 0)
})

test('reports the prompt-ready edge exactly once', () => {
  const world = createWorldState(
    'death-review-ready',
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
  world.player.survivalPresentation.eventRevision = 1
  beginWorldDeathReview(world)

  const readyAtMs =
    GAME_CONFIG.playerDeathFallDurationMs +
    GAME_CONFIG.playerDeathGroundedDurationMs
  assert.equal(runDeathReviewStep(world, readyAtMs - 1), false)
  assert.equal(runDeathReviewStep(world, 1), true)
  assert.equal(runDeathReviewStep(world, 1_000), false)
})
