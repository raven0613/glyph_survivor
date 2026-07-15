import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLAYER_DAMAGE_ROUTE,
  PLAYER_DAMAGE_SOURCE_KIND,
  assertValidPlayerSurvivalConfig,
  createPlayerDamageStepOutcome,
  createPlayerSurvivalState,
  resolvePlayerDamageStep,
  type PlayerSurvivalConfig,
} from '../../src/game/runtime/playerSurvival.ts'

const TEST_CONFIG: Readonly<PlayerSurvivalConfig> = Object.freeze({
  initialPlayerHealth: 10,
  initialPlayerShieldLayers: 2,
  shieldRechargeIntervalMs: 1_000,
  playerDamageInvulnerabilityMs: 500,
  playerCollisionRadius: 14,
})

test('validates the survival config values that define run state', () => {
  assert.doesNotThrow(() => assertValidPlayerSurvivalConfig(TEST_CONFIG))

  for (const invalidConfig of [
    { ...TEST_CONFIG, initialPlayerHealth: Number.NaN },
    { ...TEST_CONFIG, initialPlayerShieldLayers: 1.5 },
    { ...TEST_CONFIG, shieldRechargeIntervalMs: 0 },
    { ...TEST_CONFIG, playerDamageInvulnerabilityMs: 0 },
    { ...TEST_CONFIG, playerCollisionRadius: 0 },
  ]) {
    assert.throws(() => assertValidPlayerSurvivalConfig(invalidConfig))
  }
})

test('lets one shield layer absorb a whole accepted hit without health spillover', () => {
  const state = createPlayerSurvivalState(TEST_CONFIG)
  const outcome = createPlayerDamageStepOutcome()

  resolvePlayerDamageStep(
    state,
    [
      {
        eventId: 1,
        sourceKind: PLAYER_DAMAGE_SOURCE_KIND.CREATURE_CONTACT,
        sourceId: 7,
        amount: 99,
        route: PLAYER_DAMAGE_ROUTE.SHIELD_FIRST,
      },
    ],
    1,
    100,
    TEST_CONFIG,
    outcome,
  )

  assert.equal(outcome.acceptedEventId, 1)
  assert.equal(outcome.shieldLayersConsumed, 1)
  assert.equal(outcome.healthDamageApplied, 0)
  assert.equal(state.currentShieldLayers, 1)
  assert.equal(state.currentHealth, 10)
  assert.equal(state.lastAcceptedDamageAtMs, 100)

  resolvePlayerDamageStep(
    state,
    [
      {
        eventId: 2,
        sourceKind: PLAYER_DAMAGE_SOURCE_KIND.CREATURE_CONTACT,
        sourceId: 8,
        amount: 1,
        route: PLAYER_DAMAGE_ROUTE.SHIELD_FIRST,
      },
    ],
    1,
    200,
    TEST_CONFIG,
    outcome,
  )

  assert.equal(outcome.acceptedEventId, null)
  assert.equal(state.currentShieldLayers, 1)
  assert.equal(state.lastAcceptedDamageAtMs, 100)

  resolvePlayerDamageStep(
    state,
    [],
    0,
    1_100,
    TEST_CONFIG,
    outcome,
  )

  assert.equal(outcome.shieldLayersRestored, 1)
  assert.equal(state.currentShieldLayers, 2)
})

test('preserves shield recharge overflow across fixed steps without banking at full', () => {
  const state = createPlayerSurvivalState({
    ...TEST_CONFIG,
    initialPlayerShieldLayers: 3,
  })
  const outcome = createPlayerDamageStepOutcome()
  state.currentShieldLayers = 0
  state.lastAcceptedDamageAtMs = 0
  state.nextShieldRechargeAtMs = 1_000

  resolvePlayerDamageStep(
    state,
    [],
    0,
    2_500,
    { ...TEST_CONFIG, initialPlayerShieldLayers: 3 },
    outcome,
  )

  assert.equal(outcome.shieldLayersRestored, 2)
  assert.equal(state.currentShieldLayers, 2)
  assert.equal(state.nextShieldRechargeAtMs, 3_000)

  resolvePlayerDamageStep(
    state,
    [],
    0,
    3_000,
    { ...TEST_CONFIG, initialPlayerShieldLayers: 3 },
    outcome,
  )

  assert.equal(state.currentShieldLayers, 3)
  assert.equal(state.nextShieldRechargeAtMs, null)
})

test('lets health-only damage kill the player while shields remain', () => {
  const state = createPlayerSurvivalState(TEST_CONFIG)
  const outcome = createPlayerDamageStepOutcome()

  resolvePlayerDamageStep(
    state,
    [
      {
        eventId: 3,
        sourceKind: PLAYER_DAMAGE_SOURCE_KIND.ENEMY_PROJECTILE,
        sourceId: 12,
        amount: 10,
        route: PLAYER_DAMAGE_ROUTE.HEALTH_ONLY,
      },
    ],
    1,
    500,
    TEST_CONFIG,
    outcome,
  )

  assert.equal(state.currentHealth, 0)
  assert.equal(state.currentShieldLayers, 2)
  assert.equal(outcome.playerDied, true)
})

test('accepts only the first stable contact source in one invulnerability window', () => {
  const config = { ...TEST_CONFIG, initialPlayerShieldLayers: 0 }
  const state = createPlayerSurvivalState(config)
  const outcome = createPlayerDamageStepOutcome()

  resolvePlayerDamageStep(
    state,
    [
      {
        eventId: 4,
        sourceKind: PLAYER_DAMAGE_SOURCE_KIND.CREATURE_CONTACT,
        sourceId: 9,
        amount: 2,
        route: PLAYER_DAMAGE_ROUTE.SHIELD_FIRST,
      },
      {
        eventId: 5,
        sourceKind: PLAYER_DAMAGE_SOURCE_KIND.CREATURE_CONTACT,
        sourceId: 3,
        amount: 1,
        route: PLAYER_DAMAGE_ROUTE.SHIELD_FIRST,
      },
    ],
    2,
    100,
    config,
    outcome,
  )

  assert.equal(outcome.acceptedSourceId, 3)
  assert.equal(outcome.healthDamageApplied, 1)
  assert.equal(state.currentHealth, 9)
})

test('does not accept the same damage event again after invulnerability expires', () => {
  const config = { ...TEST_CONFIG, initialPlayerShieldLayers: 0 }
  const state = createPlayerSurvivalState(config)
  const outcome = createPlayerDamageStepOutcome()
  const repeatedCandidate = {
    eventId: 6,
    sourceKind: PLAYER_DAMAGE_SOURCE_KIND.CREATURE_CONTACT,
    sourceId: 3,
    amount: 2,
    route: PLAYER_DAMAGE_ROUTE.SHIELD_FIRST,
  } as const

  resolvePlayerDamageStep(
    state,
    [repeatedCandidate],
    1,
    100,
    config,
    outcome,
  )
  resolvePlayerDamageStep(
    state,
    [repeatedCandidate],
    1,
    1_000,
    config,
    outcome,
  )

  assert.equal(outcome.acceptedEventId, null)
  assert.equal(state.currentHealth, 8)
})
