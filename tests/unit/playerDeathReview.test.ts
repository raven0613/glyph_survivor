import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advancePlayerDeathReview,
  assertValidPlayerDeathReviewConfig,
  beginPlayerDeathReview,
  createPlayerDeathReviewState,
  getPlayerDeathFallProgress,
  type PlayerDeathReviewConfig,
} from '../../src/game/runtime/playerDeathReview.ts'

const config: PlayerDeathReviewConfig = Object.freeze({
  playerDeathFallDurationMs: 200,
  playerDeathGroundedDurationMs: 2_000,
  deathReviewEnemyWanderIntervalMs: 1_200,
  deathReviewEnemyWanderSpeedMultiplier: 0.4,
  deathReviewEnemyWanderTurnResponsiveness: 3,
})

test('enables result entry only after falling and the grounded wait complete', () => {
  const state = createPlayerDeathReviewState()

  beginPlayerDeathReview(state, 7)
  assert.equal(state.active, true)
  assert.equal(state.lethalPresentationRevision, 7)
  assert.equal(state.canEnterRunResult, false)

  assert.equal(advancePlayerDeathReview(state, 100, config), false)
  assert.equal(getPlayerDeathFallProgress(state, config), 0.5)

  assert.equal(advancePlayerDeathReview(state, 2_099, config), false)
  assert.equal(state.canEnterRunResult, false)

  assert.equal(advancePlayerDeathReview(state, 1, config), true)
  assert.equal(getPlayerDeathFallProgress(state, config), 1)
  assert.equal(state.canEnterRunResult, true)

  assert.equal(advancePlayerDeathReview(state, 1_000, config), false)
})

test('starts a death review only once and validates every tunable value', () => {
  const state = createPlayerDeathReviewState()

  assert.equal(beginPlayerDeathReview(state, 3), true)
  advancePlayerDeathReview(state, 100, config)
  assert.equal(beginPlayerDeathReview(state, 9), false)
  assert.equal(state.elapsedMs, 100)
  assert.equal(state.lethalPresentationRevision, 3)

  assert.throws(
    () =>
      assertValidPlayerDeathReviewConfig({
        ...config,
        deathReviewEnemyWanderSpeedMultiplier: 0,
      }),
    /deathReviewEnemyWanderSpeedMultiplier/,
  )
})
